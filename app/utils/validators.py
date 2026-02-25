import re
import html
from app.exceptions.auth_errors import ValidationError

def escape_html(text: str) -> str:
    return html.escape(text)

def validate_email(email: str):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValidationError("Неверный формат email")

def validate_username(username: str):
    if len(username) < 3 or len(username) > 20:
        raise ValidationError("Имя пользователя должно быть от 3 до 20 символов")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise ValidationError("Имя пользователя может содержать только буквы, цифры и подчеркивание")

def validate_password(password: str):
    if len(password) < 8:
        raise ValidationError("Пароль должен содержать минимум 8 символов")
    if not any(c.isupper() for c in password):
        raise ValidationError("Пароль должен содержать хотя бы одну заглавную букву")
    if not any(c.isdigit() for c in password):
        raise ValidationError("Пароль должен содержать хотя бы одну цифру")

def validate_message_text(text: str):
    if not text or len(text) > 500:
        raise ValidationError("Текст сообщения должен быть от 1 до 500 символов")
