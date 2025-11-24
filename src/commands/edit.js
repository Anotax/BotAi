// src/commands/edit.js
const {
  SlashCommandBuilder,
  AttachmentBuilder
} = require("discord.js");

const ALLOWED_SIZES = ["512x512", "768x768", "1024x1024"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing image with AI.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image to edit.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe how you want to edit the image.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("size")
        .setDescription("Output image size.")
        .addChoices(
          { name: "512 x 512", value: "512x512" },
          { name: "768 x 768", value: "768x768" },
          { name: "1024 x 1024", value: "1024x1024" }
        )
        .setRequired(false)
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {{ openaiClient: any, storage: any, sendStaffLog?: (msg: string) => Promise<any> }} context
   */
  async execute(interaction, { openaiClient, storage, sendStaffLog }) {
    const attachment = interaction.options.getAttachment("image", true);
    const prompt = interaction.options.getString("prompt", true);
    const size = interaction.options.getString("size") || "1024x1024";

    if (!ALLOWED_SIZES.includes(size)) {
      await interaction.reply({
        content:
          "Invalid size. Allowed values: 512x512, 768x768, 1024x1024.",
        ephemeral: true
      });
      return;
    }

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
      // 1) scarico l'immagine da Discord (src/storage.js)
      const imageBuffer = await storage.downloadDiscordAttachment(
        attachment.url
      );

      // 2) la mando all'API per l'edit
      const editedBuffer = await openaiClient.editImage({
        imageBuffer,
        prompt,
        size
      });

      const editedAttachment = new AttachmentBuilder(editedBuffer, {
        name: "edited.png"
      });

      await interaction.editReply({
        content: "Here is your edited image. ✂️",
        files: [editedAttachment]
      });
    } catch (err) {
      console.error("[edit] Error while editing image:", err);

      let message =
        "An error occurred while editing the image. Please check your prompt and input image, then try again.";
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
        console.error("[edit] Failed to send error reply:", replyErr);
      }

      if (sendStaffLog) {
        sendStaffLog(
          `Error in /edit: \`${err?.message}\`\n\`\`\`${err?.stack}\`\`\``
        ).catch(() => {});
      }
    }
  }
};
