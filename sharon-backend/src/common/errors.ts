/**
 * Custom Error Classes for Sharon Rewards Engine
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Invalid input parameters') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class IdempotencyError extends AppError {
  public readonly existingResult: any;

  constructor(message: string, existingResult?: any) {
    super(message, 200, 'IDEMPOTENT_REPLAY');
    this.existingResult = existingResult;
  }
}

export class ReconciliationError extends AppError {
  constructor(message: string) {
    super(message, 422, 'RECONCILIATION_FAILED');
  }
}

export class NetworkIsolationError extends AppError {
  constructor(message: string = 'Cannot mix resources across different Sharon networks') {
    super(message, 403, 'NETWORK_ISOLATION_VIOLATION');
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string = 'Insufficient available reward balance for redemption') {
    super(message, 400, 'INSUFFICIENT_BALANCE');
  }
}
