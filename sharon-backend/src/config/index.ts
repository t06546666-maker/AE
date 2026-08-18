/**
 * Global Configuration for Sharon Settlement Engine
 */

export const Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  defaultCurrency: 'INR' as const,
  defaultRewardRateBps: 100, // 1%
  defaultMinRedemptionThresholdPaise: 10000, // ₹100
  settlementCycleDays: 7,
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://sharon:sharon_secret@localhost:5432/sharon_settlement',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'sharon_dev_secret_key_change_in_production_2026',
  }
};
