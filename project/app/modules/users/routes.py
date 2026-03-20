from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user

from app.core.utils.decorators import handle_errors
from app.core.utils.validators import allowed_file, validate_image_content
from .services import UserService, ProfileService

import os
import uuid

bp = Blueprint('api_users', __name__, url_prefix='/api/users')
profile_bp = Blueprint('api_profile', __name__, url_prefix='/api/profile')


@bp.route('', methods=['GET'])
@login_required
@handle_errors
def search_users():
    query = request.args.get('q', '').strip()
    if len(query) < 2:
        return jsonify([]), 200
    user_service: UserService = current_app.container.user_service
    users = user_service.search_users(current_user.id, query)
    return jsonify(users), 200


@bp.route('/<int:user_id>', methods=['GET'])
@login_required
@handle_errors
def get_user(user_id):
    user_service: UserService = current_app.container.user_service
    user = user_service.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user_id != current_user.id and not user.get('confirmed', True):
        return jsonify({"error": "User not found"}), 404
    return jsonify(user), 200


@bp.route('/<int:user_id>/profile', methods=['GET'])
@login_required
@handle_errors
def get_user_profile(user_id):
    profile_service: ProfileService = current_app.container.profile_service
    profile = profile_service.get_profile_by_id(current_user.id, user_id)
    return jsonify(profile), 200


@bp.route('/by-username/<username>', methods=['GET'])
@login_required
def get_user_by_username(username):
    user_repo = current_app.container.user_repo
    user = user_repo.get_by_username(username)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": user.id,
        "username": user.username,
        "avatar_url": user.avatar_url,
    }), 200


@profile_bp.route('', methods=['GET'])
@login_required
@handle_errors
def get_profile():
    profile_service: ProfileService = current_app.container.profile_service
    profile = profile_service.get_profile(current_user.id)
    return jsonify(profile), 200


@profile_bp.route('', methods=['PUT'])
@login_required
@handle_errors
def update_profile():
    data = request.get_json() or {}
    profile_service: ProfileService = current_app.container.profile_service
    profile = profile_service.update_profile(current_user.id, data)
    return jsonify(profile), 200


@profile_bp.route('/avatar', methods=['POST'])
@login_required
@handle_errors
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['avatar']
    original_filename = file.filename or ''
    if original_filename == '':
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(original_filename):
        return jsonify({"error": "File type not allowed"}), 400

    if not validate_image_content(file):
        return jsonify({"error": "Invalid image content"}), 400

    ext = original_filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_folder = os.path.join(current_app.static_folder or 'static', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)
    avatar_url = f"/static/uploads/{filename}"

    user = current_app.container.user_repo.get_by_id(current_user.id)
    user.avatar_url = avatar_url
    if user.bio:
        user.profile_completed = True
    current_app.container.user_repo.session.commit()

    return jsonify({"avatar_url": avatar_url}), 200