from flask import Blueprint, request, jsonify, current_app, url_for, redirect, render_template
from flask_login import login_user, logout_user, login_required
from app.exceptions.auth_errors import (
    ValidationError,
    UsernameAlreadyExistsError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError,
    RateLimitExceededError
)

bp = Blueprint('auth', __name__)

@bp.route('/login')
def login_page():
    return render_template('index.html')

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    try:
        result = current_app.container.auth_service.register(
            username=data.get('username', '').strip(),
            email=data.get('email', '').strip().lower(),
            password=data.get('password', '')
        )
        return jsonify({'success': True, 'message': 'Проверьте почту для подтверждения'}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except UsernameAlreadyExistsError as e:
        return jsonify({'error': str(e)}), 409
    except EmailAlreadyExistsError as e:
        return jsonify({'error': str(e)}), 409
    except Exception as e:
        current_app.logger.exception("Register error")
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    login_str = data.get('login', '').strip()
    password = data.get('password', '')
    ip = request.remote_addr

    try:
        user_data = current_app.container.auth_service.login(login_str, password, ip)
        # Загружаем пользователя из БД для flask-login
        from app.models.user import User
        user = User.query.get(user_data['id'])
        login_user(user, remember=True)
        return jsonify({'success': True, 'username': user_data['username'], 'id': user.id}), 200
    except RateLimitExceededError as e:
        return jsonify({'error': str(e)}), 429
    except InvalidCredentialsError as e:
        return jsonify({'error': str(e)}), 401
    except UserNotFoundError as e:
        # Это может быть случай с неподтверждённым email
        if hasattr(e, 'not_confirmed') and e.not_confirmed:
            return jsonify({'error': 'Подтвердите email перед входом', 'not_confirmed': True, 'email': e.email}), 401
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        current_app.logger.exception("Login error")
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/confirm/<token>')
def confirm_email(token):
    try:
        result = current_app.container.auth_service.confirm_user(token)
        return redirect(url_for('pages.index', confirmed='1', message='Email подтверждён'))
    except (UserNotFoundError, ValidationError) as e:
        return redirect(url_for('pages.index', confirmed='0', message=str(e)))

@bp.route('/resend-confirmation', methods=['POST'])
def resend_confirmation():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    try:
        result = current_app.container.auth_service.resend_confirmation(email)
        return jsonify({'success': True, 'message': result['message']}), 200
    except UserNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        current_app.logger.exception("Resend error")
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/logout', methods=['POST'])
@login_required
def logout():
    from app.logging import log_user_logout
    log_user_logout(current_user.id, current_user.username)
    logout_user()
    return jsonify({'success': True}), 200
