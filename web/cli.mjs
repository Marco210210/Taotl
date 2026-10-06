import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const action = process.argv[2];
if (!["build", "dev"].includes(action)) throw new Error("Usa dev oppure build.");
const args = action === "build"
  ? ["export", "--platform", "web", "--output-dir", "web-build", "--max-workers", "2"]
  : ["start", "--web", "--port", "8090"];
const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), ...args, ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, TAOTL_WEB_BUILD: "1", TAOTL_ADMIN_BUILD: "0", TAOTL_EXPO_GO: "0" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
