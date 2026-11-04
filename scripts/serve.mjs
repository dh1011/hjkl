import { startProdServer } from "vinext/server/prod-server";
import path from "node:path";

const { server } = await startProdServer({
  port: Number(process.env.PORT ?? 3000),
  host: "0.0.0.0",
  outDir: path.resolve("dist"),
});

// Handle container stop signals even when Node runs as PID 1.
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
