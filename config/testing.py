"""Testing конфигурация."""
import os
from .base import BaseConfig


class TestingConfig(BaseConfig):
    """Конфигурация для testing окружения."""
    
    DEBUG = False
    TESTING = True
    
    # Для тестов используем in-memory БД
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    # Для in-memory SQLite нельзя передавать pool_size/pool_recycle.
    # Используем StaticPool, чтобы один connection держался на весь процесс тестов.
    from sqlalchemy.pool import StaticPool
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }
    
    # Отключаем CSRF для тестов
    WTF_CSRF_ENABLED = False
    
    # Session cookies не требуют HTTPS в тестах
    SESSION_COOKIE_SECURE = False

    # Тесты должны работать изолированно, не трогая реальный redis db.
    REDIS_URL = os.getenv("REDIS_URL_TEST", "redis://localhost:6379/15")
