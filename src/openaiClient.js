const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn(
    "[openaiClient] WARNING: OPENAI_API_KEY is not set. Image generation will fail until you configure it."
  );
}

const client = new OpenAI({
  apiKey,
});

/**
 * Generate one image from a text prompt using gpt-image-1.
 *
 * @param {{ prompt: string, size?: "1024x1024" | "1024x1792" | "1792x1024" }} options
 * @returns {Promise<string>} base64 image (b64_json)
 */
async function generateImage({ prompt, size = "1024x1024" }) {
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size,
  });

  const data = response.data?.[0];
  if (!data || !data.b64_json) {
    throw new Error("OpenAI did not return image data.");
  }

  return data.b64_json;
}

module.exports = {
  generateImage,
};
