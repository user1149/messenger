"""Общие decorators для приложения."""
from functools import wraps
from typing import Callable, Any
from flask import jsonify, current_app
from flask_login import current_user


def handle_errors(f: Callable) -> Callable:
    """Decorator для обработки исключений."""
    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return f(*args, **kwargs)
        except Exception as e:
            from app.exceptions.base import AppError
            from app.exceptions.auth_errors import ValidationError, RateLimitExceededError
            from app.exceptions.chat_errors import (
                ChatNotFoundError,
                AccessDeniedError,
                MessageNotFoundError,
                MessageEditTimeExpiredError
            )
            
            current_app.logger.exception(f"Error in {f.__name__}")
            
            if isinstance(e, ValidationError):
                return jsonify({"error": str(e)}), 400
            elif isinstance(e, RateLimitExceededError):
                return jsonify({"error": str(e)}), 429
            elif isinstance(e, (ChatNotFoundError, MessageNotFoundError)):
                return jsonify({"error": str(e)}), 404
            elif isinstance(e, AccessDeniedError):
                return jsonify({"error": str(e)}), 403
            elif isinstance(e, MessageEditTimeExpiredError):
                return jsonify({"error": str(e)}), 400
            elif isinstance(e, AppError):
                return jsonify({"error": str(e)}), 400
            else:
                return jsonify({"error": "Internal server error"}), 500
    
    return wrapper


def rate_limit_action(action: str) -> Callable:
    """Decorator для rate limiting на API endpoints."""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            from app.exceptions.auth_errors import RateLimitExceededError
            from app.utils.rate_limit import check_rate_limit
            
            if check_rate_limit(current_user.username, action, current_app.container.redis_client):
                raise RateLimitExceededError("Too many requests")
            return f(*args, **kwargs)
        return wrapper
    return decorator
