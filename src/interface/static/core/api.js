/**
 * Thin JSON-over-fetch client for the local backend.
 * Centralises method/headers/credentials so the rest of the app only
 * deals with `await api("POST", "/api/foo", body)`.
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const api = async (method, path, body) => {
  const init = {
    method,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  let payload = null;
  if (res.status !== 204) {
    const text = await res.text();
    payload = text.length > 0 ? JSON.parse(text) : null;
  }
  if (!res.ok) {
    const message =
      payload && payload.error && payload.error.message
        ? payload.error.message
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return payload;
};
