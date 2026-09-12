/**
 * Launch Vitest from a canonical project root.
 *
 * Vitest 5.0.0 on Windows loads two runtime copies when the cwd drive letter
 * case differs from Vite's module ids (`c:/` vs `C:/`). The first `describe()`
 * then throws: Cannot read properties of undefined (reading 'config').
 * Force an uppercase drive before spawning the CLI.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

function canonicalRoot() {
  const fromMeta = fileURLToPath(new URL("..", import.meta.url));
  if (process.platform !== "win32") {
    return fromMeta;
  }
  return fromMeta.replace(/^([a-zA-Z]):/, (drive) => drive.toUpperCase());
}

const root = canonicalRoot();
const vitestCli = path.join(root, "node_modules", "vitest", "vitest.mjs");
const child = spawn(process.execPath, [vitestCli, ...process.argv.slice(2)], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
