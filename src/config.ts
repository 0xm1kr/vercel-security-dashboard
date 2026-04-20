import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `here` resolves to either `<repo>/src` (when running with tsx during
// tests) or `<repo>/dist` (after `npm run build`). The repo root is
// one level up in either case.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const envOrDefault = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : fallback;
};

const envIntOrDefault = (name: string, fallback: number): number => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly dataDir: string;
  readonly databasePath: string;
  readonly vendorRulesDefault: string;
  readonly vendorRulesOverride: string;
  readonly vendorRulesSuggestions: string;
  readonly staticRoot: string;
  readonly indexFile: string;
}

export const loadConfig = (): AppConfig => {
  const dataDir = resolve(envOrDefault("VSD_DATA_DIR", resolve(repoRoot, "data")));
  const host = envOrDefault("VSD_HOST", "127.0.0.1");
  const port = envIntOrDefault("VSD_PORT", 4319);
  return {
    host,
    port,
    dataDir,
    databasePath: resolve(dataDir, "inventory.sqlite"),
    vendorRulesDefault: resolve(repoRoot, "config", "vendor-rules.default.json"),
    vendorRulesOverride: resolve(dataDir, "vendor-rules.override.json"),
    vendorRulesSuggestions: resolve(dataDir, "vendor-rules.suggested.json"),
    // Static assets are served directly from src/ regardless of build
    // mode; they are plain HTML/CSS/JS and need no compilation.
    staticRoot: resolve(repoRoot, "src", "interface", "static"),
    indexFile: "index.html",
  };
};
