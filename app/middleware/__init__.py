"""Middleware для приложения."""
from .error_handler import register_error_handlers, register_cors_headers

__all__ = ["register_error_handlers", "register_cors_headers"]
