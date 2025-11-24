// src/commands/prompt.js
const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Generate an image from a text prompt.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe the image you want to generate.")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("reference_image")
        .setDescription("Optional reference image (visual inspiration).")
        .setRequired(false)
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {{ openaiClient: any, sendStaffLog?: (msg: string) => Promise<any> }} context
   */
  async execute(interaction, { openaiClient, sendStaffLog }) {
    const prompt = interaction.options.getString("prompt", true);
    const referenceAttachment =
      interaction.options.getAttachment("reference_image");

    await interaction.deferReply();

    try {
      // Nessuna size: usiamo il default definito in openaiClient (1024x1024)
      const imageBuffer = await openaiClient.generateImage({
        prompt
      });

      const resultAttachment = new AttachmentBuilder(imageBuffer, {
        name: "generated.png"
      });

      let content = "Here is your generated image. 🎨";

      if (referenceAttachment) {
        content +=
          "\n\n(Reference image attached for context; the model does not edit it directly.)";
      }

      const files = [resultAttachment];

      if (referenceAttachment) {
        files.push({
          attachment: referenceAttachment.url,
          name: referenceAttachment.name || "reference.png"
        });
      }

      await interaction.editReply({
        content,
        files
      });
    } catch (err) {
      console.error("[prompt] Error while generating image:", err);

      let message =
        "An error occurred while generating the image. Please try again later.";
      if (err && err.message) {
        message += `\n\nDetails: \`${err.message}\``;
      }

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: message }).catch(() => {});
        } else {
          await interaction
            .reply({ content: message, ephemeral: true })
            .catch(() => {});
        }
      } catch (replyErr) {
        console.error("[prompt] Failed to send error reply:", replyErr);
      }

      if (sendStaffLog) {
        sendStaffLog(
          `Error in /prompt: \`${err?.message}\`\n\`\`\`${err?.stack}\`\`\``
        ).catch(() => {});
      }
    }
  }
};
