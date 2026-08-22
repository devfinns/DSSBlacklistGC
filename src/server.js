const express = require('express');
const config = require('./config');
const { loginDahua } = require('./auth');
const { subscribeAlarm, getAlarmFaceRecognitionInfo } = require('./dahua');
const { formatBlacklistMessage, sendToGoogleChat } = require('./gchat');

const app = express();
app.use(express.json());

app.post('/api/dahua/push', async (req, res) => {
    // Dahua requires a fast response
    res.status(200).send('OK');

    const alarmData = req.body;
    console.log('[Server] Received alarm from Dahua:', alarmData);

    const { alarmCode, deviceCode } = alarmData;
    if (!alarmCode) {
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
