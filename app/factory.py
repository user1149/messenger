import os
import redis
from redis import ConnectionPool
from flask import Flask
from app.models.user import User
from .config import DevelopmentConfig, ProductionConfig, TestingConfig
from .extensions import db, login_manager, socketio, mail
from .di import Container
from . import controllers
from .socket_handlers import register_socket_handlers

def create_app(config_object=None):
    app = Flask(__name__,
                template_folder='../templates',
                static_folder='../static')

    # Загрузка конфигурации
    if config_object is None:
        env = os.getenv('FLASK_ENV', 'development')
        if env == 'production':
            config_object = ProductionConfig
        elif env == 'testing':
            config_object = TestingConfig
        else:
            config_object = DevelopmentConfig
    app.config.from_object(config_object)

    # Инициализация расширений
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login_page'
    mail.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    pool = ConnectionPool.from_url(
        app.config['REDIS_URL'],
        max_connections=20,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_keepalive=True
    )
    redis_client = redis.Redis(connection_pool=pool)
    app.redis_client = redis_client

    # Создание контейнера зависимостей
    app.container = Container(db.session, redis_client, app.config)

    # Регистрация blueprints
    app.register_blueprint(controllers.auth_controller.bp)
    app.register_blueprint(controllers.api_controller.bp)
    app.register_blueprint(controllers.pages_controller.bp)

    # Инициализация Socket.IO
    socketio.init_app(app, cors_allowed_origins=app.config['CORS_ORIGINS'], message_queue=app.config['REDIS_URL'])
    register_socket_handlers(socketio, app.container)

    # Создание таблиц БД (для разработки)
    with app.app_context():
        db.create_all()

    return app
