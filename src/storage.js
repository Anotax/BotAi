// src/storage.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const OUTPUT_DIR =
  process.env.IMAGE_OUTPUT_DIR || path.join(__dirname, "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function saveImageBuffer(buffer, prefix = "image") {
  const fileName = `${prefix}-${Date.now()}.png`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.promises.writeFile(filePath, buffer);
  return { fileName, filePath };
}

async function downloadAttachmentToBuffer(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
}

module.exports = {
  saveImageBuffer,
  downloadAttachmentToBuffer,
  OUTPUT_DIR,
};
