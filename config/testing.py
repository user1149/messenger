"""Testing конфигурация."""
from .base import BaseConfig


class TestingConfig(BaseConfig):
    """Конфигурация для testing окружения."""
    
    DEBUG = False
    TESTING = True
    
    # Для тестов используем in-memory БД
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    
    # Отключаем CSRF для тестов
    WTF_CSRF_ENABLED = False
    
    # Session cookies не требуют HTTPS в тестах
    SESSION_COOKIE_SECURE = False
