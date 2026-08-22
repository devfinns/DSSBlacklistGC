const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

let dahuaToken = '';

const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

function getToken() {
    return dahuaToken;
}

async function loginDahua() {
    try {
        await axios.post(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/authorize`, {
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

            const loginRes = await axios.post(`${config.dahuaBaseUrl}/brms/api/v1.0/accounts/authorize`, {
                userName: config.dahuaUsername,
                randomKey,
                signature,
            });

            dahuaToken = loginRes.data.token;
            console.log('[Auth] Dahua login successful.');
            return dahuaToken;
        }

        console.error('[Auth] Dahua login failed:', error.message);
        throw error;
    }
}

module.exports = { loginDahua, getToken, md5 };
