require('./logger');
const express = require('express');
const config = require('./config');
const { loginDahua } = require('./auth');
const { subscribeAlarm, getAlarmFaceRecognitionInfo } = require('./dahua');
const { sendBlacklistAlert } = require('./gchat');
const { parseAlarmXml } = require('./alarmParser');
const { fetchImageAsDataUri } = require('./dahuaImageFetcher');

const app = express();
app.use(express.text({ type: '*/*' }));

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

        // The credential used for image URLs is only refreshed by a full
        // re-login or the ~20-minute token-update cycle (Dahua's keep-alive
        // response never carries a new credential), so it can go stale between
        // cycles. Re-login right before fetching images to guarantee a
        // fresh credential for every alarm.
        try {
            await loginDahua();
        } catch (loginError) {
            console.error('[Server] Pre-image re-login failed, using existing credential:', loginError.message);
        }

        const [detectionImageUrl, repositoryImageUrl] = await Promise.all([
            fetchImageAsDataUri(faceDetail.detectionImageUrl || alarm.snapshotUrl).catch((error) => {
                console.error('[Server] Failed to fetch detection image:', error.message);
                return null;
            }),
            fetchImageAsDataUri(faceDetail.repositoryImageUrl).catch((error) => {
                console.error('[Server] Failed to fetch repository image:', error.message);
                return null;
            }),
        ]);

        await sendBlacklistAlert(faceDetail, alarm, { detectionImageUrl, repositoryImageUrl });
    } catch (error) {
        console.error('[Server] Failed to process alarm or send to Google Chat:', error.message);
    }
});

let subscribed = false;

// 200 only once the Dahua login and alarm subscription have succeeded; 503 while
// the application is up but cannot receive alarms.
app.get('/health', (_req, res) => {
    res.status(subscribed ? 200 : 503).json({ status: subscribed ? 'ok' : 'degraded', subscribed });
});

const INIT_RETRY_MS = Number(process.env.INIT_RETRY_MS) || 30 * 1000;

async function initializeDahua() {
    try {
        await loginDahua();
        await subscribeAlarm();
        subscribed = true;
    } catch (error) {
        console.error(`[Server] Dahua initialization failed: ${error.message}. Retrying in ${INIT_RETRY_MS / 1000}s.`);
        setTimeout(initializeDahua, INIT_RETRY_MS);
    }
}

app.listen(config.middlewarePort, () => {
    console.log(`[Server] Middleware running on port ${config.middlewarePort}`);
    initializeDahua();
});
