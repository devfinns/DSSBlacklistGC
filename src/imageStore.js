const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dahuaClient = require('./dahuaClient');
const config = require('./config');
const { getCredential } = require('./auth');

const IMAGES_DIR = path.join(__dirname, '..', 'images');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function withCredential(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${getCredential()}`;
}

async function downloadAndSaveImage(dahuaImageUrl) {
    if (!dahuaImageUrl) {
        return null;
    }

    const response = await dahuaClient.get(withCredential(dahuaImageUrl), { responseType: 'arraybuffer' });
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
    const filePath = path.join(IMAGES_DIR, fileName);

    fs.writeFileSync(filePath, response.data);

    return `${config.publicBaseUrl}/images/${fileName}`;
}

// Experimental: fetch the image and return it as a base64 data URI instead of
// saving it to disk, to test whether Google Chat cardsV2 accepts data: URIs
// as an imageUrl value (no hosting/reachability required if it works).
async function fetchImageAsDataUri(dahuaImageUrl) {
    if (!dahuaImageUrl) {
        return null;
    }

    const response = await dahuaClient.get(withCredential(dahuaImageUrl), { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';

    return `data:${contentType};base64,${base64}`;
}

function cleanupOldImages() {
    const maxAgeMs = config.imageMaxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let removedCount = 0;

    for (const fileName of fs.readdirSync(IMAGES_DIR)) {
        const filePath = path.join(IMAGES_DIR, fileName);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            removedCount++;
        }
    }

    console.log(`[ImageStore] Cleanup complete. Removed ${removedCount} image(s) older than ${config.imageMaxAgeDays} days.`);
}

module.exports = { IMAGES_DIR, downloadAndSaveImage, fetchImageAsDataUri, cleanupOldImages };
