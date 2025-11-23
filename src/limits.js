// src/limits.js
// Stub for old limit system: no daily limits, no global budget.
// All functions just say "ok, allowed".

module.exports = {
  /**
   * Per–user daily quota (DISABLED).
   * Kept only so older code can call it without crashing.
   */
  async consumeUserDailyQuota(_userId, _options = {}) {
    return {
      allowed: true,
      remaining: null, // null = "no real limit"
    };
  },

  /**
   * Global budget / token limit (DISABLED).
   */
  async consumeGlobalBudget(_amount, _options = {}) {
    return {
      allowed: true,
      remaining: null,
    };
  },

  /**
   * Optional helper some code might call to see if a user is blocked.
   * Always return false => nobody is blocked.
   */
  async isUserBlocked(_userId) {
    return false;
  },
};
