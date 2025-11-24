// src/openaiClient.js
// Wrapper per le Image API di OpenAI usando axios (niente SDK).
// Supporta:
//  - generateImage(prompt, size)
//  - editImage(imageBuffer, prompt, size)

const axios = require("axios");
const FormData = require("form-data");

const apiKey = process.env.OPENAI_API_KEY;
const BASE_URL = "https://api.openai.com/v1";

if (!apiKey) {
  console.warn(
    "[openaiClient] WARNING: OPENAI_API_KEY is not set. Image generation will fail until you set it."
  );
}

function normalizeOpenAIError(err, context) {
  // Provo a ricavare un messaggio utile
  if (err.response && err.response.data && err.response.data.error) {
    const e = err.response.data.error;
    const msg = `${context}: ${e.type || "openai_error"}: ${
      e.message || "Unknown error"
    }`;
    const wrapped = new Error(msg);
    wrapped.originalError = err;
    return wrapped;
  }

  if (err.message) {
    const wrapped = new Error(`${context}: ${err.message}`);
    wrapped.originalError = err;
    return wrapped;
  }

  return new Error(`${context}: ${String(err)}`);
}

/**
 * Generate an image from text.
 * Returns a Buffer (PNG).
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.size="1024x1024"]
 */
async function generateImage({ prompt, size = "1024x1024" }) {
  if (!apiKey) {
    throw new Error("[generateImage] OPENAI_API_KEY is not set");
  }

  try {
    const res = await axios.post(
      `${BASE_URL}/images/generations`,
      {
        model: "gpt-image-1",
        prompt,
        n: 1,
        size
        // niente response_format: l'API torna già b64_json di default
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    if (
      !res.data ||
      !Array.isArray(res.data.data) ||
      !res.data.data[0]
    ) {
      throw new Error("Unexpected response format from /images/generations");
    }

    const item = res.data.data[0];

    if (item.b64_json) {
      return Buffer.from(item.b64_json, "base64");
    }

    if (item.url) {
      // fallback nel caso qualche account restituisca URL
      const img = await axios.get(item.url, { responseType: "arraybuffer" });
      return Buffer.from(img.data);
    }

    throw new Error(
      "Image response has neither b64_json nor url fields from /images/generations"
    );
  } catch (err) {
    throw normalizeOpenAIError(err, "generateImage");
  }
}

/**
 * Edit an existing image.
 * Returns a Buffer (PNG).
 *
 * @param {Object} params
 * @param {Buffer} params.imageBuffer
 * @param {string} params.prompt
 * @param {string} [params.size="1024x1024"]
 */
async function editImage({ imageBuffer, prompt, size = "1024x1024" }) {
  if (!apiKey) {
    throw new Error("[editImage] OPENAI_API_KEY is not set");
  }
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("[editImage] imageBuffer must be a Buffer");
  }

  try {
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", size);
    // niente n e niente response_format
    form.append("image", imageBuffer, {
      filename: "image.png",
      contentType: "image/png"
    });

    const res = await axios.post(`${BASE_URL}/images/edits`, form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (
      !res.data ||
      !Array.isArray(res.data.data) ||
      !res.data.data[0]
    ) {
      throw new Error("Unexpected response format from /images/edits");
    }

    const item = res.data.data[0];

    if (item.b64_json) {
      return Buffer.from(item.b64_json, "base64");
    }

    if (item.url) {
      const img = await axios.get(item.url, { responseType: "arraybuffer" });
      return Buffer.from(img.data);
    }

    throw new Error(
      "Image response has neither b64_json nor url fields from /images/edits"
    );
  } catch (err) {
    throw normalizeOpenAIError(err, "editImage");
  }
}

module.exports = {
  generateImage,
  editImage
};
