[![Russian](https://img.shields.io/badge/Русский-README-blue)](README.ru.md)

Messenger App
=============

Messaging application with private and group chats, real-time message delivery,
presence tracking, and avatar support.
Built as a modular, service-oriented Flask application.

Tech Stack
----------

Backend:  Flask, Flask-SocketIO, Flask-Login, Flask-WTF, SQLAlchemy, Marshmallow
Database: SQLite (development), PostgreSQL (production)
Cache & real-time: Redis (session store, rate limiting, presence, message queue)


Quick Start
-----------

Prerequisites

- Python 3.9+
- Node.js 18+ and npm (for frontend build)
- Docker (recommended for Redis, or Redis server locally)

Installation & Setup

### Step 1: Clone and Setup Environment

```bash
git clone https://github.com/nosay-arch/messenger.git
cd messenger/project

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables

Create a `.env` file in the `project/` directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and configure as needed:

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your_secret_key_here_min_32_chars_long
BASE_URL=http://localhost:5000

# Database (SQLite for development)
# Use absolute path for SQLite, or PostgreSQL for production
DATABASE_URL=sqlite:////absolute/path/to/instance/messenger.db

# Redis
REDIS_URL=redis://localhost:6379/0

# Security (set to False for development, True for production)
SESSION_COOKIE_SECURE=False

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
```

### Step 3: Start Redis

**Option A: Using Docker (Recommended)**

```bash
docker pull redis:latest
docker run --name messenger-redis -p 6379:6379 -d redis
```

**Option B: Using Local Installation**

```bash
# On macOS with Homebrew
brew install redis
redis-server

# On Linux
sudo apt-get install redis-server
redis-server

# On Windows with WSL
wsl
sudo apt-get install redis-server
redis-server
```

To stop Redis:

```bash
# Docker
docker stop messenger-redis
docker rm messenger-redis

# Local
# Ctrl+C in the terminal where redis-server is running
```

### Step 4: Verify Database Directory

The app creates SQLite database in `project/instance/messenger.db`. 
Make sure the `instance/` directory exists:

```bash
mkdir -p instance
```

### Step 5: Run the Backend

```bash
cd project
python run.py
```

The server will start on `http://localhost:5000` in debug mode.

Command line options:

```bash
python run.py --help

# Run on specific host/port
python run.py --host 0.0.0.0 --port 8000

# Run in debug mode
python run.py -d
```

### Step 6: Build & Run Frontend (Optional)

In a separate terminal:

```bash
cd frontend
npm install
npm start  # for development with webpack
# or
npm run build  # to build production bundle
```

The frontend will be available at `http://localhost:3000` (if webpack dev server is configured).


Troubleshooting
---------------

### "unable to open database file"

**Problem**: SQLite can't create the database file

**Solution**:
```bash
# Make sure instance directory exists
mkdir -p project/instance

# Verify DATABASE_URL in .env uses absolute path:
DATABASE_URL=sqlite:////full/path/to/instance/messenger.db
```

### "Redis is NOT available" 

**Problem**: Redis connection fails on startup

**Solution**:
```bash
# Check if Redis is running
redis-cli ping  # Should respond with PONG

# If not running, start it
docker run -p 6379:6379 -d redis

# Or if using local installation
redis-server
```

To run without Redis checks (not recommended):
- Remove the `check_redis()` call from `run.py`

### "Connection refused" on localhost:5000

**Problem**: Port 5000 is already in use

**Solution**:
```bash
# Use a different port
python run.py --port 8000

# Or find and kill the app using port 5000
lsof -i :5000  # on macOS/Linux
netstat -ano | findstr :5000  # on Windows
```

### "ModuleNotFoundError"

**Problem**: Dependencies not installed

**Solution**:
```bash
pip install -r requirements.txt
```

### "CORS errors" in browser console

**Problem**: Frontend can't reach backend API

**Solution**: Update CORS_ORIGINS in `.env`:
```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Then restart the Flask app.

### Frontend build issues

**Problem**: `npm install` fails or module not found

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```


Configuration
-------------

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | development | Flask environment mode |
| `SECRET_KEY` | dev-insecure-... | Flask secret key (change in production!) |
| `DATABASE_URL` | sqlite:// | Database connection URL |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection URL |
| `BASE_URL` | http://localhost:5000 | Application base URL |
| `SESSION_COOKIE_SECURE` | False | HTTPS-only cookies (True in production) |
| `CORS_ORIGINS` | http://localhost:3000 | Allowed cross-origin URLs |

### Database Setup

**Development**: Uses SQLite (auto-created from models)

**Production**: Set `DATABASE_URL` to PostgreSQL:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/messenger_prod
```

Then create tables:
```bash
python -c "from app import create_app; app = create_app(); app.app_context().push(); from app.core.extensions import db; db.create_all()"
```


Running Tests
-------------

```bash
pytest tests/
pytest tests/ --cov=app  # with coverage report
```


API Documentation
-----------------

Key endpoints:

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/chats` - List user's chats
- `POST /api/chats` - Create private chat
- `WebSocket /socket.io` - Real-time messaging

For detailed API docs, see the routes in `app/modules/*/routes.py`


Project Structure
-----------------

```
project/
├── app/
│   ├── core/           # Core app configuration and setup
│   ├── models/         # SQLAlchemy models
│   ├── modules/        # Feature modules (auth, chats, messages, etc)
│   └── socket/         # WebSocket handlers
├── frontend/           # React frontend (TypeScript)
├── templates/          # Jinja2 HTML templates
├── static/             # CSS, JS bundles
├── tests/              # Pytest test suite
├── instance/           # SQLite database (created at runtime)
└── run.py              # Application entry point
```


Contact & Support
-----------------

For issues and questions, please open an issue on GitHub.


   Optional flags:
     --debug          Enable debug mode
     --host 0.0.0.0   Bind to all interfaces (default: 127.0.0.1)
     --port 8080       Custom port (default: 5000)
     --unsafe          Allow Werkzeug reloader in production

The app will be available at http://localhost:5000.

Configuration
-------------

Key environment variables (see .env.example for all options):

FLASK_ENV          - development, production, or testing (default: development)
SECRET_KEY         - secret key for sessions (change in production!)
DATABASE_URL       - database connection string (default: sqlite:///instance/messenger.db)
REDIS_URL          - Redis connection string (default: redis://localhost:6379/0)
REDIS_URL_TEST     - Redis DB for tests (default: redis://localhost:6379/15)
BASE_URL           - base URL of the application (default: http://localhost:5000)
CORS_ORIGINS       - comma-separated allowed origins (default: http://localhost:3000)
SESSION_COOKIE_SECURE - set to False in development (default: True)

Rate limits (requests per second, configured in code):

new_message         - 4 per second
create_private_chat - 1 per second
join_chat           - 3 per second
typing              - 2 per second
mark_read           - 5 per second
login attempts      - 10 per 15 minutes per IP

Features
--------

- Username / password authentication with session cookies
- Per-IP login rate limiting (Redis)
- Private chats (one-to-one, auto-created on first message)
- Group chats with creator-managed membership
- Real-time message delivery via Socket.IO (WebSocket)
- Typing indicators broadcast to chat participants
- Message editing and soft-deletion within a 5-minute window
- Unread message counters per chat
- User presence (online / offline) tracked via Redis TTL
- User search by username prefix
- Avatar upload (PNG, JPG, GIF; max 10 MB)
- User bio / profile page
- CSRF protection on all state-changing HTTP routes
- Structured audit logging (login, registration, message edits/deletions)
- Custom JSON error responses for all application exceptions
- DI container for clean dependency management across services

Running Tests
-------------

pytest
pytest --cov=app

Tests use an in-memory SQLite database and Redis DB 15 (configurable via REDIS_URL_TEST).
CSRF is disabled automatically in the testing configuration.

Production Deployment
---------------------

1. Set FLASK_ENV=production in your environment.
2. Use a real SECRET_KEY (long random string).
3. Set DATABASE_URL to your PostgreSQL connection string.
4. Set SESSION_COOKIE_SECURE=True (already the default in production).
5. Run with Gunicorn + eventlet or gevent for async Socket.IO support:
   gunicorn -k eventlet -w 1 "app:create_app()"

License
-------

GPLv3
