const axios = require('axios');
const moment = require('moment');
const config = require('./config');

function formatBlacklistMessage(faceDetail, alarm, imageUrls) {
    const alarmTimeSeconds = faceDetail.alarmTime || alarm.alarmTime;
    const momentValue = alarmTimeSeconds ? moment(Number(alarmTimeSeconds) * 1000) : moment();
    const dateStr = momentValue.format('YYYY-MM-DD');
    const timeStr = momentValue.format('HH:mm:ss');

    const detectionImageUrl = imageUrls.detectionImageUrl;
    const repositoryImageUrl = imageUrls.repositoryImageUrl;
    const targetName = (faceDetail.name || '').replace(/null$/i, '').trim() || 'Unknown';

    const widgets = [
        {
            decoratedText: {
                topLabel: 'Target Name',
                text: `${targetName}  |  Similarity: ${faceDetail.similarity || '0'}%`,
            },
        },
        {
            decoratedText: {
                topLabel: 'Camera Location',
                text: faceDetail.deviceName || alarm.sourceName || alarm.sourceCode,
            },
        },
        {
            decoratedText: {
                topLabel: 'Detection Time',
                text: timeStr,
            },
        },
        {
            decoratedText: {
                topLabel: 'Target Type',
                text: faceDetail.repositoryName || alarm.alarmTypeName || 'Blocklist Group',
            },
        },
    ];

    if (detectionImageUrl) {
        widgets.push({ textParagraph: { text: '<b>Snapshot Image</b>' } });
        widgets.push({ image: { imageUrl: detectionImageUrl } });
    }

    if (repositoryImageUrl) {
        widgets.push({ textParagraph: { text: '<b>Reference Image</b>' } });
        widgets.push({ image: { imageUrl: repositoryImageUrl } });
    }

    widgets.push({
        textParagraph: {
            text: 'Action Required: Please dispatch security to the specified location immediately.\n\nStay safe!',
        },
    });

    return {
        cardsV2: [
            {
                cardId: `blacklist-alert-${alarm.alarmCode || Date.now()}`,
                card: {
                    header: {
                        title: 'Blacklist Detection Summary',
                        subtitle: dateStr,
                    },
                    sections: [{ widgets }],
                },
            },
        ],
    };
}

async function sendToGoogleChat(cardPayload) {
    await axios.post(config.googleChatWebhookUrl, cardPayload);
    console.log('[GChat] Notification sent to Google Chat successfully.');
}

module.exports = { formatBlacklistMessage, sendToGoogleChat };
