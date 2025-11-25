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
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {{ openaiClient: any, sendStaffLog?: (msg: string) => Promise<any> }} context
   */
  async execute(interaction, { openaiClient, sendStaffLog }) {
    const prompt = interaction.options.getString("prompt", true);

    await interaction.deferReply();

    try {
      const imageBuffer = await openaiClient.generateImage({
        prompt
      });

      const resultAttachment = new AttachmentBuilder(imageBuffer, {
        name: "generated.png"
      });

      const content = "Here is your generated image. 🎨";

      await interaction.editReply({
        content,
        files: [resultAttachment]
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
