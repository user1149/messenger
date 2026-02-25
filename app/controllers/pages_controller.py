from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

bp = Blueprint('pages', __name__)

@bp.route('/')
def index():
    """Главная страница - перенаправляет авторизованных на чат, остальных на логин."""
    if current_user.is_authenticated:
        return render_template('index.html')
    else:
        return redirect(url_for('auth.login_page'))

@bp.route('/dashboard')
@login_required
def dashboard():
    """Панель управления (требует авторизации)."""
    return render_template('index.html')
