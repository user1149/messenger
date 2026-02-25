"""API v1 endpoints для аутентификации."""
from typing import Any, Tuple
from flask import Blueprint, request, jsonify, current_app, url_for, redirect
from flask_login import login_user, logout_user, login_required, current_user
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas import (
    UserRegisterSchema,
    UserLoginSchema,
    UserResponseSchema,
    ResendConfirmationSchema
)
from app.utils.decorators import handle_errors, require_email_confirmed
from app.exceptions.auth_errors import (
    ValidationError,
    UsernameAlreadyExistsError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError,
    RateLimitExceededError
)
from app.models.user import User
from app.logging import log_user_login, log_user_logout


bp = Blueprint("api_v1_auth", __name__, url_prefix="/api/v1/auth")


@bp.route("/register", methods=["POST"])
@handle_errors
def register() -> Tuple[Any, int]:
    """Регистрация нового пользователя."""
    schema = UserRegisterSchema()
    
    try:
        data = schema.load(request.get_json() or {})
    except MarshmallowValidationError as e:
        raise ValidationError(str(e.messages))
    
    try:
        result = current_app.container.auth_service.register(
            username=data.get("username", "").strip(),
            email=data.get("email", "").strip().lower(),
            password=data.get("password", "")
        )
        return jsonify({
            "success": True,
            "message": "Check your email to confirm registration"
        }), 201
    except (ValidationError, UsernameAlreadyExistsError, EmailAlreadyExistsError):
        raise


@bp.route("/login", methods=["POST"])
@handle_errors
def login() -> Tuple[Any, int]:
    """Вход пользователя."""
    schema = UserLoginSchema()
    
    try:
        data = schema.load(request.get_json() or {})
    except MarshmallowValidationError as e:
        raise ValidationError(str(e.messages))
    
    ip = request.remote_addr or "unknown"
    
    try:
        user_data = current_app.container.auth_service.login(
            data.get("login", ""),
            data.get("password", ""),
            ip
        )
        
        user = User.query.get(user_data["id"])
        login_user(user, remember=True)
        
        response_schema = UserResponseSchema()
        return jsonify({
            "success": True,
            "user": response_schema.dump(user)
        }), 200
    except (RateLimitExceededError, InvalidCredentialsError, UserNotFoundError):
        raise


@bp.route("/confirm/<token>", methods=["GET"])
def confirm_email(token: str) -> Tuple[Any, int]:
    """Подтверждение email по токену."""
    try:
        result = current_app.container.auth_service.confirm_user(token)
        return redirect(
            url_for("pages.index", confirmed="1", message="Email confirmed successfully")
        )
    except (UserNotFoundError, ValidationError) as e:
        return redirect(
            url_for("pages.index", confirmed="0", message=str(e))
        )


@bp.route("/resend-confirmation", methods=["POST"])
@handle_errors
def resend_confirmation() -> Tuple[Any, int]:
    """Переотправка письма подтверждения."""
    schema = ResendConfirmationSchema()
    
    try:
        data = schema.load(request.get_json() or {})
    except MarshmallowValidationError as e:
        raise ValidationError(str(e.messages))
    
    try:
        result = current_app.container.auth_service.resend_confirmation(
            data.get("email", "").strip().lower()
        )
        return jsonify({
            "success": True,
            "message": result["message"]
        }), 200
    except (UserNotFoundError, ValidationError):
        raise


@bp.route("/logout", methods=["POST"])
@login_required
@handle_errors
def logout() -> Tuple[Any, int]:
    """Выход пользователя."""
    log_user_logout(current_user.id, current_user.username)
    logout_user()
    return jsonify({"success": True}), 200


@bp.route("/me", methods=["GET"])
@login_required
@require_email_confirmed
def me() -> Tuple[Any, int]:
    """Получить информацию текущего пользователя."""
    schema = UserResponseSchema()
    return jsonify(schema.dump(current_user)), 200
