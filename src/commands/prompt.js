// src/commands/prompt.js
const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Generate an image from a text prompt.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Description of the image you want.")
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
    const promptText = interaction.options.getString("prompt", true);
    const size = interaction.options.getString("size") || "1024x1024";

    console.log(
      "[prompt] /prompt from",
      interaction.user.id,
      "attachment=false"
    );

    await interaction.deferReply();

    try {
      // Ask OpenAI for an image
      const imageBuffer = await openaiClient.generateImage({
        prompt: promptText,
        size,
      });

      // Save it to disk
      const { filePath, filename } = await storage.saveImageBuffer(
        imageBuffer,
        "gen"
      );

      // Send it back to Discord
      const attachment = new AttachmentBuilder(filePath, { name: filename });

      await interaction.editReply({
        content: `Prompt: ${promptText}`,
        files: [attachment],
      });
    } catch (err) {
      console.error("[prompt] Error while generating image:", err);
      await interaction.editReply(
        "An error occurred while generating the image. Please double-check your prompt (and any input image) and try again."
      );
    }
  },
};
