require("dotenv").config();

const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const config = require("./config");
const openaiClient = require("./openaiClient");
const db = require("./db");
const limits = require("./limits");
const storage = require("./storage");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN is not configured. Set the environment variable or the .env file."
  );
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY is not configured. The bot will not be able to generate images until you set it."
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// Load slash commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded /${command.data.name} command`);
  } else {
    console.warn(
      `⚠️ The command at ${filePath} does not export both "data" and "execute".`
    );
  }
}

// Optional staff log utility
async function sendStaffLog(message) {
  try {
    if (!config.STAFF_LOG_CHANNEL_ID) return;
    const channel = await client.channels.fetch(config.STAFF_LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;
    await channel.send(message);
  } catch (err) {
    console.warn(
      "[Log] Unable to send log message to staff channel:",
      err.message
    );
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Bot logged in as ${c.user.tag}`);

  try {
    const commandsData = client.commands.map((cmd) => cmd.data.toJSON());
    await c.application.commands.set(commandsData);
    console.log(`✅ Registered slash commands (${commandsData.length})`);
  } catch (err) {
    console.error(
      "❌ Error while registering slash commands with Discord:",
      err
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, {
        client,
        config,
        openaiClient,
        db,
        limits,
        storage,
        sendStaffLog,
      });
    } catch (err) {
      console.error(
        `❌ Error while executing /${interaction.commandName}:`,
        err
      );
      const content =
        "An unexpected error occurred while executing this command. Please try again later.";
      if (interaction.deferred || interaction.replied) {
        await interaction
          .followUp({ content, ephemeral: true })
          .catch(() => {});
      } else {
        await interaction
          .reply({ content, ephemeral: true })
          .catch(() => {});
      }
    }
    return;
  }

  // String select menu for /edit
  if (interaction.isStringSelectMenu()) {
    const command = client.commands.get("edit");
    if (
      command &&
      typeof command.handleSelect === "function" &&
      interaction.customId === "edit_select"
    ) {
      try {
        await command.handleSelect(interaction, {
          client,
          config,
          openaiClient,
          db,
          limits,
          storage,
          sendStaffLog,
        });
      } catch (err) {
        console.error(
          "❌ Error while handling selection menu for /edit:",
          err
        );
        const content =
          "An error occurred while processing your selection. Please try again.";
        if (interaction.deferred || interaction.replied) {
          await interaction
            .followUp({ content, ephemeral: true })
            .catch(() => {});
        } else {
          await interaction
            .reply({ content, ephemeral: true })
            .catch(() => {});
        }
      }
    }
    return;
  }

  // Modal submit for /edit prompt
  if (interaction.isModalSubmit()) {
    const command = client.commands.get("edit");
    if (
      command &&
      typeof command.handleModal === "function" &&
      interaction.customId.startsWith("edit_prompt_modal:")
    ) {
      try {
        await command.handleModal(interaction, {
          client,
          config,
          openaiClient,
          db,
          limits,
          storage,
          sendStaffLog,
        });
      } catch (err) {
        console.error("❌ Error while handling modal for /edit:", err);
        const content =
          "An error occurred while processing your prompt. Please try again.";
        if (interaction.deferred || interaction.replied) {
          await interaction
            .followUp({ content, ephemeral: true })
            .catch(() => {});
        } else {
          await interaction
            .reply({ content, ephemeral: true })
            .catch(() => {});
        }
      }
    }
  }
});

client.login(DISCORD_TOKEN);
