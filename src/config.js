const config = {
  COST_PER_IMAGE_USD: 0.04,
  MAX_DAILY_IMAGES_PER_USER: parseInt(process.env.MAX_DAILY_IMAGES_PER_USER || "5", 10),
  MAX_MONTHLY_COST_USD: parseFloat(process.env.MAX_MONTHLY_COST_USD || "20"),
  IMAGE_SIZE: "1024x1024",
  // 'medium' ~ qualità standard
  IMAGE_QUALITY: "medium",
  HISTORY_PER_USER: 10,
  STAFF_LOG_CHANNEL_ID: process.env.AI_BOT_LOG_CHANNEL_ID || null,
};

module.exports = config;
