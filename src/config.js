require('dotenv').config();

const required = [
    'DAHUA_BASE_URL',
    'DAHUA_USERNAME',
    'DAHUA_PASSWORD',
    'GOOGLE_CHAT_WEBHOOK_URL',
    'MIDDLEWARE_WEBHOOK_URL',
];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Configuration ${key} is not set. Check your .env file (see .env.example).`);
    }
}

module.exports = {
    dahuaBaseUrl: process.env.DAHUA_BASE_URL,
    dahuaUsername: process.env.DAHUA_USERNAME,
    dahuaPassword: process.env.DAHUA_PASSWORD,
    googleChatWebhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL,
    middlewarePort: process.env.MIDDLEWARE_PORT || 3000,
    middlewareWebhookUrl: process.env.MIDDLEWARE_WEBHOOK_URL,
    dahuaSubscribeSignature: process.env.DAHUA_SUBSCRIBE_SIGNATURE || 'random_string_123',
};
