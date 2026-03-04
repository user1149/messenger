"""Интеграционные тесты для API endpoints."""

class TestAuthAPI:
    """Тесты для API аутентификации по телефону."""

    def test_send_code_success(self, client):
        """Успешная отправка кода по телефону."""
        sent = {}

        class DummySMSProvider:
            def send_code(self, phone, code):
                sent["phone"] = phone
                sent["code"] = code

        # Подменяем sms_provider в контейнере
        with client.application.app_context():
            container = client.application.container
            container.auth_service.sms_provider = DummySMSProvider()

        response = client.post("/api/v1/auth/send-code", json={"phone": "+79990001234"})

        assert response.status_code == 200
        assert response.json["success"] is True
        assert "masked_phone" in response.json
        assert sent.get("phone") is not None



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
