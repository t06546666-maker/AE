/**
 * Money Utility Module
 * Enforces exact integer minor unit (paise) monetary calculations.
 * Floating point arithmetic for monetary calculations is STRICTLY PROHIBITED.
 */

export class Money {
  /**
   * Converts Rupee decimal (e.g. 100.50) to integer Paise (10050).
   * Safe round to prevent floating point inaccuracies during input conversion.
   */
  static rupeesToPaise(rupees: number): number {
    if (!Number.isFinite(rupees) || rupees < 0) {
      throw new Error(`Invalid monetary amount: ${rupees}`);
    }
    return Math.round(rupees * 100);
  }

  /**
   * Converts integer Paise (10050) to Rupee decimal (100.50).
   */
  static paiseToRupees(paise: number): number {
    Money.assertInteger(paise);
    return paise / 100;
  }

  /**
   * Calculates reward in paise given transaction amount in paise and basis points (bps).
   * Example: 10000 paise (₹100) at 100 bps (1%) => Math.floor((10000 * 100) / 10000) = 100 paise (₹1).
   */
  static calculateReward(amountPaise: number, rewardRateBps: number): number {
    Money.assertInteger(amountPaise);
    if (rewardRateBps < 0) {
      throw new Error(`Invalid reward rate bps: ${rewardRateBps}`);
    }
    // Integer multiplication followed by integer division (floor to nearest paise)
    return Math.floor((amountPaise * rewardRateBps) / 10000);
  }

  /**
   * Formats paise as human readable string. Example: 10050 -> "₹100.50"
   */
  static format(paise: number): string {
    Money.assertInteger(paise);
    const rupees = (paise / 100).toFixed(2);
    return `₹${rupees}`;
  }

  /**
   * Asserts that a value is a non-negative integer.
   */
  static assertInteger(val: number, name: string = 'Amount'): void {
    if (!Number.isInteger(val)) {
      throw new Error(`${name} must be an integer in minor units (paise). Got: ${val}`);
    }
    if (val < 0) {
      throw new Error(`${name} cannot be negative. Got: ${val}`);
    }
  }
}
