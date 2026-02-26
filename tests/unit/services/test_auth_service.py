"""Unit тесты для AuthService."""
import pytest
from app.services.auth_service import AuthService
from app.exceptions.auth_errors import (
    ValidationError,
    UsernameAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError
)
from app.repositories.user_repository import UserRepository
from unittest.mock import Mock, MagicMock


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
    
    def test_register_username_exists(self, auth_service, mock_user_repo):
        """Попытка регистрации с существующим username."""
        existing_user = Mock()
        mock_user_repo.get_by_username_ci.return_value = existing_user
        
        with pytest.raises(UsernameAlreadyExistsError):
            auth_service.register("testuser", "test@example.com", "TestPass123")
    
    def test_register_email_exists(self, auth_service, mock_user_repo):
        """Попытка регистрации с существующей почтой."""
        existing_user = Mock()
        mock_user_repo.get_by_username_ci.return_value = None
        mock_user_repo.get_by_email_ci.return_value = existing_user
        
        with pytest.raises(EmailAlreadyExistsError):
            auth_service.register("testuser", "test@example.com", "TestPass123")


class TestAuthServiceLogin:
    """Тесты для входа пользователя."""
    
    def test_login_success(self, auth_service, mock_user_repo, mock_redis):
        """Успешный логин."""
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "testuser"
        mock_user.confirmed = True
        mock_user.password_hash = "hashed_password"
        
        from werkzeug.security import generate_password_hash
        mock_user.password_hash = generate_password_hash("TestPass123")
        
        mock_user_repo.get_by_email_ci.return_value = None
        mock_user_repo.get_by_username_ci.return_value = mock_user
        mock_redis.get.return_value = None
        
        result = auth_service.login("testuser", "TestPass123", "127.0.0.1")
        
        assert result["username"] == "testuser"
        assert result["confirmed"] is True
    
    def test_login_invalid_password(self, auth_service, mock_user_repo, mock_redis):
        """Логин с неверным паролем."""
        mock_user = Mock()
        mock_user.password_hash = "wrong_hash"
        
        mock_user_repo.get_by_email_ci.return_value = None
        mock_user_repo.get_by_username_ci.return_value = mock_user
        mock_redis.get.return_value = None
        
        with pytest.raises(InvalidCredentialsError):
            auth_service.login("testuser", "WrongPass", "127.0.0.1")
    
    def test_login_user_not_found(self, auth_service, mock_user_repo, mock_redis):
        """Логин несуществующего пользователя."""
        mock_user_repo.get_by_email_ci.return_value = None
        mock_user_repo.get_by_username_ci.return_value = None
        mock_redis.get.return_value = None
        
        with pytest.raises(InvalidCredentialsError):
            auth_service.login("nonexistent", "TestPass123", "127.0.0.1")
