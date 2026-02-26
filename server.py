from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DB_PATH = BASE_DIR / "todo.db"
MAX_ITEMS = 100


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS todo_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS todo_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                list_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (list_id) REFERENCES todo_lists(id) ON DELETE CASCADE
            );
            """
        )


class TodoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api_get(parsed.path)
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self.send_error(HTTPStatus.NOT_FOUND, "Not found")
        return self.handle_api_post(parsed.path)

    def handle_api_get(self, path: str):
        if path.startswith("/api/users/") and path.endswith("/lists"):
            parts = path.strip("/").split("/")
            user_id = int(parts[2])
            return self.get_lists(user_id)
        return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def handle_api_post(self, path: str):
        data = self.read_json_body()
        if data is None:
            return self.send_json({"error": "Invalid JSON"}, HTTPStatus.BAD_REQUEST)

        if path == "/api/register":
            return self.register(data)
        if path == "/api/login":
            return self.login(data)
        if path.startswith("/api/users/") and path.endswith("/lists"):
            parts = path.strip("/").split("/")
            user_id = int(parts[2])
            return self.create_list(user_id, data)
        if path.startswith("/api/lists/") and path.endswith("/items"):
            parts = path.strip("/").split("/")
            list_id = int(parts[2])
            return self.create_item(list_id, data)

        return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def register(self, data: dict):
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not email or "@" not in email or len(password) < 6:
            return self.send_json({"error": "Email and password (min 6 chars) are required."}, HTTPStatus.BAD_REQUEST)

        try:
            with sqlite3.connect(DB_PATH) as conn:
                cur = conn.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, password))
                user_id = cur.lastrowid
            return self.send_json({"id": user_id, "email": email}, HTTPStatus.CREATED)
        except sqlite3.IntegrityError:
            return self.send_json({"error": "An account with this email already exists."}, HTTPStatus.CONFLICT)

    def login(self, data: dict):
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute(
                "SELECT id, email FROM users WHERE email = ? AND password = ?", (email, password)
            ).fetchone()

        if not row:
            return self.send_json({"error": "Invalid email or password."}, HTTPStatus.UNAUTHORIZED)
        return self.send_json({"id": row[0], "email": row[1]}, HTTPStatus.OK)

    def get_lists(self, user_id: int):
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            lists = conn.execute(
                "SELECT id, user_id AS userId, title, created_at AS createdAt FROM todo_lists WHERE user_id = ? ORDER BY datetime(created_at) DESC",
                (user_id,),
            ).fetchall()

            payload = []
            for list_row in lists:
                items = conn.execute(
                    "SELECT id, list_id AS listId, content, created_at AS createdAt FROM todo_items WHERE list_id = ? ORDER BY datetime(created_at) ASC",
                    (list_row["id"],),
                ).fetchall()
                payload.append(
                    {
                        "id": list_row["id"],
                        "userId": list_row["userId"],
                        "title": list_row["title"],
                        "createdAt": list_row["createdAt"],
                        "items": [dict(item) for item in items],
                    }
                )

        return self.send_json(payload, HTTPStatus.OK)

    def create_list(self, user_id: int, data: dict):
        title = str(data.get("title", "")).strip()
        if not title:
            return self.send_json({"error": "List title is required."}, HTTPStatus.BAD_REQUEST)

        created_at = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(DB_PATH) as conn:
            user_exists = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
            if not user_exists:
                return self.send_json({"error": "User not found."}, HTTPStatus.NOT_FOUND)

            cur = conn.execute(
                "INSERT INTO todo_lists (user_id, title, created_at) VALUES (?, ?, ?)",
                (user_id, title, created_at),
            )

        return self.send_json(
            {"id": cur.lastrowid, "userId": user_id, "title": title, "createdAt": created_at, "items": []},
            HTTPStatus.CREATED,
        )

    def create_item(self, list_id: int, data: dict):
        content = str(data.get("content", "")).strip()
        if not content:
            return self.send_json({"error": "Item content is required."}, HTTPStatus.BAD_REQUEST)

        created_at = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(DB_PATH) as conn:
            list_exists = conn.execute("SELECT id FROM todo_lists WHERE id = ?", (list_id,)).fetchone()
            if not list_exists:
                return self.send_json({"error": "List not found."}, HTTPStatus.NOT_FOUND)

            count = conn.execute("SELECT COUNT(*) FROM todo_items WHERE list_id = ?", (list_id,)).fetchone()[0]
            if count >= MAX_ITEMS:
                return self.send_json({"error": f"Each list is limited to {MAX_ITEMS} items."}, HTTPStatus.BAD_REQUEST)

            cur = conn.execute(
                "INSERT INTO todo_items (list_id, content, created_at) VALUES (?, ?, ?)",
                (list_id, content, created_at),
            )

        return self.send_json(
            {"id": cur.lastrowid, "listId": list_id, "content": content, "createdAt": created_at},
            HTTPStatus.CREATED,
        )

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def send_json(self, payload, status: HTTPStatus):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", 4173), TodoHandler)
    print("Simple To-Do app running on http://localhost:4173")
    server.serve_forever()
