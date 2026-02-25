from flask import Blueprint, request, jsonify, current_app, render_template
from flask_login import login_user, logout_user, login_required, current_user
from app.exceptions.auth_errors import (
    ValidationError,
    UsernameAlreadyExistsError,
    RateLimitExceededError
)

bp = Blueprint('auth', __name__)

@bp.route('/login')
def login_page():
    """Страница логина."""
    return render_template('auth.html')

@bp.route('/logout', methods=['POST'])
@login_required
def logout():
    from app.logging import log_user_logout
    log_user_logout(current_user.id, current_user.username)
    logout_user()
    return jsonify({'success': True}), 200

@bp.route('/send-code', methods=['POST'])
def send_code():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    ip = request.remote_addr
    
    try:
        result = current_app.container.auth_service.send_code(phone, ip)
        return jsonify({
            'success': True,
            'message': result['message'],
            'masked_phone': result['masked_phone']
        }), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except RateLimitExceededError as e:
        return jsonify({'error': str(e)}), 429
    except Exception as e:
        current_app.logger.exception("Send code error")
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/verify-code', methods=['POST'])
def verify_code():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    code = data.get('code', '').strip()
    ip = request.remote_addr
    
    try:
        result = current_app.container.auth_service.verify_code(phone, code, ip)
        
        if result['exists']:
            from app.models.user import User
            user = User.query.get(result['user_id'])
            login_user(user, remember=True)
        
        return jsonify({
            'success': True,
            'exists': result['exists'],
            'user_id': result.get('user_id'),
            'username': result.get('username'),
            'phone': result['phone'],
            'message': result.get('message')
        }), 200
    except Exception as e:
        current_app.logger.exception(f"Verify code error: {e}")
        return jsonify({'error': str(e)}), 400

@bp.route('/register-by-phone', methods=['POST'])
def register_by_phone():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    username = data.get('username', '').strip()
    
    try:
        result = current_app.container.auth_service.register_by_phone(phone, username)
        
        from app.models.user import User
        user = User.query.get(result['id'])
        login_user(user, remember=True)
        
        return jsonify({
            'success': True,
            'user_id': result['id'],
            'username': result['username'],
            'phone': result['phone']
        }), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except UsernameAlreadyExistsError as e:
        return jsonify({'error': str(e)}), 409
    except Exception as e:
        current_app.logger.exception("Register by phone error")
        return jsonify({'error': 'Internal server error'}), 500
