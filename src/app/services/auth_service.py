from typing import Optional, Dict, Any
from redis import Redis
from werkzeug.security import generate_password_hash, check_password_hash

from app.exceptions.auth_errors import (
    UserNotFoundError,
    UsernameAlreadyExistsError,
    RateLimitExceededError,
    ValidationError,
    InvalidCredentialsError
)
from app.repositories.user_repository import UserRepository
from app.models.user import User
from app.utils.constants import ValidationRules
from app.utils.validators import validate_username
from app.utils.logging import log_user_registered, log_user_login, log_failed_login


class AuthService:
    """Service for authentication and user management (username/password only)."""

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
        """Increment rate limit counter; raise if exceeded."""
        current = self.redis.get(key)
        try:
            current_int = int(current) if current is not None else 0
        except (TypeError, ValueError):
            current_int = 0

        if current_int >= max_attempts:
            raise RateLimitExceededError("Too many attempts")

        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, period)
        pipe.execute()

    def register(self, username: str, password: str, ip: Optional[str] = None) -> Dict[str, Any]:
        """Register new user with username and password."""
        if username.lower() in ValidationRules.RESERVED_USERNAMES:
            raise ValidationError("This username is reserved")
        validate_username(username)

        if not password or len(password) < 8:
            raise ValidationError("Password must be at least 8 characters")

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
        """Authenticate user by username and password."""
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

    def update_profile(self, user_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile (bio, avatar_url)."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found")

        if 'bio' in updates:
            user.bio = updates['bio'][:500] if updates['bio'] else None

        if user.bio or user.avatar_url:
            user.profile_completed = True

        self.user_repo.session.commit()
        return {
            "id": user.id,
            "username": user.username,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "profile_completed": user.profile_completed
        }

    def get_profile(self, user_id: int) -> Dict[str, Any]:
        """Get full profile of the authenticated user."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found")
        return {
            "id": user.id,
            "username": user.username,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "profile_completed": user.profile_completed
        }

    def get_profile_by_id(self, current_user_id: int, target_user_id: int) -> Dict[str, Any]:
        """Get public profile of another user."""
        if current_user_id == target_user_id:
            return self.get_profile(current_user_id)

        user = self.user_repo.get_by_id(target_user_id)
        if not user:
            raise UserNotFoundError("User not found")
        return {
            "id": user.id,
            "username": user.username,
            "bio": user.bio or "",
            "avatar_url": user.avatar_url or ""
        }
