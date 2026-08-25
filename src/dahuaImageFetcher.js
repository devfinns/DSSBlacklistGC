const dahuaClient = require('./dahuaClient');
const { getCredential, loginDahua } = require('./auth');

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

// Fetches the image and returns it as a base64 data URI, embedded directly in
// the Google Chat card payload. No local storage or public hosting required.
async function fetchImageAsDataUri(dahuaImageUrl) {
    if (!dahuaImageUrl) {
        return null;
    }

    const response = await fetchImageBuffer(dahuaImageUrl);
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';

    return `data:${contentType};base64,${base64}`;
}

module.exports = { fetchImageAsDataUri };
