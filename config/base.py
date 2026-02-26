"""Базовая конфигурация приложения."""
import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Базовая конфигурация."""
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "sqlite:///messenger.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 10,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
        "connect_args": {
            "check_same_thread": False
        } if "sqlite" in (os.getenv("DATABASE_URL", "sqlite:///messenger.db")) else {}
    }
    
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY not set in environment")
    
    # URLs
    BASE_URL = os.getenv("BASE_URL")
    if not BASE_URL:
        raise ValueError("BASE_URL not set in environment")
    
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Session
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "True").lower() == "true"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Strict"
    
    # CORS
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ]
    
    # CSRF
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None
    
    # Rate Limits (from constants)
    RATE_LIMITS = {
        "new_message": 4,
        "create_private_chat": 1,
        "join_chat": 3,
        "typing": 2,
        "mark_read": 5,
    }
    LOGIN_RATE_LIMIT_ATTEMPTS = 10
    LOGIN_RATE_LIMIT_PERIOD = 900  # 15 minutes
    
    PHONE_CODE_EXPIRATION = 300
    PHONE_SESSION_EXPIRATION = 1800
