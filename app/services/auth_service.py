from typing import Optional, Dict, Any
from datetime import datetime
import secrets
import json
from redis import Redis
from werkzeug.security import generate_password_hash, check_password_hash
from app.exceptions.auth_errors import (
    UserNotFoundError,
    UsernameAlreadyExistsError,
    RateLimitExceededError,
    ValidationError,
    PhoneAlreadyExistsError,
    InvalidCodeError,
    CodeExpiredError,
    InvalidCredentialsError
)
from app.repositories.user_repository import UserRepository
from app.models.user import User
from app.utils.constants import ValidationRules
from app.utils.validators import validate_username
from app.utils.logging import log_user_registered, log_user_login, log_failed_login, log_rate_limit_exceeded

class AuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        redis_client: Redis,
        config: Dict[str, Any],
        sms_provider: Optional[Any] = None,
    ) -> None:
        self.user_repo = user_repo
        self.redis = redis_client
        self.config = config
        self.sms_provider = sms_provider

    def _check_rate_limit(self, key: str, max_attempts: int, period: int) -> bool:
        current = self.redis.get(key)
        try:
            current_int = int(current) if current is not None else 0
        except (TypeError, ValueError):
            current_int = 0
        if current_int >= max_attempts:
            raise RateLimitExceededError("Слишком много попыток")
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, period)
        pipe.execute()
        return False

    def _get_soft_ban_status(self, phone: str) -> Optional[Dict[str, Any]]:
        ban_key = f"sms_soft_ban:{phone}"
        ban_data = self.redis.get(ban_key)
        if ban_data:
            import json
            try:
                return json.loads(ban_data)
            except:
                return None
        return None

    def _apply_soft_ban(self, phone: str, attempt_count: int) -> None:
        ban_key = f"sms_soft_ban:{phone}"
        if attempt_count <= 5:
            ban_duration = 60
            next_level = 1
        elif attempt_count <= 10:
            ban_duration = 300
            next_level = 2
        else:
            ban_duration = 1800
            next_level = 3
        ban_data = {
            "level": next_level,
            "attempts": attempt_count,
            "ban_until": ban_duration
        }
        ban_data_json = json.dumps(ban_data)
        self.redis.setex(ban_key, ban_duration, ban_data_json)

    def _check_soft_ban(self, phone: str) -> None:
        ban_status = self._get_soft_ban_status(phone)
        if ban_status:
            level = ban_status.get("level", 1)
            log_rate_limit_exceeded(f"sms_verify:{phone}", "sms_brute_force")
            if level == 1:
                raise RateLimitExceededError("Слишком много попыток. Повторите через минуту")
            elif level == 2:
                raise RateLimitExceededError("Слишком много попыток. Повторите через 5 минут")
            else:
                raise RateLimitExceededError("Слишком много попыток. Повторите через 30 минут")

    def send_code(self, phone: str, ip: Optional[str] = None) -> Dict[str, Any]:
        from app.utils.validators import validate_phone, normalize_phone
        phone_normalized = normalize_phone(phone)
        validate_phone(phone)
        ip_key = f"send_code_ip:{ip}" if ip else None
        phone_key = f"send_code_phone:{phone_normalized}"
        if ip_key:
            self._check_rate_limit(ip_key, 5, 3600)
        self._check_rate_limit(phone_key, 3, 3600)
        code = str(secrets.randbelow(1000000)).zfill(6)
        self.redis.setex(
            f"auth_code:{phone_normalized}",
            self.config.get('PHONE_CODE_EXPIRATION', 300),
            code
        )
        self.redis.setex(
            f"phone_session:{phone_normalized}",
            self.config.get('PHONE_SESSION_EXPIRATION', 1800),
            phone_normalized
        )
        if not self.sms_provider:
            raise RuntimeError("SMS provider is not configured")
        self.sms_provider.send_code(phone_normalized, code)
        return {
            "message": "Код отправлен",
            "phone": phone_normalized,
            "masked_phone": self._mask_phone(phone_normalized)
        }

    def register(self, username: str, password: str, ip: Optional[str] = None) -> Dict[str, Any]:
        if username.lower() in ValidationRules.RESERVED_USERNAMES:
            raise ValidationError("Это имя пользователя зарезервировано")
        validate_username(username)
        if not password or len(password) < 8:
            raise ValidationError("Пароль должен быть не менее 8 символов")
        if self.user_repo.get_by_username_ci(username):
            raise UsernameAlreadyExistsError("Это имя пользователя уже занято")
        user = User(username=username)
        user.password_hash = generate_password_hash(password)
        user.confirmed = True
        user.confirmed_at = datetime.utcnow()
        user.profile_completed = False
        self.user_repo.session.add(user)
        self.user_repo.session.commit()
        log_user_registered(user.id, user.username, ip or "unknown")
        return {"id": user.id, "username": user.username, "confirmed": user.confirmed}

    def login(self, username: str, password: str, ip: Optional[str] = None) -> Dict[str, Any]:
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
            raise InvalidCredentialsError("Неверный логин или пароль")
        if not check_password_hash(user.password_hash, password):
            log_failed_login(username, ip or "unknown", "invalid_credentials")
            raise InvalidCredentialsError("Неверный логин или пароль")
        log_user_login(user.id, user.username, ip or "unknown")
        return {"id": user.id, "username": user.username, "confirmed": bool(getattr(user, "confirmed", False))}

    def verify_code(self, phone: str, code: str, ip: Optional[str] = None) -> Dict[str, Any]:
        from app.utils.validators import normalize_phone
        phone_normalized = normalize_phone(phone)
        self._check_soft_ban(phone_normalized)
        phone_key = f"verify_code_phone:{phone_normalized}"
        attempt_count = self.redis.get(phone_key)
        attempt_count = int(attempt_count) if attempt_count else 0
        stored_code = self.redis.get(f"auth_code:{phone_normalized}")
        if not stored_code:
            raise CodeExpiredError("Код истек, запросите новый")
        decoded_code = stored_code.decode() if isinstance(stored_code, bytes) else stored_code
        if decoded_code != code:
            attempt_count += 1
            self.redis.setex(phone_key, 900, str(attempt_count))
            log_failed_login(phone_normalized, "unknown", "invalid_sms_code")
            if attempt_count >= 5:
                self._apply_soft_ban(phone_normalized, attempt_count)
            raise InvalidCodeError("Неверный код")
        self.redis.delete(phone_key)
        self.redis.delete(f"sms_soft_ban:{phone_normalized}")
        self.redis.delete(f"auth_code:{phone_normalized}")
        user = self.user_repo.session.query(User).filter(
            User.phone_number == phone_normalized
        ).first()
        verified_key = f"phone_verified:{phone_normalized}"
        if user:
            self.redis.setex(verified_key, self.config.get('PHONE_SESSION_EXPIRATION', 1800), str(user.id))
            log_user_login(user.id, user.username, ip or "unknown")
            return {
                "exists": True,
                "user_id": user.id,
                "username": user.username,
                "phone": phone_normalized
            }
        else:
            self.redis.setex(verified_key, self.config.get('PHONE_SESSION_EXPIRATION', 1800), "new_user")
            return {
                "exists": False,
                "phone": phone_normalized,
                "message": "Требуется создание профиля"
            }

    def register_by_phone(self, phone: str, username: str) -> Dict[str, Any]:
        from app.utils.validators import normalize_phone
        phone_normalized = normalize_phone(phone)
        verified_key = f"phone_verified:{phone_normalized}"
        verified_status = self.redis.get(verified_key)
        status_str = verified_status.decode() if isinstance(verified_status, bytes) else verified_status
        if not status_str or status_str != "new_user":
            raise ValidationError("Телефон не верифицирован")
        if username.lower() in ValidationRules.RESERVED_USERNAMES:
            raise ValidationError("Это имя пользователя зарезервировано")
        validate_username(username)
        if self.user_repo.get_by_username_ci(username):
            raise UsernameAlreadyExistsError("Это имя пользователя уже занято")
        temp_user = self.user_repo.session.query(User).filter(
            User.phone_number == phone_normalized
        ).first()
        if temp_user:
            raise PhoneAlreadyExistsError("Этот номер телефона уже зарегистрирован")
        user = User()
        user.phone_number = phone_normalized
        user.phone_verified = True
        user.phone_verified_at = datetime.utcnow()
        user.username = username
        user.email = f"phone_{phone_normalized}@local.app"
        user.password_hash = None
        user.confirmed = True
        user.confirmed_at = datetime.utcnow()
        user.profile_completed = False
        self.user_repo.session.add(user)
        self.user_repo.session.commit()
        self.redis.delete(verified_key)
        self.redis.setex(f"phone_verified:{phone_normalized}", self.config.get('PHONE_SESSION_EXPIRATION', 1800), str(user.id))
        log_user_registered(user.id, user.username, phone_normalized)
        return {
            "id": user.id,
            "username": user.username,
            "phone": phone_normalized
        }

    def update_profile(self, user_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("Пользователь не найден")
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
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("Пользователь не найден")
        return {
            "id": user.id,
            "username": user.username,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "profile_completed": user.profile_completed
        }

    def get_profile_by_id(self, current_user_id: int, target_user_id: int) -> Dict[str, Any]:
        if current_user_id == target_user_id:
            return self.get_profile(current_user_id)
        user = self.user_repo.get_by_id(target_user_id)
        if not user:
            raise UserNotFoundError("Пользователь не найден")
        return {
            "id": user.id,
            "username": user.username,
            "bio": user.bio or "",
            "avatar_url": user.avatar_url or ""
        }

    def _mask_phone(self, phone: str) -> str:
        if len(phone) >= 10:
            return f"+{'*' * (len(phone) - 4)}{phone[-4:]}"
        return phone
