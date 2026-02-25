"""Интеграционные тесты для API endpoints."""
import pytest
from flask import Flask


class TestAuthAPI:
    """Тесты для API аутентификации."""
    
    def test_register_success(self, client):
        """Успешная регистрация через API."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123"
        })
        
        assert response.status_code == 201
        assert response.json["success"] is True
    
    def test_register_missing_fields(self, client):
        """Регистрация без обязательных полей."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser"
            # missing email and password
        })
        
        assert response.status_code == 400
        assert "error" in response.json
    
    def test_register_invalid_email(self, client):
        """Регистрация с невалидным email."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "invalid-email",
            "password": "TestPass123"
        })
        
        assert response.status_code == 400
        assert "error" in response.json
    
    def test_register_weak_password(self, client):
        """Регистрация со слабым паролем."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "weak"
        })
        
        assert response.status_code == 400
        assert "error" in response.json
    
    def test_register_duplicate_username(self, client):
        """Попытка регистрации с существующим username."""
        # Первая регистрация
        client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test1@example.com",
            "password": "TestPass123"
        })
        
        # Вторая регистрация с тем же username
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test2@example.com",
            "password": "TestPass123"
        })
        
        assert response.status_code == 409
        assert "error" in response.json
    
    def test_register_duplicate_email(self, client):
        """Попытка регистрации с существующим email."""
        # Первая регистрация
        client.post("/api/v1/auth/register", json={
            "username": "testuser1",
            "email": "test@example.com",
            "password": "TestPass123"
        })
        
        # Вторая регистрация с тем же email
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser2",
            "email": "test@example.com",
            "password": "TestPass123"
        })
        
        assert response.status_code == 409
        assert "error" in response.json


class TestUsersAPI:
    """Тесты для API пользователей."""
    
    def test_search_users_requires_auth(self, client):
        """Поиск пользователей требует аутентификации."""
        response = client.get("/api/v1/users?q=test")
        
        assert response.status_code == 401
    
    def test_get_user_requires_auth(self, client):
        """Получение пользователя требует аутентификации."""
        response = client.get("/api/v1/users/1")
        
        assert response.status_code == 401
