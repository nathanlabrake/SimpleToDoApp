# Simple To-Do App

A small to-do web app with:
- Registration (email + password)
- Login
- A landing page with menu links to login and registration
- Multiple named to-do lists per user
- Up to 100 items per list
- Lists sorted by creation date on the home page

## Run locally

1. Ensure Python 3.10+ is installed.
2. From this project folder, run:
   ```bash
   python3 server.py
   ```
3. Open: http://localhost:4173

The app uses SQLite (`todo.db`) automatically and creates these tables:
- `users` (`id`, `email`, `password`)
- `todo_lists` (`id`, `user_id`, `title`, `created_at`)
- `todo_items` (`id`, `list_id`, `content`, `created_at`)
