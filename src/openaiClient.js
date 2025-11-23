// src/openaiClient.js
const OpenAI = require("openai");
const fs = require("fs");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn(
    "[OpenAI] Warning: OPENAI_API_KEY is not set. Image generation will fail."
  );
}

const client = new OpenAI({ apiKey });

/**
 * Generate a new image from a text prompt.
 * Returns a Buffer with PNG data.
 */
async function generateImage({ prompt, size = "1024x1024" }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });

  const b64 = result.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

/**
 * Edit an existing image using a text prompt.
 * imagePath is a path on disk (PNG, JPG…).
 * Returns a Buffer with PNG data.
 */
async function editImage({ prompt, imagePath, size = "1024x1024" }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const imageStream = fs.createReadStream(imagePath);

  const result = await client.images.edit({
    model: "gpt-image-1",
    image: imageStream,
    prompt,
    size,
  });

  const b64 = result.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

module.exports = {
  generateImage,
  editImage,
};
