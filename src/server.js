require('./logger');
const express = require('express');
const config = require('./config');
const { loginDahua } = require('./auth');
const { subscribeAlarm, getAlarmFaceRecognitionInfo } = require('./dahua');
const { formatBlacklistMessage, sendToGoogleChat } = require('./gchat');
const { parseAlarmXml } = require('./alarmParser');
const { IMAGES_DIR, downloadAndSaveImage, cleanupOldImages } = require('./imageStore');

const app = express();
app.use(express.text({ type: '*/*' }));
app.use('/images', express.static(IMAGES_DIR));

app.post('/api/dahua/push', async (req, res) => {
    // Dahua requires a fast response
    res.status(200).send('OK');

    let alarm;
    try {
        alarm = await parseAlarmXml(req.body);
    } catch (error) {
        console.error('[Server] Failed to parse alarm XML:', error.message);
        return;
    }

    // callbackType: 1 = alarm raised, 2 = alarm cleared
    if (alarm.callbackType !== '1') {
        return;
    }

    if (!alarm.alarmCode) {
        console.warn('[Server] No alarmCode found in parsed alarm:', JSON.stringify(alarm));
        return;
    }

    try {
        const faceDetail = await getAlarmFaceRecognitionInfo(alarm.alarmCode, alarm.sourceCode, alarm.alarmTime);

        const [detectionImageUrl, repositoryImageUrl] = await Promise.all([
            downloadAndSaveImage(faceDetail.detectionImageUrl || alarm.snapshotUrl).catch((error) => {
                console.error('[Server] Failed to download detection image:', error.message);
                return null;
            }),
            downloadAndSaveImage(faceDetail.repositoryImageUrl).catch((error) => {
                console.error('[Server] Failed to download repository image:', error.message);
                return null;
            }),
        ]);

        const textMessage = formatBlacklistMessage(faceDetail, alarm, { detectionImageUrl, repositoryImageUrl });
        await sendToGoogleChat(textMessage);
    } catch (error) {
        console.error('[Server] Failed to process alarm or send to Google Chat:', error.message);
    }
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.listen(config.middlewarePort, async () => {
    console.log(`[Server] Middleware running on port ${config.middlewarePort}`);

    try {
        await loginDahua();
        await subscribeAlarm();
    } catch (error) {
        console.error('[Server] Dahua initialization failed:', error.message);
    }

    // Run once at startup, then every 24 hours. cleanupOldImages() only removes
    // files older than config.imageMaxAgeDays, so daily checks are enough to
    // achieve the monthly cleanup cadence.
    cleanupOldImages();
    setInterval(cleanupOldImages, 24 * 60 * 60 * 1000);
});
