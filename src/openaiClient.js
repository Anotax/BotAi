const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const config = require("./config");

if (!process.env.OPENAI_API_KEY) {
  console.warn("[OpenAI] OPENAI_API_KEY non configurata. Il bot non potrà generare immagini.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generazione immagine from-scratch
async function generateImage(prompt) {
  const fullPrompt = `${prompt}\n\nStile: illustrazione digitale di qualità standard, dettagliata e leggibile, adatta alla condivisione online.`;

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: fullPrompt,
    size: config.IMAGE_SIZE,
    quality: config.IMAGE_QUALITY,
  });

  const imageBase64 = result.data[0].b64_json;
  return Buffer.from(imageBase64, "base64");
}

// Edit/variation a partire da un buffer immagine
async function editImageFromBuffer(imageBuffer, filename, prompt) {
  const file = await toFile(imageBuffer, filename || "image.png");

  const fullPrompt = `${prompt}\n\nMantieni il contenuto principale dell'immagine originale, applicando soltanto le modifiche richieste.`;

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
