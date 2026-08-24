const { parseStringPromise } = require('xml2js');

async function parseAlarmXml(xmlText) {
    const parsed = await parseStringPromise(xmlText, { explicitArray: false, explicitRoot: false });

    const alarmPictures = parsed.alarmPictures && parsed.alarmPictures.alarmPictures;
    const snapshotUrl = Array.isArray(alarmPictures) ? alarmPictures[0] : alarmPictures;

    return {
        callbackType: parsed.callbackType,
        alarmCode: parsed.alarmCode,
        sourceCode: parsed.sourceCode,
        sourceName: parsed.sourceName,
        alarmType: parsed.alarmType,
        alarmTypeName: parsed.alarmTypeName,
        alarmTime: parsed.alarmTime,
        snapshotUrl,
    };
}

module.exports = { parseAlarmXml };
