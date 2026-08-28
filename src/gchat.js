const axios = require('axios');
const moment = require('moment');
const config = require('./config');

// Status line shown at the top of the card body: HIGH (red, >=90%), MEDIUM
// (yellow, 80-89%), or nothing at all below 80%. Header title/subtitle can't
// be colored in cardsV2, so this textParagraph (which supports <font color>)
// is the most prominent place that can actually render a color.
function getSimilarityStatusLine(similarity) {
    const value = Number(similarity);

    if (Number.isFinite(value) && value >= 90) {
        return '<font color="#E53935"><b>HIGH</b></font>';
    }
    if (Number.isFinite(value) && value >= 80) {
        return '<font color="#F9A825"><b>MEDIUM</b></font>';
    }
    return null;
}

function formatBlacklistMessage(faceDetail, alarm, imageUrls) {
    const alarmTimeSeconds = faceDetail.alarmTime || alarm.alarmTime;
    const momentValue = alarmTimeSeconds ? moment(Number(alarmTimeSeconds) * 1000) : moment();
    const dateStr = momentValue.format('YYYY-MM-DD');
    const timeStr = momentValue.format('HH:mm:ss');

    const detectionImageUrl = imageUrls.detectionImageUrl;
    const repositoryImageUrl = imageUrls.repositoryImageUrl;
    const targetName = (faceDetail.name || '').replace(/null$/i, '').trim() || 'Unknown';
    const statusLine = getSimilarityStatusLine(faceDetail.similarity || '0');

    const widgets = [];

    if (statusLine) {
        widgets.push({ textParagraph: { text: statusLine } });
    }

    widgets.push(
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
        }
    );

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
    const payloadSizeKb = (Buffer.byteLength(JSON.stringify(cardPayload)) / 1024).toFixed(1);
    console.log(`[GChat] Sending payload (${payloadSizeKb} KB)...`);

    try {
        await axios.post(config.googleChatWebhookUrl, cardPayload);
        console.log('[GChat] Notification sent to Google Chat successfully.');
    } catch (error) {
        if (error.response) {
            console.error('[GChat] Google Chat rejected the payload. Status:', error.response.status, 'Body:', JSON.stringify(error.response.data));
        }
        throw error;
    }
}

module.exports = { formatBlacklistMessage, sendToGoogleChat };
