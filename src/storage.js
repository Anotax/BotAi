const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "data");
const imagesDir = path.join(dataDir, "images");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

function saveImageForUser(userId, buffer) {
  const fileName = `${userId}_${Date.now()}.png`;
  const fullPath = path.join(imagesDir, fileName);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

function loadImageBuffer(imagePath) {
  return fs.readFileSync(imagePath);
}

module.exports = {
  saveImageForUser,
  loadImageBuffer,
  imagesDir,
};
