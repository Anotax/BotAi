// src/openaiClient.js
const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn(
    "[openaiClient] WARNING: OPENAI_API_KEY is not set. Image generation will fail until you set it."
  );
}

const client = new OpenAI({ apiKey });

/**
 * Generate an image from text.
 * Returns a Buffer (PNG).
 */
async function generateImage({ prompt, size = "1024x1024" }) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size,
    response_format: "b64_json"
  });

  const b64 = response.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

/**
 * Edit an existing image.
 * `imageBuffer` must contain the bytes of the input image.
 * Returns a Buffer (PNG).
 */
async function editImage({ prompt, size = "1024x1024", imageBuffer }) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!imageBuffer) {
    throw new Error("editImage called without imageBuffer");
  }

  // L’SDK supporta direttamente Buffer come file input
  const response = await client.images.edit({
    model: "gpt-image-1",
    image: imageBuffer,
    prompt,
    n: 1,
    size,
    response_format: "b64_json"
  });

  const b64 = response.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

module.exports = {
  generateImage,
  editImage
};
