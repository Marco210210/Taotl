import { spawnSync } from "node:child_process";
import { cp, copyFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".local/admin-web-build");
const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), "export",
  "--platform", "web", "--output-dir", output, "--max-workers", "2"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, TAOTL_ADMIN_BUILD: "1", TAOTL_WEB_BUILD: "0", TAOTL_EXPO_GO: "0" },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Solo la build amministrativa riceve manifest, icone e titolo dedicati.
await cp(path.join(root, "admin/public"), output, { recursive: true });
await copyFile(path.join(output, "admin-favicon.ico"), path.join(output, "favicon.ico"));
// Aggiorna anche gli URL usati da eventuali collegamenti salvati in precedenza.
await copyFile(path.join(output, "admin-icon-192.png"), path.join(output, "logo192.png"));
await copyFile(path.join(output, "admin-icon-512.png"), path.join(output, "logo512.png"));
const indexPath = path.join(output, "index.html");
let html = await readFile(indexPath, "utf8");
if (!html.includes('href="/logo192.png"') || !html.includes("</head>")) {
  throw new Error("Template HTML cambiato: verificare i metadati dell'app admin prima di pubblicare.");
}
html = html.replace(/<title>[^<]*<\/title>/, "<title>Taotl Admin</title>")
  .replace('href="/logo192.png"', 'href="/admin-icon-180.png"')
  .replace('href="/favicon.ico"', 'href="/admin-favicon.ico"')
  .replace("</head>", '<meta name="apple-mobile-web-app-title" content="Taotl Admin" /></head>');
await writeFile(indexPath, html);
console.log(`Build Taotl Admin pronta: ${output}`);
