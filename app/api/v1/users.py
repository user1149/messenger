"""API v1 endpoints для пользователей."""
from typing import Any, Tuple
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user

from app.schemas import UserSearchSchema
from app.utils.decorators import handle_errors


bp = Blueprint("api_v1_users", __name__, url_prefix="/api/v1/users")


@bp.route("", methods=["GET"])
@login_required
@handle_errors
def search_users() -> Tuple[Any, int]:
    """Поиск пользователей по username."""
    search_query = request.args.get("q", "").strip()
    
    if len(search_query) < 2:
        return jsonify([]), 200
    
    users_list = current_app.container.user_service.search_users(
        current_user.id,
        search_query
    )
    
    schema = UserSearchSchema(many=True)
    return jsonify(schema.dump(users_list)), 200


@bp.route("/<int:user_id>", methods=["GET"])
@login_required
@handle_errors
def get_user(user_id: int) -> Tuple[Any, int]:
    """Получить информацию пользователя по ID."""
    user = current_app.container.user_service.get_user_by_id(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Если это не текущий пользователь, проверяем подтверждение email
    if user_id != current_user.id and not user.get("confirmed"):
        return jsonify({"error": "User not found"}), 404
    
    from app.schemas import UserResponseSchema
    schema = UserResponseSchema()
    return jsonify(schema.dump(user)), 200
