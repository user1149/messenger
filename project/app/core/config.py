import os
from dotenv import load_dotenv
from sqlalchemy.pool import StaticPool

load_dotenv()

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


class BaseConfig:
    default_db_path = os.path.join(basedir, 'instance', 'messenger.db')
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URI.lower()

    if _is_sqlite:
        SQLALCHEMY_ENGINE_OPTIONS = {
            "connect_args": {"check_same_thread": False},
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_size": 10,
            "pool_recycle": 3600,
            "pool_pre_ping": True,
            "connect_args": {},
        }

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-key-change-in-production")

    BASE_URL = os.getenv("BASE_URL", "http://localhost:5000")

    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "True").lower() == "true"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Strict"

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ]

    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None

    RATE_LIMITS = {
        "new_message": 4,
        "create_private_chat": 1,
        "join_chat": 3,
        "typing": 2,
        "mark_read": 5,
    }
    LOGIN_RATE_LIMIT_ATTEMPTS = 10
    LOGIN_RATE_LIMIT_PERIOD = 900


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False

    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ]


class TestingConfig(BaseConfig):
    DEBUG = False
    TESTING = True

    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }

    WTF_CSRF_ENABLED = False
    SESSION_COOKIE_SECURE = False
    REDIS_URL = os.getenv("REDIS_URL_TEST", "redis://localhost:6379/15")


class ProductionConfig(BaseConfig):
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Strict"