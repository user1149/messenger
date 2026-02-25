"""Unit тесты для AuthService."""
import pytest
from app.services.auth_service import AuthService
from app.exceptions.auth_errors import (
    ValidationError,
    UsernameAlreadyExistsError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError
)
from app.repositories.user_repository import UserRepository
from unittest.mock import Mock, MagicMock


@pytest.fixture
def mock_user_repo():
    """Mock UserRepository."""
    return Mock(spec=UserRepository)


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    return Mock()


@pytest.fixture
def mock_email_provider():
    """Mock Email provider."""
    return Mock()


@pytest.fixture
def auth_service(mock_user_repo, mock_redis, mock_email_provider):
    """AuthService с mock зависимостями."""
    config = {
        "CONFIRMATION_TOKEN_EXPIRATION": 86400,
        "LOGIN_RATE_LIMIT_ATTEMPTS": 10,
        "LOGIN_RATE_LIMIT_PERIOD": 900
    }
    return AuthService(mock_user_repo, mock_redis, config, mock_email_provider)


class TestAuthServiceRegister:
    """Тесты для регистрации пользователя."""
    
    def test_register_success(self, auth_service, mock_user_repo, mock_redis, mock_email_provider):
        """Успешная регистрация."""
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "testuser"
        mock_user.email = "test@example.com"
        
        mock_user_repo.get_by_username_ci.return_value = None
        mock_user_repo.get_by_email_ci.return_value = None
        mock_user_repo.create.return_value = mock_user
        
        result = auth_service.register("testuser", "test@example.com", "TestPass123")
        
        assert result["username"] == "testuser"
        assert result["email"] == "test@example.com"
        assert mock_email_provider.send_confirmation.called
    
    def test_register_invalid_username(self, auth_service):
        """Попытка регистрации с невалидным username."""
        with pytest.raises(ValidationError):
            auth_service.register("ab", "test@example.com", "TestPass123")
    
    def test_register_invalid_email(self, auth_service):
        """Попытка регистрации с невалидной почтой."""
        with pytest.raises(ValidationError):
            auth_service.register("testuser", "invalid-email", "TestPass123")
    
    def test_register_weak_password(self, auth_service):
        """Попытка регистрации со слабым паролем."""
        with pytest.raises(ValidationError):
            auth_service.register("testuser", "test@example.com", "weak")
    
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
