import { normalizeThemeMetadata } from "./theme-html.mjs";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function addOfflineSupport(output) {
  const register = await readFile(new URL("./offline-register.js", import.meta.url), "utf8");
  const template = await readFile(new URL("./service-worker.js", import.meta.url), "utf8");
  let html = normalizeThemeMetadata(await readFile(join(output, "index.html"), "utf8"));
  if (!html.includes("</head>")) throw new Error("Template HTML web non riconosciuto.");
  html = html.replace('<script defer src="/offline-register.js"></script>', "");
  html = html.replace("</head>", '<script defer src="/offline-register.js"></script></head>');
  await writeFile(join(output, "index.html"), html);
  await writeFile(join(output, "offline-register.js"), register);
  async function filesIn(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    const lists = await Promise.all(entries.map(entry => entry.isDirectory()
      ? filesIn(join(directory, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`]));
    return lists.flat();
  }
  const files = (await filesIn(output)).filter(file =>
    /\.(html|js|css|ttf|woff2?|png|jpe?g|webp|svg|ico)$/.test(file) && file !== "sw.js" || file === "manifest.json",
  ).sort();
  const hash = createHash("sha256").update(template);
  for (const file of files) hash.update(file).update(await readFile(join(output, file)));
  const version = hash.digest("hex").slice(0, 20);
  const worker = template.replace("__BUILD_ID__", JSON.stringify(version))
    .replace("__PRECACHE_FILES__", JSON.stringify(files.map(file => `/${file}`)))
    .replace("__INDEX_HASH__", JSON.stringify(createHash("sha256").update(html).digest("hex")));
  await writeFile(join(output, "sw.js"), worker);
  console.log(`Offline web pronto: ${files.length} file, versione ${version}`);
}
