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
    // Public-facing base URL used to build image links (e.g. https://your-domain.com).
    // Until public access is set up, images are saved locally but links will not be reachable from Google Chat.
    publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.MIDDLEWARE_WEBHOOK_URL.replace(/\/api\/dahua\/push$/, ''),
    imageMaxAgeHours: Number(process.env.IMAGE_MAX_AGE_HOURS) || 1,
};
