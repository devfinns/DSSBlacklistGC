const dahuaClient = require('./dahuaClient');
const { getCredential, loginDahua } = require('./auth');

// Dahua image URLs (10.62.21.254) are only reachable from the internal
// network, so Google Chat's servers cannot fetch them directly for the
// imageUrl field. We fetch the image ourselves and embed it as a base64
// data URI instead. Note: Google Chat's ~32KB total message size limit
// means this can fail for larger original photos — no resizing/compression
// is applied here, so very large snapshots may still get rejected.
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

async function fetchImageAsDataUri(dahuaImageUrl) {
    if (!dahuaImageUrl) {
        return null;
    }

    const response = await fetchImageBuffer(dahuaImageUrl);
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';

    console.log(`[DahuaImageFetcher] Fetched image: ${response.data.length} bytes (base64: ${base64.length} chars).`);

    return `data:${contentType};base64,${base64}`;
}

module.exports = { fetchImageAsDataUri };
