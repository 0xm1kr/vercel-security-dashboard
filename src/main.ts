import { loadConfig } from "./config.js";
import { assembleApp } from "./composition-root.js";
import { startHttpServer } from "./interface/http/server.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const app = assembleApp(config);
  const server = await startHttpServer({
    host: config.host,
    port: config.port,
    staticRoot: config.staticRoot,
    indexFile: config.indexFile,
    ctx: app.ctx,
  });

  // eslint-disable-next-line no-console -- intentional CLI output.
  console.log(`Vercel Security Dashboard listening on ${server.url}`);
  console.log(`Data directory: ${config.dataDir}`);

  const isLoopback =
    config.host === "127.0.0.1" ||
    config.host === "::1" ||
    config.host === "localhost";
  if (!isLoopback) {
    console.warn(
      `\n⚠  WARNING: bound to ${config.host} (non-loopback).\n` +
        "   This app is designed for local-only use. The Host/Origin\n" +
        "   allow-list, lack of CSRF tokens, and lack of TLS are NOT\n" +
        "   safe assumptions on a public interface. Use at your own risk.\n",
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}, shutting down…`);
    try {
      await server.close();
    } catch (err) {
      console.error("Error closing HTTP server:", err);
    }
    app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
