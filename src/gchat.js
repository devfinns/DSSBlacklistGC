const axios = require('axios');
const moment = require('moment');
const config = require('./config');

function formatBlacklistMessage(faceDetail, deviceCode) {
    const dateStr = moment(faceDetail.alarmTime * 1000).format('YYYY-MM-DD');
    const timeStr = moment(faceDetail.alarmTime * 1000).format('HH:mm:ss');

    return `*Blacklist Detection Summary for ${dateStr}*

Target Name: ${faceDetail.name || 'Unknown'}  |  Similarity: ${faceDetail.similarity || '0'}%
Camera Location: ${faceDetail.deviceName || deviceCode}
Detection Time: ${timeStr}

Target Type: ${faceDetail.repositoryName || 'Blocklist Group'}
Snapshot Image: ${faceDetail.detectionImageUrl ? `<${faceDetail.detectionImageUrl}|Click to View>` : 'No Image'}
Reference Image: ${faceDetail.repositoryImageUrl ? `<${faceDetail.repositoryImageUrl}|Click to View>` : 'No Image'}

Action Required: Please dispatch security to the specified location immediately.

Stay safe!`;
}

async function sendToGoogleChat(text) {
    await axios.post(config.googleChatWebhookUrl, { text });
    console.log('[GChat] Notification sent to Google Chat successfully.');
}

module.exports = { formatBlacklistMessage, sendToGoogleChat };
