// src/commands/edit.js
const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing image with AI.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image you want to edit")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe how the image should be edited")
        .setRequired(true)
    ),

  /**
   * /edit execution
   */
  async execute(interaction, { openaiClient, storage }) {
    const attachment = interaction.options.getAttachment("image", true);
    const prompt = interaction.options.getString("prompt", true);

    // Discord image must be actually an image file
    if (!attachment.contentType || !attachment.contentType.startsWith("image/")) {
      await interaction.reply({
        content: "Please upload a valid image file.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Download the image from Discord to a Buffer
      const imageBuffer = await storage.downloadAttachmentToBuffer(
        attachment.url
      );

      // Ask OpenAI to edit it
      const editedImageBuffer = await openaiClient.editImage({
        imageBuffer,
        prompt,
      });

      const fileName = `edited-${Date.now()}.png`;
      const file = new AttachmentBuilder(editedImageBuffer, { name: fileName });

      await interaction.editReply({
        content: "Here is your edited image:",
        files: [file],
      });
    } catch (err) {
      console.error("[edit] Error while editing image:", err);
      const message =
        "An error occurred while editing the image. Please check your prompt and input image, then try again.";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  },
};
