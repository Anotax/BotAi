// src/commands/prompt.js
const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

const ALLOWED_SIZES = ["512x512", "768x768", "1024x1024"];

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
    )
    .addAttachmentOption((option) =>
      option
        .setName("reference_image")
        .setDescription("Optional reference image (not directly edited).")
        .setRequired(false)
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {{ openaiClient: any, sendStaffLog?: (msg: string) => Promise<any> }} context
   */
  async execute(interaction, { openaiClient, sendStaffLog }) {
    const prompt = interaction.options.getString("prompt", true);
    const size = interaction.options.getString("size") || "1024x1024";
    const referenceAttachment =
      interaction.options.getAttachment("reference_image");

    if (!ALLOWED_SIZES.includes(size)) {
      await interaction.reply({
        content:
          "Invalid size. Allowed values: 512x512, 768x768, 1024x1024.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const imageBuffer = await openaiClient.generateImage({
        prompt,
        size,
      });

      const resultAttachment = new AttachmentBuilder(imageBuffer, {
        name: "generated.png",
      });

      let content = "Here is your generated image. 🎨";

      if (referenceAttachment) {
        content +=
          "\n\nNote: the uploaded reference image is **not** edited by the model; it's only used as visual context.";
      }

      const files = [resultAttachment];

      // Se vuoi ri-allegare anche l'immagine di riferimento come "memo" visivo
      if (referenceAttachment) {
        files.push({
          attachment: referenceAttachment.url,
          name: referenceAttachment.name || "reference.png",
        });
      }

      await interaction.editReply({
        content,
        files,
      });
    } catch (err) {
      console.error("[prompt] Error while generating image:", err);

      const message =
        "An error occurred while generating the image. Please try again later.";

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: message });
        } else {
          await interaction.reply({ content: message, ephemeral: true });
        }
      } catch (replyErr) {
        console.error("[prompt] Failed to send error reply:", replyErr);
      }

      if (sendStaffLog) {
        try {
          await sendStaffLog(
            `Error in /prompt: \`${err.message}\`\n\`\`\`${err.stack}\`\`\``
          );
        } catch (logErr) {
          console.error("[prompt] Failed to send staff log:", logErr);
        }
      }
    }
  },
};
