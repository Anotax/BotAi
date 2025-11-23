const OpenAI = require("openai");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "[openaiClient] WARNING: OPENAI_API_KEY is not set. The bot will not be able to generate images."
  );
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a brand new image from a text prompt.
 * Returns a Buffer containing PNG data.
 */
async function generateImage({ prompt, size = "1024x1024", userId }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    user: userId,
  });

  const img = response.data?.[0];
  if (!img || !img.b64_json) {
    throw new Error("Invalid image response from OpenAI.");
  }

  return Buffer.from(img.b64_json, "base64");
}

/**
 * Edit an existing image using a prompt.
 * Takes a Buffer with the original image and returns a Buffer (PNG).
 */
async function editImage({ prompt, imageBuffer, size = "1024x1024", userId }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  // The JS SDK accepts file streams for the `image` field.
  // We write the buffer to a temp file and pass a read stream.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aichainart-"));
  const inputPath = path.join(tmpDir, "input.png");
  fs.writeFileSync(inputPath, imageBuffer);

  try {
    const imageStream = fs.createReadStream(inputPath);

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      user: userId,
      image: imageStream,
    });

    const img = response.data?.[0];
    if (!img || !img.b64_json) {
      throw new Error("Invalid image response from OpenAI (edit).");
    }

    return Buffer.from(img.b64_json, "base64");
  } finally {
    // Best-effort cleanup of temp files
    fs.unlink(inputPath, () => {});
    fs.rmdir(tmpDir, () => {});
  }
}

module.exports = {
  generateImage,
  editImage,
};
