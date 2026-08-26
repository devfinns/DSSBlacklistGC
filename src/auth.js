const crypto = require('crypto');
const config = require('./config');
const dahuaClient = require('./dahuaClient');

let dahuaToken = '';
let dahuaCredential = '';
let keepAliveTimer = null;
let updateTokenTimer = null;

const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

function getToken() {
    return dahuaToken;
}

function getCredential() {
    return dahuaCredential;
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

const KEEP_ALIVE_FAILURE_THRESHOLD = 3;
let keepAliveFailureCount = 0;

function scheduleKeepAlive() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
    }
    keepAliveFailureCount = 0;
    keepAliveTimer = setInterval(async () => {
        try {
            const res = await dahuaClient.put(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/keepalive`, {
                token: dahuaToken,
            }, {
                headers: { 'X-Subject-Token': dahuaToken },
            });

            if (res.data && res.data.code === 7000) {
                throw new Error('Keep-alive rejected with code 7000 (Auth failed)');
            }

            // The credential used to access image URLs expires much faster than
            // the token, so it must be refreshed on the same cadence as keep-alive,
            // not just on the much slower token-update cycle.
            if (res.data && res.data.data && res.data.data.credential) {
                dahuaCredential = res.data.data.credential;
            }

            keepAliveFailureCount = 0;
        } catch (error) {
            keepAliveFailureCount++;
            console.error(`[Auth] Keep-alive failed (${keepAliveFailureCount}/${KEEP_ALIVE_FAILURE_THRESHOLD}):`, error.message);

            if (keepAliveFailureCount >= KEEP_ALIVE_FAILURE_THRESHOLD) {
                console.warn('[Auth] Keep-alive failed repeatedly, falling back to full re-login.');
                keepAliveFailureCount = 0;
                try {
                    await loginDahua();
                } catch (loginError) {
                    console.error('[Auth] Re-login fallback also failed:', loginError.message);
                }
            }
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

            const newToken = res.data && res.data.data && res.data.data.token;
            if (!newToken) {
                throw new Error(`Unexpected updateToken response: ${JSON.stringify(res.data)}`);
            }

            dahuaToken = newToken;
            if (res.data.data.credential) {
                dahuaCredential = res.data.data.credential;
                console.log('[Auth] Dahua token and credential updated successfully.');
            } else {
                console.log('[Auth] Dahua token updated successfully (no credential in response).');
            }
        } catch (error) {
            console.error('[Auth] Token update failed, falling back to full re-login:', error.message);
            try {
                await loginDahua();
            } catch (loginError) {
                console.error('[Auth] Re-login fallback also failed:', loginError.message);
            }
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
            dahuaCredential = loginRes.data.credential;
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

// Wraps a Dahua API call: if the response body carries code 7000 (Auth failed),
// re-login once and retry the call with the refreshed token. This closes the gap
// between keep-alive/update-token cycles where a request can still hit an
// already-expired token.
async function withAuthRetry(requestFn) {
    const res = await requestFn();

    if (res.data && res.data.code === 7000) {
        console.warn('[Auth] Request failed with code 7000 (Auth failed). Re-logging in and retrying once.');
        await loginDahua();
        return requestFn();
    }

    return res;
}

module.exports = { loginDahua, getToken, getCredential, withAuthRetry, md5 };
