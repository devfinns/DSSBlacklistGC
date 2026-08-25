const axios = require('axios');
const moment = require('moment');
const config = require('./config');

// Header badge color by similarity tier: 90%+ = pink/red, 80-89% = light yellow, anything else = gray.
// Rendered as a solid-color circle SVG encoded as a data URI (no external hosting needed).
function getSimilarityBadgeIcon(similarity) {
    const value = Number(similarity);

    let color = '#9E9E9E';
    if (Number.isFinite(value) && value >= 90) {
        color = '#FF69B4';
    } else if (Number.isFinite(value) && value >= 80) {
        color = '#FFF59D';
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}"/></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function formatBlacklistMessage(faceDetail, alarm, imageUrls) {
    const alarmTimeSeconds = faceDetail.alarmTime || alarm.alarmTime;
    const momentValue = alarmTimeSeconds ? moment(Number(alarmTimeSeconds) * 1000) : moment();
    const dateStr = momentValue.format('YYYY-MM-DD');
    const timeStr = momentValue.format('HH:mm:ss');

    const detectionImageUrl = imageUrls.detectionImageUrl;
    const repositoryImageUrl = imageUrls.repositoryImageUrl;
    const targetName = (faceDetail.name || '').replace(/null$/i, '').trim() || 'Unknown';
    const similarityBadgeIcon = getSimilarityBadgeIcon(faceDetail.similarity || '0');

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
                        imageUrl: similarityBadgeIcon,
                        imageType: 'CIRCLE',
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
