import os

import redis
from redis import ConnectionPool
from typing import Optional

from flask import Flask, jsonify, request, redirect, url_for

from app.models.user import User
from app.config import DevelopmentConfig, ProductionConfig, TestingConfig
from app.extensions import db, login_manager, socketio, csrf
from app.di import Container
from app.utils.logging import init_logging
from app.socket import register_socket_handlers
from app.exceptions.auth_errors import (
    UserNotFoundError,
    UsernameAlreadyExistsError,
    RateLimitExceededError,
    ValidationError,
    PhoneAlreadyExistsError,
    InvalidCodeError,
    CodeExpiredError,
    InvalidCredentialsError
)
from app.exceptions.chat_errors import (
    ChatNotFoundError,
    AccessDeniedError,
    MessageNotFoundError,
    MessageEditTimeExpiredError
)


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
    register_custom_error_handlers(app)
    register_cors(app)

    # Инициализация базы данных (удобно для dev/testing; для prod лучше миграции)
    if app.debug or app.testing:
        with app.app_context():
            db.create_all()

    return app

def register_custom_error_handlers(app: Flask):
    """Регистрация обработчиков для кастомных исключений."""
    @app.errorhandler(UserNotFoundError)
    def handle_user_not_found(error):
        return jsonify({"error": str(error)}), 404

    @app.errorhandler(UsernameAlreadyExistsError)
    def handle_username_already_exists(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(RateLimitExceededError)
    def handle_rate_limit_exceeded(error):
        return jsonify({"error": str(error)}), 429

    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(PhoneAlreadyExistsError)
    def handle_phone_already_exists(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(InvalidCodeError)
    def handle_invalid_code(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(CodeExpiredError)
    def handle_code_expired(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(InvalidCredentialsError)
    def handle_invalid_credentials(error):
        return jsonify({"error": str(error)}), 401

    @app.errorhandler(ChatNotFoundError)
    def handle_chat_not_found(error):
        return jsonify({"error": str(error)}), 404

    @app.errorhandler(AccessDeniedError)
    def handle_access_denied(error):
        return jsonify({"error": str(error)}), 403

    @app.errorhandler(MessageNotFoundError)
    def handle_message_not_found(error):
        return jsonify({"error": str(error)}), 404

    @app.errorhandler(MessageEditTimeExpiredError)
    def handle_message_edit_time_expired(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        return jsonify({"error": "Internal server error"}), 500

def register_cors(app: Flask):
    """Настройка CORS для Flask-приложения."""
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        return response

