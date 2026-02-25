from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import secrets
from redis import Redis
from werkzeug.security import generate_password_hash, check_password_hash
from app.exceptions.auth_errors import (
    InvalidCredentialsError,
    UserNotFoundError,
    EmailAlreadyExistsError,
    UsernameAlreadyExistsError,
    RateLimitExceededError,
    ValidationError
)
from app.repositories.user_repository import UserRepository
from app.integrations.email_provider import EmailProvider
from app.utils.constants import ValidationRules
from app.utils.validators import validate_email, validate_username, validate_password
from app.logging import log_user_registered, log_user_login

class AuthService:
    """Сервис для аутентификации и управления пользователями."""
    
    def __init__(
        self,
        user_repo: UserRepository,
        redis_client: Redis,
        config: Dict[str, Any],
        email_provider: EmailProvider
    ) -> None:
        self.user_repo = user_repo
        self.redis = redis_client
        self.config = config
        self.email_provider = email_provider

    def _check_rate_limit(self, key: str, max_attempts: int, period: int) -> bool:
        """Проверка rate limit."""
        current = self.redis.get(key)
        if current and int(current) >= max_attempts:
            raise RateLimitExceededError("Слишком много попыток")
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, period)
        pipe.execute()
        return False

    def register(self, username: str, email: str, password: str) -> Dict[str, Any]:
        """Регистрация нового пользователя."""
        if not username or not email or not password:
            raise ValidationError("Все поля обязательны")
        
        if username.lower() in ValidationRules.RESERVED_USERNAMES:
            raise ValidationError("Это имя пользователя зарезервировано")
        
        validate_username(username)
        validate_email(email)
        validate_password(password)

        if self.user_repo.get_by_username_ci(username):
            raise UsernameAlreadyExistsError("Это имя пользователя уже занято")
        if self.user_repo.get_by_email_ci(email):
            raise EmailAlreadyExistsError("Этот email уже зарегистрирован")

        password_hash = generate_password_hash(password)
        user = self.user_repo.create(username, email, password_hash)
        self.user_repo.session.commit()

        token = self._generate_confirmation_token(user)
        self.email_provider.send_confirmation(user.email, user.username, token)
        
        log_user_registered(user.id, user.username, user.email)

        return {"id": user.id, "username": user.username, "email": user.email}

    def _generate_confirmation_token(self, user) -> str:
        """Генерация токена подтверждения email."""
        token = secrets.token_urlsafe(32)
        token_hash = generate_password_hash(token, method='pbkdf2:sha256')
        user.confirmation_token = token_hash
        user.token_expiration = datetime.utcnow() + timedelta(
            seconds=self.config['CONFIRMATION_TOKEN_EXPIRATION']
        )
        self.redis.setex(
            f"confirm_token:{token}",
            self.config['CONFIRMATION_TOKEN_EXPIRATION'],
            str(user.id)
        )
        self.user_repo.session.commit()
        return token

    def login(self, login_str: str, password: str, ip: Optional[str] = None) -> Dict[str, Any]:
        """Вход пользователя в систему."""
        ip_key = f"login_attempts_ip:{ip}" if ip else None
        login_key = f"login_attempts_login:{login_str}"

        if ip_key:
            self._check_rate_limit(
                ip_key,
                self.config['LOGIN_RATE_LIMIT_ATTEMPTS'],
                self.config['LOGIN_RATE_LIMIT_PERIOD']
            )
        self._check_rate_limit(
            login_key,
            self.config['LOGIN_RATE_LIMIT_ATTEMPTS'],
            self.config['LOGIN_RATE_LIMIT_PERIOD']
        )

        user = self.user_repo.get_by_email_ci(login_str)
        if not user:
            user = self.user_repo.get_by_username_ci(login_str)

        if not user or not check_password_hash(user.password_hash, password):
            raise InvalidCredentialsError("Неверный логин или пароль")

        if ip_key:
            self.redis.delete(ip_key)
        self.redis.delete(login_key)

        if not user.confirmed:
            raise UserNotFoundError("Email не подтвержден", not_confirmed=True, email=user.email)

        log_user_login(user.id, user.username, ip or "unknown")

        return {"id": user.id, "username": user.username, "confirmed": user.confirmed}

    def confirm_user(self, token: str) -> Dict[str, Any]:
        """Подтверждение email пользователя."""
        user_id = self.redis.get(f"confirm_token:{token}")
        if not user_id:
            raise UserNotFoundError("Неверный или истекший токен")
        
        from app.models.user import User
        user = self.user_repo.get_by_id(int(user_id))
        if not user:
            raise UserNotFoundError("Пользователь не найден")
        
        user.confirmed = True
        user.confirmed_at = datetime.utcnow()
        user.confirmation_token = None
        user.token_expiration = None
        self.user_repo.session.commit()
        self.redis.delete(f"confirm_token:{token}")
        
        return {"id": user.id, "username": user.username}

    def resend_confirmation(self, email: str) -> Dict[str, Any]:
        """Переотправка письма подтверждения."""
        user = self.user_repo.get_by_email_ci(email)
        if not user:
            raise UserNotFoundError("Пользователь не найден")
        if user.confirmed:
            raise ValidationError("Email уже подтвержден")
        token = self._generate_confirmation_token(user)
        self.email_provider.send_confirmation(user.email, user.username, token)
        return {"message": "Письмо подтверждения отправлено повторно"}
