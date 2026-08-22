const axios = require('axios');
const config = require('./config');
const { getToken } = require('./auth');

async function addPersonToBlacklist(personId, firstName, base64Image) {
    const payload = {
        baseInfo: {
            personId,
            firstName,
            gender: '1',
            orgCode: '001',
            facePictures: [base64Image],
            source: '0',
        },
        accessInfo: {
            accessType: '1', // 1 = Blocklist / Blacklist
        },
        faceComparisonInfo: {
            enableFaceComparisonGroup: '1',
            faceComparisonGroupId: '1',
        },
        authenticationInfo: {
            startTime: Math.floor(Date.now() / 1000).toString(),
            endTime: '2031443199',
        },
    };

    const res = await axios.post(`${config.dahuaBaseUrl}/obms/api/v1.1/acs/person`, payload, {
        headers: { 'X-Subject-Token': getToken() },
    });
    console.log('[Dahua] Successfully added person to Blacklist:', res.data);
    return res.data;
}

async function subscribeAlarm() {
    const payload = {
        callbackUrl: config.middlewareWebhookUrl,
        action: '1',
        signature: config.dahuaSubscribeSignature,
    };

    const res = await axios.post(`${config.dahuaBaseUrl}/brms/api/v1.1/push-data/alarm/subscribe`, payload, {
        headers: { 'X-Subject-Token': getToken() },
    });
    console.log('[Dahua] Successfully subscribed to alarm notifications:', res.data);
    return res.data;
}

async function getAlarmFaceRecognitionInfo(alarmCode, deviceCode) {
    const res = await axios.post(
        `${config.dahuaBaseUrl}/eams/api/v1.0/BRM/Alarm/GetAlarmFaceRecognitionInfo`,
        {
            data: {
                alarmCode,
                alarmDate: Math.floor(Date.now() / 1000).toString(),
                deviceCode,
            },
        },
        {
            headers: { 'X-Subject-Token': getToken() },
        }
    );
    return res.data.data;
}

module.exports = { addPersonToBlacklist, subscribeAlarm, getAlarmFaceRecognitionInfo };
