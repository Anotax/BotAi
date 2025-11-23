// src/limits.js
// No artificial limits: we only track usage optionally,
// but we NEVER block a request. OpenAI billing/credits
// are the only real limit.

/**
 * Dummy function used by /prompt (and possibly /edit).
 * Always allows the request.
 *
 * @param {string} userId - Discord user ID
 * @returns {Promise<{ allowed: boolean }>}
 */
async function consumeUserDailyQuota(userId) {
  // You can add optional logging here if you want to track usage,
  // but do NOT block anything.

  // Example (optional):
  // console.log(`[limits] Allowing image generation for user ${userId}`);

  return {
    allowed: true,
  };
}

module.exports = {
  consumeUserDailyQuota,
};
