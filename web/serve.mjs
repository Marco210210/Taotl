// Anteprima della build statica, senza Metro né accesso ai sorgenti del progetto.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../web-build/", import.meta.url));
const port = Number(process.env.PORT || 8096);
const host = process.env.HOST || "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff2": "font/woff2",
};
await stat(resolve(root, "index.html")).catch(() => { throw new Error("Esegui prima npm run build:web."); });
createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-cache");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = resolve(root, `.${pathname}`);
    if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) {
      response.writeHead(404).end(); return;
    }
    const exists = await stat(file).then((entry) => entry.isFile()).catch(() => false);
    if (!exists) {
      if (pathname.startsWith("/_expo/") || pathname.startsWith("/assets/") || extname(pathname)) {
        response.writeHead(404).end(); return;
      }
      file = resolve(root, "index.html");
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": body.length,
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(400).end();
  }
}).listen(port, host, () => console.log(`Taotl web: http://${host}:${port}`));
