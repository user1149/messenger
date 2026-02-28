import os

import redis
from redis import ConnectionPool
from typing import Optional

from flask import Flask, jsonify, request, redirect, url_for

from app.models.user import User
from config import DevelopmentConfig, ProductionConfig, TestingConfig
from app.extensions import db, login_manager, socketio, csrf
from app.di import Container
from app.middleware import register_error_handlers, register_cors_headers
from app.logging import init_logging
from app.socket import register_socket_handlers


def create_app(config_object: Optional[object] = None) -> Flask:
    """Создание и конфигурирование Flask приложения."""
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
    )

    # Загрузка конфигурации
    if config_object is None:
        env = os.getenv("FLASK_ENV", "development")
        if env == "production":
            config_object = ProductionConfig
        elif env == "testing":
            config_object = TestingConfig
        else:
            config_object = DevelopmentConfig
    
    app.config.from_object(config_object)
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB

    init_logging(app)

    # Инициализация расширений
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login_page"
    csrf.init_app(app)

    @login_manager.unauthorized_handler
    def unauthorized():
        # Для API и XHR возвращаем JSON, для браузера — редирект на страницу логина
        if request.path.startswith("/api") or request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({"error": "Unauthorized"}), 401
        return redirect(url_for(login_manager.login_view))

    @login_manager.user_loader
    def load_user(user_id: str) -> Optional[User]:
        return db.session.get(User, int(user_id))

    # Инициализация Redis
    pool = ConnectionPool.from_url(
        app.config["REDIS_URL"],
        max_connections=20,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_keepalive=True
    )
    redis_client = redis.Redis(connection_pool=pool)
    app.redis_client = redis_client
    if app.testing:
        try:
            redis_client.flushdb()
        except Exception:  # pragma: no cover
            app.logger.exception("Failed to flush test Redis DB")

    # Создание контейнера зависимостей
    app.container = Container(db.session, redis_client, app.config)

    # Регистрация Web UI и legacy API (используются фронтом из `static/`)
    from app.controllers import auth_controller, pages_controller, api_controller
    app.register_blueprint(auth_controller.bp)
    app.register_blueprint(pages_controller.bp)
    app.register_blueprint(api_controller.bp)

    # Регистрация новых API endpoints
    from app.api import register_api_routes
    register_api_routes(app)

    # Инициализация Socket.IO
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        message_queue=app.config["REDIS_URL"],
        async_mode="threading",
    )
    register_socket_handlers(socketio, app.container)

    # Регистрация обработчиков ошибок и CORS
    register_error_handlers(app)
    register_cors_headers(app)

    # Инициализация базы данных (удобно для dev/testing; для prod лучше миграции)
    if app.debug or app.testing:
        with app.app_context():
            db.create_all()

    return app

