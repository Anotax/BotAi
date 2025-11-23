// src/openaiClient.js
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const config = require("./config");

let openai = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.warn(
    "[OpenAI] OPENAI_API_KEY is not set. Image generation will fail until it is provided."
  );
}

function ensureClient() {
  if (!openai) {
    const err = new Error(
      "The OpenAI API key is not configured on the server."
    );
    err.code = "NO_OPENAI_API_KEY";
    throw err;
  }
}

async function generateImage(prompt) {
  ensureClient();

  const fullPrompt = `${prompt}\n\nStyle: high-quality digital illustration, detailed but clear, safe for work and suitable for sharing on Discord.`;

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: fullPrompt,
    size: config.IMAGE_SIZE,
    quality: config.IMAGE_QUALITY,
  });

  const imageBase64 = result.data[0].b64_json;
  return Buffer.from(imageBase64, "base64");
}

async function editImageFromBuffer(imageBuffer, filename, prompt) {
  ensureClient();

  const file = await toFile(imageBuffer, filename || "image.png");

  const fullPrompt = `${prompt}\n\nKeep the main content of the original image and apply only the requested changes.`;

  const result = await openai.images.edit({
    model: "gpt-image-1",
    image: [file],
    prompt: fullPrompt,
    size: config.IMAGE_SIZE,
    quality: config.IMAGE_QUALITY,
  });

  const imageBase64 = result.data[0].b64_json;
  return Buffer.from(imageBase64, "base64");
}

module.exports = {
  generateImage,
  editImageFromBuffer,
};
