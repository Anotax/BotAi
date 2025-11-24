// src/openaiClient.js
// Simple wrapper around the OpenAI Image API using axios.
// We use the /images/generations endpoint for text -> image
// and the /images/edits endpoint for image + prompt editing.

const axios = require("axios");
const FormData = require("form-data");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn(
    "[openaiClient] WARNING: OPENAI_API_KEY is not set. Image generation will fail until you set it."
  );
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";

/**
 * Generate an image from text.
 * Returns a Buffer (PNG).
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.size="1024x1024"]
 * @returns {Promise<Buffer>}
 */
async function generateImage({ prompt, size = "1024x1024" }) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await axios.post(
    `${OPENAI_BASE_URL}/images/generations`,
    {
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // in case of bigger responses
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  if (
    !response.data ||
    !Array.isArray(response.data.data) ||
    !response.data.data[0] ||
    !response.data.data[0].b64_json
  ) {
    throw new Error("Unexpected response format from OpenAI /images/generations");
  }

  const b64 = response.data.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

/**
 * Edit an existing image using a prompt.
 * Returns a Buffer (PNG).
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.size="1024x1024"]
 * @param {Buffer} params.imageBuffer - Image to edit.
 * @returns {Promise<Buffer>}
 */
async function editImage({ prompt, size = "1024x1024", imageBuffer }) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("editImage requires a valid imageBuffer (Buffer)");
  }

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", size);
  // The filename + content type help OpenAI correctly parse the file
  form.append("image", imageBuffer, {
    filename: "image.png",
    contentType: "image/png",
  });

  const response = await axios.post(
    `${OPENAI_BASE_URL}/images/edits`,
    form,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  if (
    !response.data ||
    !Array.isArray(response.data.data) ||
    !response.data.data[0] ||
    !response.data.data[0].b64_json
  ) {
    throw new Error("Unexpected response format from OpenAI /images/edits");
  }

  const b64 = response.data.data[0].b64_json;
  return Buffer.from(b64, "base64");
}

module.exports = {
  generateImage,
  editImage,
};
