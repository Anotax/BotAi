const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const openaiClient = require("../openaiClient");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Generate an image from a text prompt.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe the image you want.")
        .setRequired(true)
    ),

  /**
   * /prompt handler
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const prompt = interaction.options.getString("prompt", true);

    // Let Discord know we are working (image generation can take several seconds)
    await interaction.deferReply();

    try {
      // Ask OpenAI for an image (returns a Buffer)
      const imageBuffer = await openaiClient.generateImage({
        prompt,
        userId: interaction.user.id,
      });

      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "image.png",
      });

      await interaction.editReply({
        content: `Here is your image for: \`${prompt}\``,
        files: [attachment],
      });
    } catch (error) {
      console.error("[prompt] Error while generating image:", error);

      let message =
        "An error occurred while generating the image. Please double-check your prompt (and any input image) and try again.";

      // Se mai dovessi tornare un 403 specifico sull'account, puoi personalizzare qui
      if (error?.status === 403 || error?.statusCode === 403) {
        message =
          "The OpenAI account used by this bot is not allowed to generate images. Please contact the server administrators.";
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  },
};
