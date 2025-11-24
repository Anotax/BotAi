// src/storage.js
const axios = require("axios");

/**
 * Download a Discord attachment and return it as a Buffer.
 */
async function downloadDiscordAttachment(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

module.exports = {
  downloadDiscordAttachment
};
