"""API маршруты регистрация."""
from .v1 import register_api_v1


def register_api_routes(app):
    """Регистрация всех API routes."""
    register_api_v1(app)
