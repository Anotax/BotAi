// src/limits.js
// Simple usage limits: per-user daily quota + monthly global budget
// Data is persisted in a JSON file so it works on Render without native modules.

const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");

// Where we store usage counters
const DATA_DIR = path.join(__dirname, "..", "data");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");

// Default config (used if not present in config.js)
const DEFAULT_DAILY_USER_LIMIT = 5;
const DEFAULT_ESTIMATED_COST_PER_IMAGE_USD = 0.04;
const DEFAULT_MONTHLY_BUDGET_USD = 10;

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load usage JSON from disk
function loadUsage() {
  ensureDataDir();

  if (!fs.existsSync(USAGE_FILE)) {
    return {
      userDaily: {}, // { "YYYY-MM-DD": { userId: count } }
      monthlyCost: {}, // { "YYYY-MM": costNumber }
    };
  }

  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[limits] Failed to read usage.json, resetting file:", err);
    return {
      userDaily: {},
      monthlyCost: {},
    };
  }
}

// Save usage JSON to disk
function saveUsage(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[limits] Failed to write usage.json:", err);
  }
}

/**
 * Consume one image generation from the user's daily quota and from the
 * global monthly budget.
 *
 * This is the function used by /prompt (and can be reused by /edit).
 *
 * @param {string} userId - Discord user ID
 * @returns {Promise<{
 *   allowed: boolean,
 *   reason?: "USER_DAILY_LIMIT" | "GLOBAL_BUDGET_EXCEEDED",
 *   usedToday?: number,
 *   remainingToday?: number,
 *   limitToday?: number,
 *   monthCost?: number,
 *   monthlyBudget?: number
 * }>}
 */
async function consumeUserDailyQuota(userId) {
  const usage = loadUsage();

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const monthKey = todayKey.slice(0, 7); // YYYY-MM

  const dailyLimit =
    config.DAILY_USER_IMAGE_LIMIT ?? DEFAULT_DAILY_USER_LIMIT;
  const costPerImage =
    config.ESTIMATED_COST_PER_IMAGE_USD ??
    DEFAULT_ESTIMATED_COST_PER_IMAGE_USD;
  const monthlyBudget =
    config.MONTHLY_BUDGET_USD ?? DEFAULT_MONTHLY_BUDGET_USD;

  // Per-user daily usage
  if (!usage.userDaily[todayKey]) {
    usage.userDaily[todayKey] = {};
  }
  const usedToday = usage.userDaily[todayKey][userId] || 0;

  if (usedToday >= dailyLimit) {
    return {
      allowed: false,
      reason: "USER_DAILY_LIMIT",
      usedToday,
      remainingToday: 0,
      limitToday: dailyLimit,
    };
  }

  // Monthly cost check
  const currentMonthCost = usage.monthlyCost[monthKey] || 0;
  const projectedCost = currentMonthCost + costPerImage;

  if (projectedCost > monthlyBudget) {
    return {
      allowed: false,
      reason: "GLOBAL_BUDGET_EXCEEDED",
      monthCost: currentMonthCost,
      monthlyBudget,
    };
  }

  // All good: update counters
  const newUsedToday = usedToday + 1;
  usage.userDaily[todayKey][userId] = newUsedToday;
  usage.monthlyCost[monthKey] = projectedCost;

  saveUsage(usage);

  return {
    allowed: true,
    usedToday: newUsedToday,
    remainingToday: Math.max(dailyLimit - newUsedToday, 0),
    limitToday: dailyLimit,
    monthCost: projectedCost,
    monthlyBudget,
  };
}

module.exports = {
  consumeUserDailyQuota,
};
