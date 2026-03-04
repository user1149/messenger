"""Точка входа для запуска."""
import argparse
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import socketio

def parse_args():
    parser = argparse.ArgumentParser(description="Запуск сервера мессенджера")
    parser.add_argument("-d", "--debug", action="store_true", help="Режим отладки")
    parser.add_argument("--host", default="127.0.0.1", help="Хост (по умолч. 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5000, help="Порт (по умолч. 5000)")
    parser.add_argument("--unsafe", action="store_true", help="Разрешить Werkzeug в production")
    return parser.parse_args()


def setup_logging(debug):
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s [%(levelname)s] %(message)s")


def main():
    args = parse_args()
    setup_logging(args.debug)

    app = create_app()

    try:
        socketio.run(
            app,
            host=args.host,
            port=args.port,
            debug=args.debug,
            allow_unsafe_werkzeug=args.unsafe,
        )
    except (OSError, KeyboardInterrupt) as e:
        app.logger.error(f"Остановка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
