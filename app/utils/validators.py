import re
import html
from app.exceptions.auth_errors import ValidationError

def escape_html(text: str) -> str:
    return html.escape(text)

def validate_username(username: str):
    if len(username) < 3 or len(username) > 20:
        raise ValidationError("Username must be 3-20 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise ValidationError("Username can only contain letters, digits, and underscore")

def validate_message_text(text: str):
    if not text or len(text) > 500:
        raise ValidationError("Message text must be 1-500 characters")

def validate_chat_id(chat_id: str):
    if not chat_id:
        raise ValidationError("chat_id cannot be empty")
    if len(chat_id) > 50:
        raise ValidationError("chat_id too long (max 50)")
    if not re.match(r'^[a-zA-Z0-9\-]+$', chat_id):
        raise ValidationError("chat_id can only contain letters, digits, hyphens")
    return chat_id


def normalize_phone(phone: str) -> str:
    """Нормализовать номер телефона: оставить только цифры, опциональный ведущий +."""
    if not phone:
        raise ValidationError("Phone number is required")
    # Удаляем все кроме цифр и плюса
    cleaned = re.sub(r"[^\d+]", "", phone)
    # Переносим плюс в начало, если он был внутри
    if "+" in cleaned and not cleaned.startswith("+"):
        cleaned = "+" + re.sub(r"\D", "", cleaned)
    return cleaned


def validate_phone(phone: str):
    """Простая валидация номера телефона."""
    normalized = normalize_phone(phone)
    digits = re.sub(r"\D", "", normalized)
    if len(digits) < 10 or len(digits) > 15:
        raise ValidationError("Invalid phone number format")
    return normalized
