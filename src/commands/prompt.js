const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Generate an AI image from a text prompt.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe the image you want me to create.")
        .setRequired(true)
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {{ openaiClient: any }} ctx
   */
  async execute(interaction, { openaiClient }) {
    const prompt = interaction.options.getString("prompt", true);

    console.log(
      "[prompt] /prompt from",
      interaction.user?.id,
      ", attachment=false"
    );

    // Diamo subito un segnale a Discord che stiamo lavorando
    await interaction.deferReply();

    try {
      // Chiamata al client OpenAI semplificato
      const b64 = await openaiClient.generateImage({ prompt });

      const buffer = Buffer.from(b64, "base64");
      const fileName = "image.png";
      const attachment = new AttachmentBuilder(buffer, { name: fileName });

      await interaction.editReply({
        content: `Prompt: \`${prompt}\``,
        files: [attachment],
      });
    } catch (err) {
      console.error("[prompt] Error while generating image:", err);

      let content =
        "An error occurred while generating the image. Please double-check your prompt (and any input image) and try again.";

      const msg =
        err?.error?.message || err?.message || (typeof err === "string" ? err : "");

      // Messaggio speciale se è di nuovo un problema di verifica / permessi del modello
      if (msg.includes("must be verified") && msg.includes("gpt-image-1")) {
        content =
          "The OpenAI account used by this bot is not verified to use the `gpt-image-1` image model. Please contact the server administrators so they can verify the OpenAI organization in the dashboard.";
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  },
};
