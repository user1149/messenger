"""Development конфигурация."""
from .base import BaseConfig


class DevelopmentConfig(BaseConfig):
    """Конфигурация для development окружения."""
    
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False
    
    # Для development разрешаем localhost
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ]
