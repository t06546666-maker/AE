/**
 * Structured Logger for Sharon Engine
 */

export class Logger {
  static info(message: string, meta?: Record<string, any>) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
  }

  static warn(message: string, meta?: Record<string, any>) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
  }

  static error(message: string, error?: any, meta?: Record<string, any>) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error?.stack || error, meta ? JSON.stringify(meta) : '');
  }
}
