# app/controllers/api_controller.py
import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.utils.decorators import handle_errors
from app.exceptions.auth_errors import UserNotFoundError

bp = Blueprint("api", __name__, url_prefix="/api")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route("/me")
@login_required
def me():
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
    }), 200

@bp.route("/users")
@login_required
def users():
    search = request.args.get("q", "").strip()
    if len(search) < 2:
        return jsonify([]), 200
    users_list = current_app.container.user_service.search_users(current_user.id, search)
    return jsonify(users_list), 200

@bp.route("/users/<int:user_id>")
@login_required
def get_user(user_id):
    if user_id == current_user.id:
        user = current_app.container.user_service.get_user_by_id(user_id)
        if not user or not current_user.confirmed:
            return jsonify({"error": "User not found"}), 404
        return jsonify(user), 200
    user = current_app.container.user_service.get_user_by_id(user_id)
    if not user or not user.get('confirmed'):
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": user["id"], "username": user["username"]}), 200

@bp.route("/profile", methods=["GET"])
@login_required
def get_profile():
    try:
        profile = current_app.container.auth_service.get_profile(current_user.id)
        return jsonify(profile), 200
    except Exception:
        current_app.logger.exception("Get profile error")
        return jsonify({"error": "Internal server error"}), 500

@bp.route("/profile", methods=["PUT"])
@login_required
@handle_errors
def update_profile():
    data = request.get_json() or {}
    if 'bio' in data:
        profile = current_app.container.auth_service.update_profile(
            current_user.id,
            {'bio': data['bio']}
        )
    else:
        profile = current_app.container.auth_service.get_profile(current_user.id)
    return jsonify(profile), 200

@bp.route("/profile/avatar", methods=["POST"])
@login_required
@handle_errors
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_folder = os.path.join(current_app.static_folder, 'uploads')
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

@bp.route("/users/<int:user_id>/profile")
@login_required
def get_user_profile(user_id):
    try:
        profile = current_app.container.auth_service.get_profile_by_id(
            current_user.id, user_id
        )
        return jsonify(profile), 200
    except UserNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception:
        current_app.logger.exception("Get user profile error")
        return jsonify({"error": "Internal server error"}), 500

@bp.route("/users/by-username/<username>")
@login_required
def get_user_by_username(username):
    user = current_app.container.user_repo.get_by_username(username)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username}), 200
