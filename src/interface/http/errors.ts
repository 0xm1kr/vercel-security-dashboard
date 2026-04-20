import {
  AppError,
  ConflictError,
  IntegrationError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/shared/errors.js";

export interface HttpErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export interface HttpErrorMapping {
  readonly status: number;
  readonly body: HttpErrorBody;
}

const SAFE_MESSAGE_FALLBACK = "Internal error";

export const mapErrorToHttp = (err: unknown): HttpErrorMapping => {
  if (err instanceof ValidationError) {
    return makeMapping(400, err);
  }
  if (err instanceof UnauthorizedError) {
    return makeMapping(401, err);
  }
  if (err instanceof NotFoundError) {
    return makeMapping(404, err);
  }
  if (err instanceof ConflictError) {
    return makeMapping(409, err);
  }
  if (err instanceof IntegrationError) {
    return makeMapping(502, err);
  }
  if (err instanceof AppError) {
    return makeMapping(500, err);
  }
  return {
    status: 500,
    body: { error: { code: "internal_error", message: SAFE_MESSAGE_FALLBACK } },
  };
};

const makeMapping = (status: number, err: AppError): HttpErrorMapping => ({
  status,
  body: { error: { code: err.code, message: err.message } },
});
