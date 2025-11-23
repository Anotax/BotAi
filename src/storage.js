// src/storage.js
const fs = require("fs");
const path = require("path");
const https = require("https");

const BASE_DIR = process.env.STORAGE_DIR || "/tmp/aichainart";

function ensureDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

/**
 * Save an image buffer to disk and return path + filename.
 */
async function saveImageBuffer(buffer, filenamePrefix = "image") {
  ensureDir();

  const filename = `${filenamePrefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.png`;

  const filePath = path.join(BASE_DIR, filename);
  await fs.promises.writeFile(filePath, buffer);

  return { filePath, filename };
}

/**
 * Download an image from a URL (e.g. Discord CDN) to a Buffer.
 */
async function downloadImageToBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          res.resume();
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

/**
 * Download an image from a URL and save it to disk.
 */
async function downloadImageToFile(url, filenamePrefix = "image") {
  ensureDir();

  const filename = `${filenamePrefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.png`;

  const filePath = path.join(BASE_DIR, filename);
  const fileStream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          res.resume();
          return;
        }

        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });

  return { filePath, filename };
}

function getImageReadStream(filePath) {
  return fs.createReadStream(filePath);
}

module.exports = {
  saveImageBuffer,
  downloadImageToBuffer,
  downloadImageToFile,
  getImageReadStream,
};
