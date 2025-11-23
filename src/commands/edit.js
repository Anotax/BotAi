// src/commands/edit.js
const {
  SlashCommandBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { editImageFromBuffer } = require("../openaiClient");
const { saveImageBuffer } = require("../storage");
const db = require("../db");
const limits = require("../limits");
const config = require("../config");
const fetch = require("node-fetch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing image with an AI prompt.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image you want to edit")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe how you want to edit the image")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const promptText = interaction.options.getString("prompt");
    const attachment = interaction.options.getAttachment("image");

    console.log(
      `[edit] /edit from ${userId}, attachment=${Boolean(attachment)}`
    );

    if (!attachment) {
      await interaction.reply({
        ephemeral: true,
        content:
          "You must attach an image to use this command.",
      });
      return;
    }

    // 1) Check limits
    try {
      const hasDailyQuota = await limits.consumeUserDailyQuota(userId);
      if (!hasDailyQuota) {
        await interaction.reply({
          ephemeral: true,
          content:
            "You reached the maximum number of images you can generate today. Please try again tomorrow.",
        });
        return;
      }

      const hasBudget = await limits.consumeGlobalBudget(
        config.ESTIMATED_COST_PER_IMAGE_USD
      );
      if (!hasBudget) {
        await interaction.reply({
          ephemeral: true,
          content:
            "The global image budget for this month has been exhausted. Please contact the server staff.",
        });
        return;
      }
    } catch (err) {
      console.error("[edit] Error while checking limits:", err);
      await interaction.reply({
        ephemeral: true,
        content:
          "An internal error occurred while checking usage limits. Please try again in a few minutes.",
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Download original image
      const response = await fetch(attachment.url);
      const inputBuffer = Buffer.from(await response.arrayBuffer());

      // Call OpenAI
      const editedBuffer = await editImageFromBuffer(
        inputBuffer,
        attachment.name,
        promptText
      );

      // Save & log
      const saved = await saveImageBuffer(userId, editedBuffer);

      const generationId = await db.insertGeneration({
        userId,
        prompt: promptText,
        imagePath: saved.path,
        createdAt: new Date(),
        parentGenerationId: null,
        type: "edit",
        costUsd: config.ESTIMATED_COST_PER_IMAGE_USD,
      });

      const file = new AttachmentBuilder(editedBuffer, {
        name: `ai-edit-${generationId}.png`,
      });

      await interaction.editReply({
        content: `Here is your edited image.\nPrompt: \`${promptText}\``,
        files: [file],
      });
    } catch (error) {
      console.error("[edit] Error while editing image:", error);

      let userMessage =
        "An error occurred while editing the image. Please double-check your prompt and input image, then try again.";

      if (error.code === "NO_OPENAI_API_KEY") {
        userMessage =
          "The AI image service is not configured correctly on the server (missing OpenAI API key). Please contact the server administrators.";
      } else if (
        error.status === 403 &&
        typeof error.message === "string" &&
        error.message.includes(
          "must be verified to use the model `gpt-image-1`"
        )
      ) {
        userMessage =
          "The OpenAI account used by this bot is not verified to use the `gpt-image-1` image model. Please contact the server administrators so they can verify the OpenAI organization in the dashboard.";
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: userMessage, files: [] });
      } else {
        await interaction.reply({
          content: userMessage,
          ephemeral: true,
        });
      }
    }
  },
};
