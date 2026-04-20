import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mapErrorToHttp } from "./errors.js";
import { checkOrigin } from "./origin-guard.js";
import { matchRoute } from "./router.js";
import { applySecurityHeaders } from "./security-headers.js";
import { parseSessionCookie } from "./session.js";
import { StaticAssetServer } from "./static-handler.js";
import type { AppContext } from "./handlers/types.js";

export interface HttpServerOptions {
  readonly host: string;
  readonly port: number;
  readonly staticRoot: string;
  readonly indexFile: string;
  readonly ctx: AppContext;
}

export interface RunningServer {
  readonly server: Server;
  readonly url: string;
  close(): Promise<void>;
}

const writeJson = (
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  applySecurityHeaders((k, v) => res.setHeader(k, v));
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const payload = JSON.stringify(body);
  res.setHeader("Content-Length", String(Buffer.byteLength(payload)));
  res.end(payload);
};

const handleApi = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: AppContext,
): Promise<void> => {
  const matched = matchRoute(req.method ?? "GET", url.pathname);
  if (matched === null) {
    writeJson(res, 404, { error: { code: "not_found", message: "Route not found" } });
    return;
  }
  const sessionId = parseSessionCookie(req.headers.cookie);
  try {
    const result = await matched.handler({
      req,
      res,
      url,
      params: matched.params,
      ctx,
      sessionId,
    });
    if (result.type === "noContent") {
      applySecurityHeaders((k, v) => res.setHeader(k, v));
      for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
      res.statusCode = 204;
      res.end();
      return;
    }
    writeJson(res, result.status ?? 200, result.body, result.headers);
  } catch (err) {
    const mapped = mapErrorToHttp(err);
    writeJson(res, mapped.status, mapped.body);
  }
};

export const startHttpServer = async (
  options: HttpServerOptions,
): Promise<RunningServer> => {
  const staticServer = new StaticAssetServer({
    rootDir: options.staticRoot,
    indexFile: options.indexFile,
  });

  const server = createServer((req, res) => {
    const method = req.method ?? "GET";
    const guard = checkOrigin(
      method,
      req.headers.host,
      typeof req.headers.origin === "string" ? req.headers.origin : undefined,
      { host: options.host, port: options.port },
    );
    if (!guard.ok) {
      writeJson(res, guard.status, {
        error: { code: "origin_rejected", message: guard.reason },
      });
      return;
    }

    const host = req.headers.host ?? `${options.host}:${options.port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname.startsWith("/api/")) {
      void handleApi(req, res, url, options.ctx);
      return;
    }
    if (method === "GET" || method === "HEAD") {
      const served = staticServer.serve(url.pathname, res);
      if (!served) {
        writeJson(res, 404, {
          error: { code: "not_found", message: "Asset not found" },
        });
      }
      return;
    }
    writeJson(res, 405, {
      error: { code: "method_not_allowed", message: "Method not allowed" },
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => reject(err);
    server.once("error", onError);
    server.listen(options.port, options.host, () => {
      server.off("error", onError);
      resolve();
    });
  });

  return {
    server,
    url: `http://${options.host}:${options.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err === undefined ? resolve() : reject(err)));
      }),
  };
};
