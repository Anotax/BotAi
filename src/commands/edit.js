const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

function truncate(str, max) {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max - 3) + "...";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Modifica una delle tue ultime immagini generate")
    .addIntegerOption((option) =>
      option
        .setName("slot")
        .setDescription("Indice dell'immagine da modificare (1 = più recente)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Nuovo prompt di modifica")
        .setRequired(false)
    ),

  async execute(interaction, deps) {
    const slot = interaction.options.getInteger("slot");
    const newPrompt = interaction.options.getString("prompt");
    const userId = interaction.user.id;

    // Se vengono passati sia slot che prompt -> edit diretto
    if (slot && newPrompt) {
      await this._performEdit(interaction, { ...deps, slot, prompt: newPrompt });
      return;
    }

    // Altrimenti flusso interattivo con select menu
    await this._showSelectionMenu(interaction, deps);
  },

  async _showSelectionMenu(interaction, { db, config }) {
    const userId = interaction.user.id;
    console.log(`[edit] /edit interattivo da ${userId}`);

    const generations = db.getLastGenerationsForUser(userId, config.HISTORY_PER_USER);

    if (!generations.length) {
      await interaction.reply({
        content:
          "Non hai ancora immagini modificabili. Usa prima il comando `/prompt` per generarne una.",
        ephemeral: true,
      });
      return;
    }

    const options = generations.map((gen, index) => {
      const label = `#${index + 1} • ${truncate(gen.prompt, 80)}`;
      const description =
        gen.source_type === "edit" ? "Derivata da un edit" : "Generata da prompt";
      return {
        label,
        description,
        value: String(gen.id),
      };
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("edit_select")
      .setPlaceholder("Seleziona l'immagine da modificare")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content:
        "Scegli una delle tue ultime immagini generate da modificare. Ti chiederò poi il nuovo prompt.",
      components: [row],
      ephemeral: true,
    });
  },

  async _performEdit(interaction, { db, storage, openaiClient, limits, config, sendStaffLog, slot, prompt }) {
    const userId = interaction.user.id;
    console.log(`[edit] Esecuzione edit diretta per utente ${userId} (slot=${slot})`);

    const generations = db.getLastGenerationsForUser(userId, config.HISTORY_PER_USER);

    if (!generations.length) {
      await interaction.reply({
        content:
          "Non ho trovato immagini recenti da modificare. Usa prima `/prompt` per generarne una.",
        ephemeral: true,
      });
      return;
    }

    if (slot < 1 || slot > generations.length) {
      await interaction.reply({
        content:
          `Indice non valido. Puoi scegliere un valore tra 1 e ${generations.length}. ` +
          "Oppure esegui `/edit` senza parametri per scegliere dall'elenco.",
        ephemeral: true,
      });
      return;
    }

    const target = generations[slot - 1];

    const limitCheck = limits.canGenerate(userId);
    if (!limitCheck.allowed) {
      let msg;
      if (limitCheck.code === "DAILY_LIMIT") {
        msg = `Hai già generato il numero massimo di immagini consentite per oggi (${config.MAX_DAILY_IMAGES_PER_USER}). Riprova domani.`;
      } else if (limitCheck.code === "BUDGET_EXCEEDED") {
        msg = "Il budget mensile stimato per le immagini è esaurito. Contatta lo staff se pensi si tratti di un errore.";
      } else {
        msg = "Al momento non posso generare altre immagini per via dei limiti configurati.";
      }
      await interaction.reply({ content: msg, ephemeral: true });
      await sendStaffLog?.(
        `⚠️ Utente <@${userId}> bloccato da /edit (slot) per superamento limiti (${limitCheck.code}).`
      );
      return;
    }

    await interaction.deferReply();

    try {
      const baseBuffer = storage.loadImageBuffer(target.image_path);

      const editedBuffer = await openaiClient.editImageFromBuffer(
        baseBuffer,
        `generation_${target.id}.png`,
        prompt
      );

      const imagePath = storage.saveImageForUser(userId, editedBuffer);

      const newGeneration = db.insertGeneration({
        userId,
        prompt,
        imagePath,
        sourceType: "edit",
        parentGenerationId: target.id,
      });

      db.pruneGenerationsForUser(userId, config.HISTORY_PER_USER);

      const file = new AttachmentBuilder(editedBuffer, {
        name: `edit_${newGeneration.id}.png`,
      });

      await interaction.editReply({
        content:
          `Ho modificato la tua immagine (slot #${slot}).\n\n` +
          `**Prompt originale:** ${target.prompt}\n` +
          `**Nuovo prompt:** ${prompt}`,
        files: [file],
      });

      await sendStaffLog?.(
        `✅ Nuova immagine (#${newGeneration.id}) per <@${userId}> tramite /edit (slot=${slot}, base=#${target.id}).`
      );
    } catch (error) {
      console.error("[edit] Errore durante l'edit:", error);
      await interaction.editReply({
        content:
          "Si è verificato un errore durante la modifica dell'immagine. " +
          "Riprova tra qualche secondo; se il problema persiste contatta lo staff.",
      });
      await sendStaffLog?.(
        `❌ Errore /edit (slot) per <@${userId}>: \`${error.message}\``
      );
    }
  },

  async handleSelect(interaction, deps) {
    const userId = interaction.user.id;
    const selectedId = interaction.values[0];
    console.log(`[edit] Select menu: utente ${userId} ha scelto generazione #${selectedId}`);

    const { db } = deps;
    const generation = db.getGenerationById(Number(selectedId));

    if (!generation || generation.user_id !== userId) {
      await interaction.reply({
        content:
          "Non posso modificare questa immagine (non ti appartiene o non esiste più).",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`edit_prompt_modal:${generation.id}`)
      .setTitle("Nuovo prompt di modifica");

    const promptInput = new TextInputBuilder()
      .setCustomId("edit_prompt_input")
      .setLabel("Descrivi come vuoi modificare l'immagine")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const firstRow = new ActionRowBuilder().addComponents(promptInput);
    modal.addComponents(firstRow);

    await interaction.showModal(modal);
  },

  async handleModal(interaction, deps) {
    const userId = interaction.user.id;
    const idPart = interaction.customId.split(":")[1];
    const generationId = Number(idPart);

    console.log(
      `[edit] Modal submit da ${userId} per generazione #${generationId}`
    );

    const prompt = interaction.fields.getTextInputValue("edit_prompt_input");

    const { db, storage, openaiClient, limits, config, sendStaffLog } = deps;

    const generation = db.getGenerationById(generationId);

    if (!generation || generation.user_id !== userId) {
      await interaction.reply({
        content:
          "Non posso modificare questa immagine (non ti appartiene o non esiste più).",
        ephemeral: true,
      });
      return;
    }

    const limitCheck = limits.canGenerate(userId);
    if (!limitCheck.allowed) {
      let msg;
      if (limitCheck.code === "DAILY_LIMIT") {
        msg = `Hai già generato il numero massimo di immagini consentite per oggi (${config.MAX_DAILY_IMAGES_PER_USER}). Riprova domani.`;
      } else if (limitCheck.code === "BUDGET_EXCEEDED") {
        msg = "Il budget mensile stimato per le immagini è esaurito. Contatta lo staff se pensi si tratti di un errore.";
      } else {
        msg = "Al momento non posso generare altre immagini per via dei limiti configurati.";
      }
      await interaction.reply({ content: msg, ephemeral: true });
      await sendStaffLog?.(
        `⚠️ Utente <@${userId}> bloccato da /edit (modal) per superamento limiti (${limitCheck.code}).`
      );
      return;
    }

    await interaction.deferReply();

    try {
      const baseBuffer = storage.loadImageBuffer(generation.image_path);

      const editedBuffer = await openaiClient.editImageFromBuffer(
        baseBuffer,
        `generation_${generation.id}.png`,
        prompt
      );

      const imagePath = storage.saveImageForUser(userId, editedBuffer);

      const newGeneration = db.insertGeneration({
        userId,
        prompt,
        imagePath,
        sourceType: "edit",
        parentGenerationId: generation.id,
      });

      db.pruneGenerationsForUser(userId, config.HISTORY_PER_USER);

      const file = new AttachmentBuilder(editedBuffer, {
        name: `edit_${newGeneration.id}.png`,
      });

      await interaction.editReply({
        content:
          `Ho modificato la tua immagine.\n\n` +
          `**Prompt originale:** ${generation.prompt}\n` +
          `**Nuovo prompt:** ${prompt}`,
        files: [file],
      });

      await sendStaffLog?.(
        `✅ Nuova immagine (#${newGeneration.id}) per <@${userId}> tramite /edit (modal, base=#${generation.id}).`
      );
    } catch (error) {
      console.error("[edit] Errore durante l'edit (modal):", error);
      await interaction.editReply({
        content:
          "Si è verificato un errore durante la modifica dell'immagine. " +
          "Riprova tra qualche secondo; se il problema persiste contatta lo staff.",
      });
      await sendStaffLog?.(
        `❌ Errore /edit (modal) per <@${userId}>: \`${error.message}\``
      );
    }
  },
};
