"""Production конфигурация."""
from .base import BaseConfig


class ProductionConfig(BaseConfig):
    """Конфигурация для production окружения."""
    
    DEBUG = False
    TESTING = False
    
    # Production требует HTTPS
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Strict"
