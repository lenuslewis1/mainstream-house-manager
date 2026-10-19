import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { Miniflare } from "miniflare";
import "./sites-env.mjs";

const root = process.cwd();
const server = path.join(root, "dist/server");
const config = JSON.parse(fs.readFileSync(path.join(server, "wrangler.json"), "utf8"));
const envFile = [".env.local", ".env"].find(file => fs.existsSync(path.join(root, file)));
const localEnv = envFile ? parseEnv(fs.readFileSync(path.join(root, envFile), "utf8")) : {};
const keys = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "NEON_BRANCH", "NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL", "NEON_AUTH_COOKIE_SECRET", "WORKSPACE_ALLOWED_EMAILS", "WORKSPACE_MANAGER_EMAILS", "OPENAI_API_KEY", "OPENAI_MODEL"];
const bindings = Object.fromEntries(keys.filter(key => process.env[key] || localEnv[key]).map(key => [key, process.env[key] || localEnv[key]]));
const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = portFlag >= 0 ? Number(args[portFlag + 1]) : 8787;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid preview port.");
function moduleFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? moduleFiles(file) : /\.(m?js)$/.test(entry.name) ? [file] : [];
  });
}
const main = path.resolve(server, config.main);
const modules = [main, ...moduleFiles(server).filter(file => file !== main)]
  .map(file => ({ type: "ESModule", path: file }));

// Run the built Worker directly in the same workerd runtime used by Wrangler.
// Avoid the CLI's watch/proxy layer and keep secrets in memory, outside dist.
const runtime = new Miniflare({
  host: "127.0.0.1", port,
  modules,
  modulesRoot: server,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings,
  cf: false,
  assets: { directory: path.resolve(server, config.assets.directory), binding: "ASSETS", routerConfig: { has_user_worker: true } },
});
await runtime.ready;
console.log(`Built Worker ready at http://localhost:${port}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => { await runtime.dispose(); process.exit(0); });
