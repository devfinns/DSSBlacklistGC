const crypto = require('crypto');
const config = require('./config');
const dahuaClient = require('./dahuaClient');

let dahuaToken = '';
let keepAliveTimer = null;
let updateTokenTimer = null;

const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

function getToken() {
    return dahuaToken;
}

function clearTimers() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
    if (updateTokenTimer) {
        clearInterval(updateTokenTimer);
        updateTokenTimer = null;
    }
}

function scheduleKeepAlive() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
    }
    keepAliveTimer = setInterval(async () => {
        try {
            await dahuaClient.put(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/keepalive`, {
                token: dahuaToken,
            }, {
                headers: { 'X-Subject-Token': dahuaToken },
            });
        } catch (error) {
            console.error('[Auth] Keep-alive failed:', error.message);
        }
    }, 20 * 1000);
}

function scheduleTokenUpdate(tokenRateSeconds) {
    if (updateTokenTimer) {
        clearInterval(updateTokenTimer);
    }
    const intervalMs = Math.max(Math.floor((tokenRateSeconds || 1800) * (2 / 3)), 60) * 1000;
    updateTokenTimer = setInterval(async () => {
        try {
            const res = await dahuaClient.post(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/updateToken`, {}, {
                headers: { 'X-Subject-Token': dahuaToken },
            });
            dahuaToken = res.data.data.token;
            console.log('[Auth] Dahua token updated successfully.');
        } catch (error) {
            console.error('[Auth] Token update failed:', error.message);
        }
    }, intervalMs);
}

async function loginDahua() {
    try {
        await dahuaClient.post(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/authorize`, {
            userName: config.dahuaUsername,
        });
    } catch (error) {
        if (error.response && error.response.status === 401) {
            const { realm, randomKey } = error.response.data;

            const temp1 = md5(config.dahuaPassword);
            const temp2 = md5(config.dahuaUsername + temp1);
            const temp3 = md5(temp2);
            const temp4 = md5(`${config.dahuaUsername}:${realm}:${temp3}`);
            const signature = md5(`${temp4}:${randomKey}`);

            const loginRes = await dahuaClient.post(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/authorize`, {
                userName: config.dahuaUsername,
                randomKey,
                signature,
            });

            dahuaToken = loginRes.data.token;
            console.log('[Auth] Dahua login successful.');

            clearTimers();
            scheduleKeepAlive();
            scheduleTokenUpdate(loginRes.data.tokenRate);

            return dahuaToken;
        }

        console.error('[Auth] Dahua login failed:', error.message);
        if (error.response) {
            console.error('[Auth] Response status:', error.response.status);
            console.error('[Auth] Response body:', JSON.stringify(error.response.data));
        }
        throw error;
    }
}

module.exports = { loginDahua, getToken, md5 };
