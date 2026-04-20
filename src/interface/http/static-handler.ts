import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";
import { applySecurityHeaders } from "./security-headers.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export interface StaticServerOptions {
  readonly rootDir: string;
  readonly indexFile: string;
}

export class StaticAssetServer {
  private readonly rootDir: string;
  private readonly rootReal: string;
  private readonly indexFile: string;

  constructor(options: StaticServerOptions) {
    this.rootDir = resolve(options.rootDir);
    // Resolve symlinks once at startup so we have a stable real path
    // to compare against on each request. Falls back to the literal
    // path if the directory doesn't exist yet (tests).
    try {
      this.rootReal = realpathSync(this.rootDir);
    } catch {
      this.rootReal = this.rootDir;
    }
    this.indexFile = options.indexFile;
  }

  serve(pathname: string, res: ServerResponse): boolean {
    const requested = pathname === "/" ? `/${this.indexFile}` : pathname;
    let decoded: string;
    try {
      decoded = decodeURIComponent(requested);
    } catch {
      return false;
    }
    if (decoded.includes("\0")) return false;
    const safe = normalize(decoded).replace(/^([/\\])+/, "");
    const candidate = join(this.rootDir, safe);

    const resolved = this.resolveSafely(candidate);
    if (resolved !== null) {
      let stat;
      try {
        stat = statSync(resolved);
      } catch {
        return this.serveIndexFallback(res);
      }
      if (!stat.isFile()) return false;
      this.write(resolved, res);
      return true;
    }
    return this.serveIndexFallback(res);
  }

  private serveIndexFallback(res: ServerResponse): boolean {
    const indexCandidate = join(this.rootDir, this.indexFile);
    const resolved = this.resolveSafely(indexCandidate);
    if (resolved === null) return false;
    if (!existsSync(resolved)) return false;
    this.write(resolved, res);
    return true;
  }

  /**
   * Resolve symlinks and ensure the result is contained within the
   * real root directory. Returns null on any escape attempt or if
   * the path doesn't exist.
   */
  private resolveSafely(candidate: string): string | null {
    let real: string;
    try {
      real = realpathSync(candidate);
    } catch {
      return null;
    }
    const rel = relative(this.rootReal, real);
    if (rel === "") return real; // root itself
    if (rel.startsWith("..") || isAbsolute(rel)) return null;
    if (rel.split(sep).some((part) => part === "..")) return null;
    return real;
  }

  private write(filePath: string, res: ServerResponse): void {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    const data = readFileSync(filePath);
    applySecurityHeaders((k, v) => res.setHeader(k, v));
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(data.byteLength));
    res.end(data);
  }
}
