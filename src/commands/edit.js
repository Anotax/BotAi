// src/commands/edit.js
const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an image with AI.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image to edit")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe how you want to change the image.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("size")
        .setDescription("Image size")
        .addChoices(
          { name: "1024x1024", value: "1024x1024" },
          { name: "512x512", value: "512x512" },
          { name: "256x256", value: "256x256" }
        )
    ),

  async execute(interaction, { openaiClient, storage }) {
    const imageAttachment = interaction.options.getAttachment("image", true);
    const promptText = interaction.options.getString("prompt", true);
    const size = interaction.options.getString("size") || "1024x1024";

    console.log(
      "[edit] /edit from",
      interaction.user.id,
      "attachment=",
      !!imageAttachment
    );

    await interaction.deferReply();

    try {
      // 1) Scarica l’immagine da Discord sul file system
      const { filePath: inputPath } = await storage.downloadImageToFile(
        imageAttachment.url,
        "edit-input"
      );

      // 2) Manda l’immagine + prompt a OpenAI per l’editing
      const editedBuffer = await openaiClient.editImage({
        prompt: promptText,
        imagePath: inputPath,
        size,
      });

      // 3) Salva il risultato
      const { filePath: outputPath, filename } = await storage.saveImageBuffer(
        editedBuffer,
        "edit-output"
      );

      // 4) Rimanda l’immagine editata su Discord
      const attachment = new AttachmentBuilder(outputPath, { name: filename });

      await interaction.editReply({
        content: `Edit prompt: ${promptText}`,
        files: [attachment],
      });
    } catch (err) {
      console.error("[edit] Error while editing image:", err);
      await interaction.editReply(
        "An error occurred while editing the image. Please check your prompt and input image, then try again."
      );
    }
  },
};
