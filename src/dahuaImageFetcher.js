const sharp = require('sharp');
const dahuaClient = require('./dahuaClient');
const { getCredential, loginDahua } = require('./auth');

// Google Chat's total message size limit is 32,000 bytes (including cardsV2),
// and imageUrl only accepts HTTPS URLs per official docs — no data: URI support.
// Since Dahua image URLs are not reliably fetchable by Google's servers in all
// cases, we fetch the image ourselves, aggressively downscale/compress it, and
// embed it as a base64 data URI small enough to fit two images in one message.
const MAX_DIMENSION_PX = 160;
const JPEG_QUALITY = 40;

function withCredential(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${getCredential()}`;
}

// Dahua returns image URL failures as a small JSON body (e.g. {"code":7000,...})
// instead of an HTTP error, even though the response type is arraybuffer.
function isAuthFailureBuffer(buffer) {
    if (!buffer || buffer.length > 500) {
        return false;
    }
    try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        return parsed && parsed.code === 7000;
    } catch {
        return false;
    }
}

async function fetchImageBuffer(dahuaImageUrl) {
    let response = await dahuaClient.get(withCredential(dahuaImageUrl), { responseType: 'arraybuffer' });

    if (isAuthFailureBuffer(response.data)) {
        console.warn('[DahuaImageFetcher] Image fetch failed with code 7000 (Auth failed). Re-logging in and retrying once.');
        await loginDahua();
        response = await dahuaClient.get(withCredential(dahuaImageUrl), { responseType: 'arraybuffer' });
    }

    return response;
}

// Fetches the image, downscales/compresses it, and returns it as a base64
// data URI embedded directly in the Google Chat card payload.
async function fetchImageAsDataUri(dahuaImageUrl) {
    if (!dahuaImageUrl) {
        return null;
    }

    const response = await fetchImageBuffer(dahuaImageUrl);

    const resized = await sharp(response.data)
        .resize({ width: MAX_DIMENSION_PX, height: MAX_DIMENSION_PX, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

    const base64 = resized.toString('base64');
    console.log(`[DahuaImageFetcher] Compressed image: ${response.data.length} bytes -> ${resized.length} bytes (base64: ${base64.length} chars).`);

    return `data:image/jpeg;base64,${base64}`;
}

module.exports = { fetchImageAsDataUri };
