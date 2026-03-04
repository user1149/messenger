Messenger App
=============

Messaging application with private and group chats, and live message delivery.
Built as a modular component of a larger system.

Tech Stack
----------

Backend: Flask, Flask-SocketIO, SQLAlchemy
Database: SQLite (development), PostgreSQL (production)
Cache & real-time: Redis
Frontend: Static HTML/JS served from static/

Getting Started
---------------

Prerequisites

- Python 3.9+
- Redis server running locally (or via Docker)

Installation

1. Clone the repository
   git clone https://github.com/user1149/messanger.git
   cd messanger

2. Create and activate a virtual environment
   python -m venv venv
   source venv/bin/activate

3. Install dependencies
   pip install -r requirements.txt

4. Configure environment variables
   cp .env.example .env
   Edit .env if needed (see Configuration below).

5. Run the application
   python run.py

The app will be available at http://localhost:5000.

Configuration
-------------

Key environment variables (see .env.example for all options):

FLASK_ENV - development, production, or testing (default: development)
SECRET_KEY - secret key for sessions (change in production!) (default: dev-secret-key-change-me)
DATABASE_URL - database connection string (default: sqlite:///messenger.db)
REDIS_URL - Redis connection string (default: redis://localhost:6379/0)
CORS_ORIGINS - comma-separated allowed origins (default: http://localhost:3000)

License
-------

GPLv3
