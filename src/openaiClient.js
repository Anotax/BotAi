const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const config = require("./config");

// Non usare mai chiavi hardcodate qui.
// Il valore deve arrivare da process.env.OPENAI_API_KEY
let openai = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn(
    "[OpenAI] OPENAI_API_KEY non configurata. Il bot rimarrà online, " +
      "ma i comandi di generazione immagini falliranno finché non imposti la variabile d'ambiente."
  );
}

// Utility per assicurarsi che il client esista prima di chiamare le API
function ensureClient() {
  if (!openai) {
    const err = new Error(
      "OPENAI_API_KEY non configurata sul server. Contatta lo staff: l'AI immagini non è al momento disponibile."
    );
    err.code = "NO_OPENAI_API_KEY";
    throw err;
  }
}

// Generazione immagine from-scratch
async function generateImage(prompt) {
  ensureClient();

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
  ensureClient();

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
