import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY not set")

    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///messenger.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    BASE_URL = os.getenv('BASE_URL')
    if not BASE_URL:
        raise ValueError("BASE_URL not set")

    RATE_LIMITS = {
        'new_message': 4,
        'create_private_chat': 1,
        'join_chat': 3,
        'typing': 2,
        'mark_read': 5,
    }

    LOGIN_RATE_LIMIT_ATTEMPTS = 10
    LOGIN_RATE_LIMIT_PERIOD = 900

    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    if not MAIL_USERNAME:
        raise ValueError("MAIL_USERNAME not set")
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    if not MAIL_PASSWORD:
        raise ValueError("MAIL_PASSWORD not set")
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', MAIL_USERNAME)
    CONFIRMATION_TOKEN_EXPIRATION = 60 * 60 * 24

    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    CORS_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')]

class DevelopmentConfig(Config):
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

class ProductionConfig(Config):
    DEBUG = False

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
