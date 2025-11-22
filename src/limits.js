const config = require("./config");
const db = require("./db");

// Calcola in UTC l'inizio/fine del giorno corrente
function getTodayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Calcola in UTC l'inizio/fine del mese corrente
function getThisMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
    0, 0, 0, 0
  ));
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    0, 0, 0, 0
  ));
  return { start: start.toISOString(), end: end.toISOString() };
}

// Verifica limiti giornalieri e budget mensile
function canGenerate(userId) {
  const dayRange = getTodayRange();
  const usedToday = db.countUserGenerationsInRange(userId, dayRange.start, dayRange.end);
  const remainingToday = config.MAX_DAILY_IMAGES_PER_USER - usedToday;

  if (remainingToday <= 0) {
    return {
      allowed: false,
      code: "DAILY_LIMIT",
      usedToday,
      remainingToday: 0,
    };
  }

  const monthRange = getThisMonthRange();
  const totalThisMonth = db.countGenerationsInRange(monthRange.start, monthRange.end);
  const currentCost = totalThisMonth * config.COST_PER_IMAGE_USD;
  const predictedCost = (totalThisMonth + 1) * config.COST_PER_IMAGE_USD;

  if (predictedCost > config.MAX_MONTHLY_COST_USD) {
    return {
      allowed: false,
      code: "BUDGET_EXCEEDED",
      currentCost,
      predictedCost,
      maxBudget: config.MAX_MONTHLY_COST_USD,
    };
  }

  return {
    allowed: true,
    code: "OK",
    usedToday,
    remainingToday,
    currentCost,
    predictedCost,
    maxBudget: config.MAX_MONTHLY_COST_USD,
  };
}

module.exports = {
  canGenerate,
};
