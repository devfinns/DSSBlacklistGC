const express = require('express');
const config = require('./config');
const { loginDahua } = require('./auth');
const { subscribeAlarm, getAlarmFaceRecognitionInfo } = require('./dahua');
const { formatBlacklistMessage, sendToGoogleChat } = require('./gchat');

const app = express();
app.use(express.text({ type: '*/*' }));

app.post('/api/dahua/push', async (req, res) => {
    // Dahua requires a fast response
    res.status(200).send('OK');

    console.log('[Server] Received alarm from Dahua. Content-Type:', req.headers['content-type']);
    console.log('[Server] Received alarm from Dahua. Raw body text:', req.body);

    let alarmData;
    try {
        alarmData = JSON.parse(req.body);
    } catch (error) {
        console.error('[Server] Failed to parse alarm body as JSON:', error.message);
        return;
    }

    const { alarmCode, deviceCode } = alarmData;
    if (!alarmCode) {
        console.warn('[Server] No alarmCode found at root of payload — check parsed body above for actual field names/structure.', JSON.stringify(alarmData));
        return;
    }

    try {
        const faceDetail = await getAlarmFaceRecognitionInfo(alarmCode, deviceCode);
        const textMessage = formatBlacklistMessage(faceDetail, deviceCode);
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
});
