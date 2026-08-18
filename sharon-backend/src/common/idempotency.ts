/**
 * Idempotency Service
 * Stores and validates idempotency keys to ensure duplicate requests produce identical responses
 * without re-executing business operations.
 */

export interface IdempotencyRecord {
  key: string;
  response: any;
  created_at: string;
}

export class IdempotencyManager {
  private static store: Map<string, IdempotencyRecord> = new Map();

  static get(key: string): IdempotencyRecord | undefined {
    return this.store.get(key);
  }

  static save(key: string, response: any): void {
    if (!key) return;
    this.store.set(key, {
      key,
      response,
      created_at: new Date().toISOString()
    });
  }

  static clear(): void {
    this.store.clear();
  }
}
