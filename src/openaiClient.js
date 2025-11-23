// src/openaiClient.js
require("dotenv").config();
const OpenAI = require("openai");
const { toFile } = require("openai");
const { Readable } = require("stream");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Text → Image
 * Returns a Buffer with PNG data.
 */
async function generateImage({
  prompt,
  size = "1024x1024",
  quality = "high",
  response_format = "b64_json",
}) {
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    quality,
    response_format,
  });

  const b64 = result.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

/**
 * Helper: turn a Buffer into a Readable stream (required by toFile).
 */
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Image → Edited image
 * Takes a Buffer of the original image and returns a Buffer of the edited PNG.
 * Mask is optional (for inpainting).
 */
async function editImage({
  imageBuffer,
  maskBuffer = null,
  prompt,
  size = "1024x1024",
  quality = "high",
  response_format = "b64_json",
}) {
  if (!imageBuffer) {
    throw new Error("editImage: imageBuffer is required");
  }
  if (!prompt) {
    throw new Error("editImage: prompt is required");
  }

  // Convert buffers to File objects understood by the OpenAI SDK
  const imageFile = await toFile(bufferToStream(imageBuffer), "image.png", {
    type: "image/png",
  });

  let maskFile;
  if (maskBuffer) {
    maskFile = await toFile(bufferToStream(maskBuffer), "mask.png", {
      type: "image/png",
    });
  }

  const result = await client.images.edit({
    model: "gpt-image-1",
    image: imageFile,
    ...(maskFile ? { mask: maskFile } : {}),
    prompt,
    size,
    quality,
    response_format,
  });

  const b64 = result.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

module.exports = {
  client,
  generateImage,
  editImage,
};
