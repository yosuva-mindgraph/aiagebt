#!/usr/bin/env python3
"""Serve the repo on localhost with caching disabled, so a refresh always shows the current build.

    python3 serve.py            # http://localhost:8765/dist/stand.html
    python3 serve.py 9000       # another port
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

if __name__ == "__main__":
    print(f"AIB Presenter  →  http://localhost:{PORT}/dist/stand.html   (keyed)")
    print(f"                  http://localhost:{PORT}/dist/index.html   (keyless)")
    print(f"                  http://localhost:{PORT}/index.html        (dev, loads src/)")
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCache).serve_forever()
