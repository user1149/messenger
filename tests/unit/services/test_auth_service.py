"""Unit тесты для AuthService."""
import pytest
from app.services.auth_service import AuthService
from app.repositories.user_repository import UserRepository
from unittest.mock import Mock


@pytest.fixture
def mock_user_repo():
    """Mock UserRepository."""
    mock_repo = Mock(spec=UserRepository)
    mock_repo.session = Mock()
    mock_repo.session.commit = Mock()
    return mock_repo


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    return Mock()


@pytest.fixture
def mock_sms_provider():
    """Mock SMS provider."""
    return Mock()


@pytest.fixture
def auth_service(mock_user_repo, mock_redis, mock_sms_provider):
    """AuthService с mock зависимостями."""
    config = {
        "PHONE_CODE_EXPIRATION": 300,
        "PHONE_SESSION_EXPIRATION": 1800,
        "LOGIN_RATE_LIMIT_ATTEMPTS": 10,
        "LOGIN_RATE_LIMIT_PERIOD": 900
    }
    return AuthService(mock_user_repo, mock_redis, config, mock_sms_provider)


class TestAuthServicePhone:
    """Тесты для телефонной аутентификации."""
    
    def test_send_code_success(self, auth_service, mock_sms_provider):
        """Успешная отправка кода."""
        result = auth_service.send_code("+79990001234", "127.0.0.1")
        
        assert result["message"] == "Код отправлен"
        assert "masked_phone" in result
        assert mock_sms_provider.send_code.called
