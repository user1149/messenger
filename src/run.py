import argparse
import logging
import redis
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import socketio


def parse_args():
    parser = argparse.ArgumentParser(description="Launch the messenger server")
    parser.add_argument("-d", "--debug", action="store_true", help="Debug mode")
    parser.add_argument("--host", default="127.0.0.1", help="Host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5000, help="Port (default: 5000)")
    parser.add_argument("--unsafe", action="store_true", help="Allow Werkzeug in production")
    return parser.parse_args()


def setup_logging(debug):
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s [%(levelname)s] %(message)s")


def check_redis(app):

    redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')

    try:
        client = redis.from_url(redis_url, socket_connect_timeout=3)
        client.ping()
        app.logger.info("Redis is available.")
    except (redis.ConnectionError, redis.TimeoutError, redis.RedisError) as e:
        app.logger.error(f"Redis is NOT available: {e}")
        sys.exit(1)


def main():
    app = create_app()
    args = parse_args()
    setup_logging(args.debug)
    check_redis(app)

    try:
        socketio.run(
            app,
            host=args.host,
            port=args.port,
            debug=args.debug,
            allow_unsafe_werkzeug=args.unsafe,
        )
    except (OSError, KeyboardInterrupt) as e:
        app.logger.error(f"Shutdown: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
