/**
 * Affiliate AE - Monetary Calculation Utilities
 * 
 * CRITICAL RULE: NEVER use floating point math for financial calculations.
 * Always operate on integer "paise".
 * 
 * 1 INR = 100 paise.
 */

/**
 * Converts a floating point INR amount (e.g. 10.50) to integer paise (1050).
 * Handles floating point precision issues properly.
 * @param {number|string} rupees - The INR amount
 * @returns {number} Integer paise
 */
function toPaise(rupees) {
  const amount = Number(rupees);
  if (isNaN(amount)) throw new Error('Invalid amount provided for paise conversion.');
  return Math.round(amount * 100);
}

/**
 * Converts integer paise back to an INR float strictly for display or external API purposes.
 * @param {number} paise 
 * @returns {number} Float representing INR
 */
function fromPaise(paise) {
  if (!Number.isInteger(paise)) throw new Error('Paise amount must be an integer.');
  return Number((paise / 100).toFixed(2));
}

/**
 * Calculates a reward amount based on a reward rate in basis points (bps).
 * 100 bps = 1%.
 * The result is automatically rounded to the nearest paise.
 * 
 * @param {number} amountPaise 
 * @param {number} rewardRateBps 
 * @returns {number}
 */
function calculateRewardPaise(amountPaise, rewardRateBps) {
  if (!Number.isInteger(amountPaise) || !Number.isInteger(rewardRateBps)) {
    throw new Error('Inputs to reward calculation must be integers.');
  }
  // Formula: (amount * rate) / 10000
  // Math.round handles any fractional paise correctly.
  return Math.round((amountPaise * rewardRateBps) / 10000);
}

module.exports = {
  toPaise,
  fromPaise,
  calculateRewardPaise
};
