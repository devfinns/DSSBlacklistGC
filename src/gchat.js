const axios = require('axios');
const moment = require('moment');
const config = require('./config');

function formatBlacklistMessage(faceDetail, alarm) {
    const alarmTimeSeconds = faceDetail.alarmTime || alarm.alarmTime;
    const momentValue = alarmTimeSeconds ? moment(Number(alarmTimeSeconds) * 1000) : moment();
    const dateStr = momentValue.format('YYYY-MM-DD');
    const timeStr = momentValue.format('HH:mm:ss');

    const detectionImageUrl = faceDetail.detectionImageUrl || alarm.snapshotUrl;

    return `*Blacklist Detection Summary for ${dateStr}*

Target Name: ${faceDetail.name || 'Unknown'}  |  Similarity: ${faceDetail.similarity || '0'}%
Camera Location: ${faceDetail.deviceName || alarm.sourceName || alarm.sourceCode}
Detection Time: ${timeStr}

Target Type: ${faceDetail.repositoryName || alarm.alarmTypeName || 'Blocklist Group'}
Snapshot Image: ${detectionImageUrl ? `<${detectionImageUrl}|Click to View>` : 'No Image'}
Reference Image: ${faceDetail.repositoryImageUrl ? `<${faceDetail.repositoryImageUrl}|Click to View>` : 'No Image'}

Action Required: Please dispatch security to the specified location immediately.

Stay safe!`;
}

async function sendToGoogleChat(text) {
    await axios.post(config.googleChatWebhookUrl, { text });
    console.log('[GChat] Notification sent to Google Chat successfully.');
}

module.exports = { formatBlacklistMessage, sendToGoogleChat };
