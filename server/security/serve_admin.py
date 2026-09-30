#!/usr/bin/env python3
"""Serve il bundle admin su loopback, dietro Caddy HTTPS o tunnel SSH."""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(os.environ.get("TAOTL_ADMIN_DIST", str(Path.home() / ".local/share/taotl-admin/current"))).resolve()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.headers.get("Host") not in ("127.0.0.1:8095", "localhost:8095"):
            self.send_error(403)
            return
        candidate = Path(self.translate_path(self.path)).resolve()
        if not candidate.is_relative_to(ROOT):
            self.send_error(404)
            return
        if not candidate.is_file() and not Path(urlsplit(self.path).path).suffix:
            self.path = "/index.html"
        super().do_GET()

    def do_HEAD(self):
        if self.headers.get("Host") not in ("127.0.0.1:8095", "localhost:8095"):
            self.send_error(403)
            return
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
        super().end_headers()


if __name__ == "__main__":
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Esportare prima il bundle admin nella directory configurata.")
    ThreadingHTTPServer(("127.0.0.1", 8095), Handler).serve_forever()
