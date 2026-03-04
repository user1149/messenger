"""Pytest конфигурация и фиксуры для тестов."""
import pytest
from app import create_app
from app.extensions import db as _db
from app.config import TestingConfig
from flask import Flask


@pytest.fixture(scope="session")
def app() -> Flask:
    """Создать Flask приложение для тестов."""
    app = create_app(TestingConfig)
    return app


@pytest.fixture(scope="function")
def db(app: Flask):
    """Создать и удалить БД для каждого теста."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app: Flask):
    """Тестовый клиент для HTTP запросов."""
    return app.test_client()


@pytest.fixture
def runner(app: Flask):
    """Тестовый runner для CLI команд."""
    return app.test_cli_runner()


@pytest.fixture
def auth_headers(client):
    """Получить auth headers после регистрации и логина."""
    # Создаём пользователя напрямую в БД для тестов
    from app.extensions import db
    from app.models.user import User
    from werkzeug.security import generate_password_hash

    user = User(
        username='testuser',
        email='test@example.com',
        password_hash=generate_password_hash('TestPass123'),
        confirmed=True
    )
    with client.application.app_context():
        db.session.add(user)
        db.session.commit()

    return {}
