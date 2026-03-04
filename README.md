# Messenger App

Real‑time messaging application, private and group chats, and live message delivery.  
Built as a modular component of a larger system.

---

## Tech Stack

- **Backend**: Flask, Flask‑SocketIO, SQLAlchemy  
- **Database**: SQLite (development), PostgreSQL (production)  
- **Cache & real‑time**: Redis  
- **Frontend**: Static HTML/JS served from `static/`  

---

## Getting Started

### Prerequisites

- Python 3.9+
- Redis server running locally (or via Docker)

### Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/user1149/messanger.git
   cd messanger
   ```

2. **Create and activate a virtual environment**  
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**  
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**  
   ```bash
   cp .env.example .env
   ```
   Edit `.env` if needed (see [Configuration](#configuration) below).

5. **Run the application**  
   ```bash
   python run.py
   ```

The app will be available at `http://localhost:5000`.

---

## Configuration

Key environment variables (see `.env.example` for all options):

| Variable           | Description                                      | Default                     |
|--------------------|--------------------------------------------------|-----------------------------|
| `FLASK_ENV`        | `development`, `production`, or `testing`        | `development`               |
| `SECRET_KEY`       | Secret key for sessions (change in production!)  | `dev-secret-key-change-me`  |
| `DATABASE_URL`     | Database connection string                       | `sqlite:///messenger.db`    |
| `REDIS_URL`        | Redis connection string                          | `redis://localhost:6379/0`  |
| `CORS_ORIGINS`     | Comma‑separated allowed origins                  | `http://localhost:3000`     |

---

## License

[MIT](LICENSE)
