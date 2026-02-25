"""API v1 endpoints регистрация."""
from . import auth
from . import users


def register_api_v1(app):
    """Регистрация всех v1 endpoints."""
    app.register_blueprint(auth.bp)
    app.register_blueprint(users.bp)
