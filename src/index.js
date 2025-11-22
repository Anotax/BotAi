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
  console.error("❌ DISCORD_TOKEN non configurato. Imposta la variabile d'ambiente o il file .env.");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY non configurata. Il bot non potrà generare immagini finché non la imposti.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// Caricamento comandi
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Caricato comando /${command.data.name}`);
  } else {
    console.warn(`⚠️ Il comando in ${filePath} non esporta "data" ed "execute".`);
  }
}

// Log opzionali sul canale staff
async function sendStaffLog(message) {
  try {
    if (!config.STAFF_LOG_CHANNEL_ID) return;
    const channel = await client.channels.fetch(config.STAFF_LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;
    await channel.send(message);
  } catch (err) {
    console.warn("[Log] Impossibile inviare log al canale staff:", err.message);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Bot connesso come ${c.user.tag}`);

  try {
    const commandsData = client.commands.map((cmd) => cmd.data.toJSON());
    await c.application.commands.set(commandsData);
    console.log(`✅ Comandi slash registrati (${commandsData.length})`);
  } catch (err) {
    console.error("❌ Errore durante la registrazione dei comandi slash:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Comandi slash
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
      console.error(`❌ Errore eseguendo comando /${interaction.commandName}:`, err);
      const content =
        "Si è verificato un errore inatteso durante l'esecuzione del comando. Riprova più tardi.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  // Select menu per /edit
  if (interaction.isStringSelectMenu()) {
    const command = client.commands.get("edit");
    if (command && typeof command.handleSelect === "function" && interaction.customId === "edit_select") {
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
        console.error("❌ Errore nella gestione del menu di selezione per /edit:", err);
        const content =
          "Si è verificato un errore mentre gestivo la tua selezione. Riprova.";
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content, ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => {});
        }
      }
    }
    return;
  }

  // Modal per prompt di edit
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
        console.error("❌ Errore nella gestione del modal per /edit:", err);
        const content =
          "Si è verificato un errore mentre processavo il tuo prompt. Riprova.";
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content, ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => {});
        }
      }
    }
  }
});

client.login(DISCORD_TOKEN);
