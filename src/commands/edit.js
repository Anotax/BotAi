const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an image with AI (coming soon)."),

  async execute(interaction) {
    await interaction.reply({
      content:
        "The `/edit` command is not available yet in this version of the bot.",
      ephemeral: true,
    });
  },

  // No-op handlers so index.js can safely call them
  async handleSelect(interaction) {
    await interaction.reply({
      content:
        "The `/edit` command is not available yet in this version of the bot.",
      ephemeral: true,
    });
  },

  async handleModal(interaction) {
    await interaction.reply({
      content:
        "The `/edit` command is not available yet in this version of the bot.",
      ephemeral: true,
    });
  },
};
