from functools import wraps
from typing import Callable, Any

from flask import jsonify, current_app
from flask_login import current_user
from app.core.extensions import db


def handle_errors(f: Callable) -> Callable:
    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return f(*args, **kwargs)
        except Exception as e:
            from app.core.exceptions.base import AppError
            from app.core.exceptions.auth_errors import ValidationError, RateLimitExceededError, InvalidCredentialsError
            from app.core.exceptions.chat_errors import (
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
            elif isinstance(e, InvalidCredentialsError):
                return jsonify({"error": str(e)}), 401
            elif isinstance(e, AppError):
                return jsonify({"error": str(e)}), 400
            else:
                return jsonify({"error": "Internal server error"}), 500

    return wrapper


def rate_limit_action(action: str) -> Callable:
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            from app.core.exceptions.auth_errors import RateLimitExceededError
            from app.core.utils.rate_limit import check_rate_limit

            if check_rate_limit(current_user.username, action, current_app.container.redis_client):
                raise RateLimitExceededError("Too many requests")
            return f(*args, **kwargs)
        return wrapper
    return decorator


def socket_authenticated(f: Callable) -> Callable:
    @wraps(f)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        from flask_login import current_user
        if not current_user.is_authenticated:
            from flask_socketio import emit
            emit('error', {'message': 'Authentication required'})
            return
        return f(*args, **kwargs)
    return wrapped


def socket_handle_errors(f: Callable) -> Callable:
    @wraps(f)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        try:
            return f(*args, **kwargs)
        except Exception as e:
            from app.core.exceptions.base import AppError
            from flask_socketio import emit
            current_app.logger.exception(f"Socket error in {f.__name__}")
            if isinstance(e, AppError):
                emit('error', {'message': str(e)})
            else:
                emit('error', {'message': 'Internal server error'})
    return wrapped


def transactional(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            result = f(*args, **kwargs)
            db.session.commit()
            return result
        except Exception:
            db.session.rollback()
            raise
    return wrapper
