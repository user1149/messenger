"""API v1 endpoints для аутентификации."""
from typing import Any, Tuple
from flask import Blueprint, request, jsonify, current_app, url_for, redirect
from flask_login import login_user, logout_user, login_required, current_user
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas import (
    UserResponseSchema,
)
from app.utils.decorators import handle_errors
from app.exceptions.auth_errors import (
    ValidationError,
    UsernameAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError,
    RateLimitExceededError
)
from app.models.user import User
from app.utils.logging import log_user_login, log_user_logout


bp = Blueprint("api_v1_auth", __name__, url_prefix="/api/v1/auth")


@bp.route('/send-code', methods=['POST'])
@handle_errors
def send_code() -> Tuple[Any, int]:
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    ip = request.remote_addr or 'unknown'
    result = current_app.container.auth_service.send_code(phone, ip)
    return jsonify({'success': True, 'message': result['message'], 'masked_phone': result['masked_phone']}), 200


@bp.route('/verify-code', methods=['POST'])
@handle_errors
def verify_code() -> Tuple[Any, int]:
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    code = data.get('code', '').strip()
    ip = request.remote_addr or 'unknown'
    result = current_app.container.auth_service.verify_code(phone, code, ip)
    if result.get('exists'):
        user = User.query.get(result['user_id'])
        login_user(user, remember=True)
        response_schema = UserResponseSchema()
        return jsonify({'success': True, 'user': response_schema.dump(user)}), 200
    return jsonify({'success': True, 'exists': False, 'message': result.get('message')}), 200


@bp.route('/register-by-phone', methods=['POST'])
@handle_errors
def register_by_phone() -> Tuple[Any, int]:
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    username = data.get('username', '').strip()
    result = current_app.container.auth_service.register_by_phone(phone, username)
    user = User.query.get(result['id'])
    login_user(user, remember=True)
    response_schema = UserResponseSchema()
    return jsonify({'success': True, 'user': response_schema.dump(user)}), 201


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
def me() -> Tuple[Any, int]:
    """Получить информацию текущего пользователя."""
    schema = UserResponseSchema()
    return jsonify(schema.dump(current_user)), 200
