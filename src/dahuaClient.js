const axios = require('axios');
const https = require('https');

// Dahua DSS on-prem servers commonly use self-signed certificates.
const dahuaClient = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

module.exports = dahuaClient;
