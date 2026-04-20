import type { IncomingMessage } from "node:http";
import { ValidationError } from "../../domain/shared/errors.js";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB; we never expect large payloads.

export const readJsonBody = async (
  req: IncomingMessage,
): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new ValidationError("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError("Request body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
};

export const requireString = (
  body: Record<string, unknown>,
  field: string,
): string => {
  const value = body[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError(`Field "${field}" is required`);
  }
  return value;
};

export const optionalString = (
  body: Record<string, unknown>,
  field: string,
): string | null => {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError(`Field "${field}" must be a string`);
  }
  return value.length === 0 ? null : value;
};

export const optionalBoolean = (
  body: Record<string, unknown>,
  field: string,
): boolean | null => {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") {
    throw new ValidationError(`Field "${field}" must be a boolean`);
  }
  return value;
};

export const optionalStringArray = (
  body: Record<string, unknown>,
  field: string,
): string[] | null => {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new ValidationError(`Field "${field}" must be an array`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new ValidationError(`Field "${field}" must contain strings`);
    }
    out.push(item);
  }
  return out;
};

export const asObject = (raw: unknown): Record<string, unknown> => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError("Body must be a JSON object");
  }
  return raw as Record<string, unknown>;
};
