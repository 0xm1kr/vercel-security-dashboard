/**
 * Base class for all errors that originate from this application's
 * domain or application layers. Carries a stable `code` so the
 * interface layer can map errors to HTTP responses without leaking
 * raw messages to the user.
 */
export class AppError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("validation_error", message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("not_found", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super("unauthorized", message);
    this.name = "UnauthorizedError";
  }
}

export class IntegrationError extends AppError {
  public readonly status?: number;

  constructor(message: string, status?: number, cause?: unknown) {
    super("integration_error", message, cause);
    this.name = "IntegrationError";
    if (status !== undefined) {
      this.status = status;
    }
  }
}
