from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import sqlite3


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("ORDER_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "order-work.sqlite3"
STATE_KEY = "app_state"


def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
    return connection


def read_state():
    with db() as connection:
        row = connection.execute(
            "SELECT value FROM app_state WHERE key = ?", (STATE_KEY,)
        ).fetchone()
    if not row:
        return {}
    try:
        return json.loads(row[0])
    except json.JSONDecodeError:
        return {}


def write_state(value):
    payload = json.dumps(value, ensure_ascii=False)
    with db() as connection:
        connection.execute(
            """
            INSERT INTO app_state (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (STATE_KEY, payload),
        )


class OrderHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True})
            return
        if path == "/api/state":
            self.send_json(200, read_state())
            return
        return super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        if path != "/api/state":
            self.send_error(404)
            return
        try:
            payload = self.read_json()
            write_state(payload)
            self.send_json(200, {"ok": True})
        except Exception as error:
            self.send_json(400, {"ok": False, "error": str(error)})


def main():
    port = int(os.environ.get("PORT", "5173"))
    server = ThreadingHTTPServer(("0.0.0.0", port), OrderHandler)
    print(f"Order Work server listening on 0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
