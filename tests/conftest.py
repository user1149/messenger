"""Pytest конфигурация и фиксуры для тестов."""
import pytest
from app import create_app
from app.extensions import db as _db
from flask import Flask


@pytest.fixture(scope="session")
def app() -> Flask:
    """Создать Flask приложение для тестов."""
    app = create_app({'TESTING': True})
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
    # Регистрация
    client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "TestPass123"
    })
    
    # Логин
    response = client.post("/api/v1/auth/login", json={
        "login": "testuser",
        "password": "TestPass123"
    })
    
    return {}
