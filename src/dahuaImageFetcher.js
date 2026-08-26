const { getCredential } = require('./auth');

// Google Chat's imageUrl field only accepts an HTTPS URL it can fetch itself
// (confirmed via official docs: no support for data: URIs, and a 32KB total
// message size limit that base64-encoded images blow past anyway). So we
// return a direct link to the Dahua image with the session credential
// appended, instead of embedding the image data.
function withImageCredential(dahuaImageUrl) {
    if (!dahuaImageUrl) {
        return null;
    }
    const separator = dahuaImageUrl.includes('?') ? '&' : '?';
    return `${dahuaImageUrl}${separator}token=${getCredential()}`;
}

module.exports = { withImageCredential };
