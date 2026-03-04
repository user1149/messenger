"""Точка входа приложения для запуска сервера."""
import argparse

from app import create_app
from app.extensions import socketio


def parse_args():
    """Парсинг командной строки аргументов."""
    import os
    parser = argparse.ArgumentParser(description="Run messenger app")
    parser.add_argument(
        "--debug",
        "-d",
        action="store_true",
        help="Enable debug mode"
    )
    parser.add_argument(
        "--host",
        default=os.getenv("HOST", "127.0.0.1"),
        help="Host to run on"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "5000")),
        help="Port to run on"
    )
    return parser.parse_args()


if __name__ == "__main__":
    app = create_app()
    args = parse_args()
    socketio.run(
        app,
        debug=args.debug,
        host=args.host,
        port=args.port,
        allow_unsafe_werkzeug=True
    )

