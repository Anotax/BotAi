const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Genera una nuova immagine tramite AI")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Descrivi l'immagine che vuoi generare")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Immagine di partenza (opzionale)")
        .setRequired(false)
    ),

  async execute(interaction, { openaiClient, storage, db, limits, config, sendStaffLog }) {
    const userId = interaction.user.id;
    const promptText = interaction.options.getString("prompt", true);
    const attachment = interaction.options.getAttachment("image");

    console.log(`[prompt] /prompt da ${userId}, attachment=${!!attachment}`);

    const limitCheck = limits.canGenerate(userId);
    if (!limitCheck.allowed) {
      let msg;
      if (limitCheck.code === "DAILY_LIMIT") {
        msg = `Hai già generato il numero massimo di immagini consentite per oggi (${config.MAX_DAILY_IMAGES_PER_USER}). Riprova domani.`;
      } else if (limitCheck.code === "BUDGET_EXCEEDED") {
        msg = "Il budget mensile stimato per le immagini è esaurito. Contatta lo staff se pensi si tratti di un errore.";
      } else {
        msg = "Al momento non posso generare altre immagini per via dei limiti configurati.";
      }
      await interaction.reply({ content: msg, ephemeral: true });
      await sendStaffLog?.(`⚠️ Utente <@${userId}> bloccato da /prompt per superamento limiti (${limitCheck.code}).`);
      return;
    }

    await interaction.deferReply();

    try {
      let buffer;
      let sourceType;

      if (!attachment) {
        // Generazione da zero
        buffer = await openaiClient.generateImage(promptText);
        sourceType = "base";
      } else {
        // Trasformazione immagine caricata
        const imageResponse = await fetch(attachment.url);
        if (!imageResponse.ok) {
          throw new Error(`Impossibile scaricare l'immagine di input (status ${imageResponse.status})`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        buffer = await openaiClient.editImageFromBuffer(
          imageBuffer,
          attachment.name || "input.png",
          promptText
        );
        sourceType = "edit";
      }

      const imagePath = storage.saveImageForUser(userId, buffer);

      const generation = db.insertGeneration({
        userId,
        prompt: promptText,
        imagePath,
        sourceType,
        parentGenerationId: null,
      });

      db.pruneGenerationsForUser(userId, config.HISTORY_PER_USER);

      const file = new AttachmentBuilder(buffer, { name: `image_${generation.id}.png` });

      await interaction.editReply({
        content: `Ecco la tua immagine!\n\n**Prompt usato:** ${promptText}`,
        files: [file],
      });

      await sendStaffLog?.(
        `✅ Nuova generazione immagine (#${generation.id}) per <@${userId}> tramite /prompt. ` +
          `Usate oggi: ${limitCheck.usedToday + 1}/${config.MAX_DAILY_IMAGES_PER_USER}.`
      );
    } catch (error) {
      console.error("[prompt] Errore durante la generazione immagine:", error);
      await interaction.editReply({
        content:
          "Si è verificato un errore durante la generazione dell'immagine. " +
          "Assicurati che il prompt e l'eventuale immagine di partenza siano validi e riprova.",
      });
      await sendStaffLog?.(
        `❌ Errore /prompt per <@${userId}>: \`${error.message}\``
      );
    }
  },
};
