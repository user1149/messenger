from typing import Optional, Dict, Any
from redis import Redis
import re
from werkzeug.security import generate_password_hash, check_password_hash

from app.core.exceptions.auth_errors import (
    UsernameAlreadyExistsError,
    RateLimitExceededError,
    ValidationError,
    InvalidCredentialsError
)
from app.modules.users.repositories import UserRepository
from app.models.user import User
from app.core.utils.constants import ValidationRules
from app.core.utils.validators import validate_username
from app.core.logging import log_user_registered, log_user_login, log_failed_login


class AuthService:

    def __init__(
        self,
        user_repo: UserRepository,
        redis_client: Redis,
        config: Dict[str, Any],
    ) -> None:
        self.user_repo = user_repo
        self.redis = redis_client
        self.config = config

    def _check_rate_limit(self, key: str, max_attempts: int, period: int) -> None:
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, period)
        results = pipe.execute()
        current = results[0]
        if current and current > max_attempts:
            raise RateLimitExceededError("Too many attempts")

    def register(self, username: str, password: str, ip: Optional[str] = None) -> Dict[str, Any]:
        if username.lower() in ValidationRules.RESERVED_USERNAMES:
            raise ValidationError("This username is reserved")
        validate_username(username)

        if not password or len(password) < 8:
            raise ValidationError("Password must be at least 8 characters")
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password must contain at least one lowercase letter")
        if not re.search(r'[0-9]', password):
            raise ValidationError("Password must contain at least one digit")

        if self.user_repo.get_by_username_ci(username):
            raise UsernameAlreadyExistsError("Username already taken")

        user = User(username=username)
        user.password_hash = generate_password_hash(password)
        user.profile_completed = False

        self.user_repo.session.add(user)
        self.user_repo.session.commit()

        log_user_registered(user.id, user.username, ip or "unknown")
        return {
            "id": user.id,
            "username": user.username,
        }

    def login(self, username: str, password: str, ip: Optional[str] = None) -> Dict[str, Any]:
        if not self.config.get('TESTING', False):
            ip_key = f"login_ip:{ip}" if ip else None
            if ip_key:
                self._check_rate_limit(
                    ip_key,
                    int(self.config.get("LOGIN_RATE_LIMIT_ATTEMPTS", 10)),
                    int(self.config.get("LOGIN_RATE_LIMIT_PERIOD", 900)),
                )

        user = self.user_repo.get_by_username_ci(username)
        if not user or not user.password_hash:
            log_failed_login(username, ip or "unknown", "invalid_credentials")
            raise InvalidCredentialsError("Invalid username or password")

        if not check_password_hash(user.password_hash, password):
            log_failed_login(username, ip or "unknown", "invalid_credentials")
            raise InvalidCredentialsError("Invalid username or password")

        log_user_login(user.id, user.username, ip or "unknown")
        return {
            "id": user.id,
            "username": user.username,
            "confirmed": bool(getattr(user, "confirmed", False))
        }