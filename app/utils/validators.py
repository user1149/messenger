import re
import html
from app.exceptions.auth_errors import ValidationError

def escape_html(text: str) -> str:
    return html.escape(text)

def validate_username(username: str):
    if len(username) < 3 or len(username) > 20:
        raise ValidationError("Имя пользователя должно быть от 3 до 20 символов")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise ValidationError("Имя пользователя может содержать только буквы, цифры и подчеркивание")

def validate_message_text(text: str):
    if not text or len(text) > 500:
        raise ValidationError("Текст сообщения должен быть от 1 до 500 символов")

def normalize_phone(phone: str) -> str:
    normalized = re.sub(r'\D', '', phone)
    return normalized

def validate_phone(phone: str):
    normalized = normalize_phone(phone)
    if len(normalized) < 10 or len(normalized) > 15:
        raise ValidationError("Номер телефона должен содержать от 10 до 15 цифр")
    if not re.match(r'^\d{10,15}$', normalized):
        raise ValidationError("Неверный формат номера телефона")
    return normalized
def validate_chat_id(chat_id: str):
    """Валидация chat_id: не пусто, не >50 символов, только alnum + дефисы."""
    if not chat_id:
        raise ValidationError("chat_id не может быть пустым")
    if len(chat_id) > 50:
        raise ValidationError("chat_id не может быть больше 50 символов")
    if not re.match(r'^[a-zA-Z0-9\-]+$', chat_id):
        raise ValidationError("chat_id может содержать только буквы, цифры и дефисы")
    return chat_id