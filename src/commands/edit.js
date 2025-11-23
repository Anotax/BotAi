const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const openaiClient = require("../openaiClient");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing image with AI.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image to edit (PNG or JPG).")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe how you want to edit the image.")
        .setRequired(true)
    ),

  /**
   * /edit handler
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const imageAttachment = interaction.options.getAttachment("image", true);
    const prompt = interaction.options.getString("prompt", true);

    await interaction.deferReply();

    try {
      // Download the input image from Discord
      const resp = await fetch(imageAttachment.url);
      if (!resp.ok) {
        throw new Error(
          `Failed to download image: ${resp.status} ${resp.statusText}`
        );
      }

      const arrayBuffer = await resp.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // Ask OpenAI to edit the image
      const editedBuffer = await openaiClient.editImage({
        prompt,
        imageBuffer,
        userId: interaction.user.id,
      });

      const attachment = new AttachmentBuilder(editedBuffer, {
        name: "edited.png",
      });

      await interaction.editReply({
        content: `Here is the edited image for: \`${prompt}\``,
        files: [attachment],
      });
    } catch (error) {
      console.error("[edit] Error while editing image:", error);

      const message =
        "An error occurred while editing the image. Please check your prompt and input image, then try again.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  },
};
