"""Middleware для централизованной обработки ошибок."""
import re
from typing import Any, Tuple
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException
from app.exceptions.base import AppError
from app.exceptions.auth_errors import (
    ValidationError,
    RateLimitExceededError,
    UserNotFoundError,
    InvalidCredentialsError
)
from app.exceptions.chat_errors import (
    ChatNotFoundError,
    AccessDeniedError,
    MessageNotFoundError,
    MessageEditTimeExpiredError
)


def _sanitize_error_message(message: str) -> str:
    """Sanitize error message by hiding sensitive information."""
    # Hide file paths
    message = re.sub(r'[/\\][\w./\\]+\.py(?::\d+)?', '[REDACTED_PATH]', message)
    # Hide IP addresses
    message = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '[IP]', message)
    # Hide connection strings
    message = re.sub(r'(postgresql|mysql|mongodb)://\S+', '[REDACTED_CONNECTION]', message)
    # Hide email addresses
    message = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', message)
    # Hide database names
    message = re.sub(r'(database|table|schema)\s*[\'"`]?\w+[\'"`]?', r'\1 [REDACTED]', message, flags=re.IGNORECASE)
    return message


def register_error_handlers(app: Flask) -> None:
    """Регистрация обработчиков ошибок."""
    
    @app.errorhandler(400)
    def handle_bad_request(e: HTTPException) -> Tuple[Any, int]:
        """Обработка 400 ошибок."""
        return jsonify({"error": "Bad request"}), 400
    
    @app.errorhandler(401)
    def handle_unauthorized(e: HTTPException) -> Tuple[Any, int]:
        """Обработка 401 ошибок."""
        return jsonify({"error": "Unauthorized"}), 401
    
    @app.errorhandler(403)
    def handle_forbidden(e: HTTPException) -> Tuple[Any, int]:
        """Обработка 403 ошибок."""
        return jsonify({"error": "Forbidden"}), 403
    
    @app.errorhandler(404)
    def handle_not_found(e: HTTPException) -> Tuple[Any, int]:
        """Обработка 404 ошибок."""
        from flask import request
        # Для API запросов вернуть JSON, для веб-страниц перенаправить на логин
        if request.path.startswith('/api/'):
            return jsonify({"error": "Not found"}), 404
        # Для остальных перенаправить на главную (которая затем перенаправит на логин)
        from flask import redirect, url_for
        return redirect(url_for('pages.index')), 302
    
    @app.errorhandler(429)
    def handle_too_many_requests(e: HTTPException) -> Tuple[Any, int]:
        """Обработка 429 ошибок."""
        return jsonify({"error": "Too many requests"}), 429
    
    @app.errorhandler(500)
    def handle_internal_error(e: HTTPException) -> Tuple[Any, int]:
        """Обработка 500 ошибок."""
        app.logger.exception(f"Internal error: {_sanitize_error_message(str(e))}")
        return jsonify({"error": "Internal server error"}), 500
    
    @app.errorhandler(ValidationError)
    def handle_validation_error(e: ValidationError) -> Tuple[Any, int]:
        """Обработка ошибок валидации."""
        return jsonify({"error": str(e)}), 400
    
    @app.errorhandler(RateLimitExceededError)
    def handle_rate_limit(e: RateLimitExceededError) -> Tuple[Any, int]:
        """Обработка превышения rate limit."""
        return jsonify({"error": str(e)}), 429
    
    @app.errorhandler(InvalidCredentialsError)
    def handle_invalid_credentials(e: InvalidCredentialsError) -> Tuple[Any, int]:
        """Обработка неверных credentials."""
        return jsonify({"error": str(e)}), 401
    
    @app.errorhandler(UserNotFoundError)
    def handle_user_not_found(e: UserNotFoundError) -> Tuple[Any, int]:
        """Обработка User not found."""
        error_data = {"error": str(e)}
        if hasattr(e, "not_confirmed") and e.not_confirmed:
            error_data["not_confirmed"] = True
            error_data["email"] = getattr(e, "email", None)
        return jsonify(error_data), 401 if hasattr(e, "not_confirmed") and e.not_confirmed else 404
    
    @app.errorhandler(ChatNotFoundError)
    def handle_chat_not_found(e: ChatNotFoundError) -> Tuple[Any, int]:
        """Обработка Chat not found."""
        return jsonify({"error": str(e)}), 404
    
    @app.errorhandler(MessageNotFoundError)
    def handle_message_not_found(e: MessageNotFoundError) -> Tuple[Any, int]:
        """Обработка Message not found."""
        return jsonify({"error": str(e)}), 404
    
    @app.errorhandler(AccessDeniedError)
    def handle_access_denied(e: AccessDeniedError) -> Tuple[Any, int]:
        """Обработка Access denied."""
        return jsonify({"error": str(e)}), 403
    
    @app.errorhandler(MessageEditTimeExpiredError)
    def handle_message_edit_time_expired(e: MessageEditTimeExpiredError) -> Tuple[Any, int]:
        """Обработка expired message edit time."""
        return jsonify({"error": str(e)}), 400
    
    @app.errorhandler(AppError)
    def handle_app_error(e: AppError) -> Tuple[Any, int]:
        """Обработка базовых ошибок приложения."""
        app.logger.exception(f"App error: {_sanitize_error_message(str(e))}")
        return jsonify({"error": str(e)}), 400
    
    @app.errorhandler(Exception)
    def handle_unexpected_error(e: Exception) -> Tuple[Any, int]:
        """Обработка неожиданных ошибок."""
        app.logger.exception(f"Unexpected error: {_sanitize_error_message(str(e))}")
        return jsonify({"error": "Internal server error"}), 500


def register_cors_headers(app: Flask) -> None:
    """Регистрация CORS headers."""
    
    @app.after_request
    def set_cors_headers(response):
        """Установка CORS headers."""
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
