"""Factory для создания и конфигурирования Flask приложения."""
import os
import redis
from redis import ConnectionPool
from typing import Optional, TYPE_CHECKING
from flask import Flask
from app.models.user import User
from config import DevelopmentConfig, ProductionConfig, TestingConfig
from app.extensions import db, login_manager, socketio, mail, csrf
from app.di import Container
from app.middleware import register_error_handlers, register_cors_headers
from app.logging import init_logging
from app.socket_handlers import register_socket_handlers

if TYPE_CHECKING:
    from app.api import register_api_routes


def create_app(config_object: Optional[object] = None) -> Flask:
    """Создание и конфигурирование Flask приложения."""
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static"
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
    init_logging(app)

    # Инициализация расширений
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login_page"
    mail.init_app(app)
    csrf.init_app(app)

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

    # Создание контейнера зависимостей
    app.container = Container(db.session, redis_client, app.config)

    # Регистрация blueprints старых контроллеров (для Web UI)
    from app.controllers import auth_controller, pages_controller
    app.register_blueprint(auth_controller.bp)
    app.register_blueprint(pages_controller.bp)

    # Регистрация новых API endpoints
    from app.api import register_api_routes
    register_api_routes(app)

    # Инициализация Socket.IO
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        message_queue=app.config["REDIS_URL"],
        csrf=False
    )
    register_socket_handlers(socketio, app.container)

    # Регистрация обработчиков ошибок и CORS
    register_error_handlers(app)
    register_cors_headers(app)

    if app.config.get("TESTING"):
        with app.app_context():
            db.create_all()

    return app

