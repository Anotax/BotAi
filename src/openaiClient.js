// src/openaiClient.js
// Wrapper minimal per le Image API di OpenAI usando axios.

const axios = require("axios");
const FormData = require("form-data");

const apiKey = process.env.OPENAI_API_KEY;
const BASE_URL = "https://api.openai.com/v1";

if (!apiKey) {
  console.warn(
    "[openaiClient] WARNING: OPENAI_API_KEY is not set. Image generation will fail until you set it."
  );
}

function buildAuthHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

function wrapOpenAIError(err, context) {
  let detail = "";

  // Error HTTP da OpenAI
  if (err.response && err.response.data && err.response.data.error) {
    const e = err.response.data.error;
    detail = `${e.type || "openai_error"}: ${e.message || "Unknown error"}`;
  } else if (err.message) {
    // Error di rete / runtime
    detail = err.message;
  } else {
    detail = String(err);
  }

  const wrapped = new Error(`[${context}] ${detail}`);
  wrapped.originalError = err;
  return wrapped;
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
        size,
        // response_format opzionale; lasciamo b64_json perché è comodo
        response_format: "b64_json",
      },
      {
        headers: {
          ...buildAuthHeaders({
            "Content-Type": "application/json",
          }),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    if (
      !res.data ||
      !Array.isArray(res.data.data) ||
      !res.data.data[0] ||
      !res.data.data[0].b64_json
    ) {
      throw new Error("Unexpected response format from /images/generations");
    }

    const b64 = res.data.data[0].b64_json;
    return Buffer.from(b64, "base64");
  } catch (err) {
    throw wrapOpenAIError(err, "generateImage");
  }
}

/**
 * Edit an existing image with a prompt.
 * Returns a Buffer (PNG).
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {Buffer} params.imageBuffer
 * @param {string} [params.size="1024x1024"]
 */
async function editImage({ prompt, size = "1024x1024", imageBuffer }) {
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
    form.append("image", imageBuffer, {
      filename: "image.png",
      contentType: "image/png",
    });

    const res = await axios.post(`${BASE_URL}/images/edits`, form, {
      headers: {
        ...buildAuthHeaders(form.getHeaders()),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (
      !res.data ||
      !Array.isArray(res.data.data) ||
      !res.data.data[0] ||
      (!res.data.data[0].b64_json && !res.data.data[0].url)
    ) {
      throw new Error("Unexpected response format from /images/edits");
    }

    // Preferiamo b64_json se disponibile, altrimenti scarichiamo la URL
    if (res.data.data[0].b64_json) {
      const b64 = res.data.data[0].b64_json;
      return Buffer.from(b64, "base64");
    }

    const url = res.data.data[0].url;
    const img = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(img.data);
  } catch (err) {
    throw wrapOpenAIError(err, "editImage");
  }
}

module.exports = {
  generateImage,
  editImage,
};
