// src/commands/blend.js (o edit.js se non rinomini il file)
const {
  SlashCommandBuilder,
  AttachmentBuilder
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blend")
    .setDescription("Generate an image from a prompt + an image of reference.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Reference image.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe how you want the final image to look.")
        .setRequired(true)
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {{ openaiClient: any, storage: any, sendStaffLog?: (msg: string) => Promise<any> }} context
   */
  async execute(interaction, { openaiClient, storage, sendStaffLog }) {
    const attachment = interaction.options.getAttachment("image", true);
    const prompt = interaction.options.getString("prompt", true);

    if (
      attachment.contentType &&
      !attachment.contentType.startsWith("image/")
    ) {
      await interaction.reply({
        content: "Please upload a valid image file.",
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      // 1) Scarico l'immagine da Discord
      const imageBuffer = await storage.downloadDiscordAttachment(
        attachment.url
      );

      // 2) La mando all'API per generare l'immagine finale
      const editedBuffer = await openaiClient.editImage({
        imageBuffer,
        prompt
      });

      const editedAttachment = new AttachmentBuilder(editedBuffer, {
        name: "blend.png"
      });

      await interaction.editReply({
        content: "Here's your image🔥",
        files: [editedAttachment]
      });
    } catch (err) {
      console.error("[blend] Error while generating blended image:", err);

      let message =
        "An error occurred while generating the image. Please check your prompt and input image, then try again.";
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
        console.error("[blend] Failed to send error reply:", replyErr);
      }

      if (sendStaffLog) {
        sendStaffLog(
          `Error in /blend: \`${err?.message}\`\n\`\`\`${err?.stack}\`\`\``
        ).catch(() => {});
      }
    }
  }
};
