// src/commands/prompt.js
const {
  SlashCommandBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { generateImage, editImageFromBuffer } = require("../openaiClient");
const { saveImageBuffer } = require("../storage");
const db = require("../db");
const limits = require("../limits");
const config = require("../config");
const fetch = require("node-fetch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Generate an AI image from a text prompt.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe the image you want to generate")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Optional base image to transform")
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const promptText = interaction.options.getString("prompt");
    const attachment = interaction.options.getAttachment("image");

    console.log(
      `[prompt] /prompt from ${userId}, attachment=${Boolean(attachment)}`
    );

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
      console.error("[prompt] Error while checking limits:", err);
      await interaction.reply({
        ephemeral: true,
        content:
          "An internal error occurred while checking usage limits. Please try again in a few minutes.",
      });
      return;
    }

    // 2) Start processing
    await interaction.deferReply();

    try {
      let imageBuffer;
      let generationType = "prompt";

      if (!attachment) {
        // Pure text → image
        imageBuffer = await generateImage(promptText);
      } else {
        // Edit based on uploaded image
        const response = await fetch(attachment.url);
        const inputBuffer = Buffer.from(await response.arrayBuffer());

        imageBuffer = await editImageFromBuffer(
          inputBuffer,
          attachment.name,
          promptText
        );
        generationType = "edit-from-upload";
      }

      // 3) Save image to disk
      const saved = await saveImageBuffer(userId, imageBuffer);

      // 4) Store metadata in DB
      const generationId = await db.insertGeneration({
        userId,
        prompt: promptText,
        imagePath: saved.path,
        createdAt: new Date(),
        parentGenerationId: null,
        type: generationType,
        costUsd: config.ESTIMATED_COST_PER_IMAGE_USD,
      });

      // 5) Reply with the image
      const file = new AttachmentBuilder(imageBuffer, {
        name: `ai-image-${generationId}.png`,
      });

      await interaction.editReply({
        content: `Here is your image.\nPrompt: \`${promptText}\``,
        files: [file],
      });
    } catch (error) {
      console.error(
        "[prompt] Error while generating image:",
        error
      );

      let userMessage =
        "An error occurred while generating the image. Please double-check your prompt (and any input image) and try again.";

      // Missing API key
      if (error.code === "NO_OPENAI_API_KEY") {
        userMessage =
          "The AI image service is not configured correctly on the server (missing OpenAI API key). Please contact the server administrators.";
      }
      // Organization not verified for gpt-image-1
      else if (
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
