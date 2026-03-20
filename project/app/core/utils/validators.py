import re
import html
from app.core.exceptions.auth_errors import ValidationError

_IMAGE_SIGNATURES = [
    (b'\xff\xd8\xff', 'jpg'),
    (b'\x89PNG\r\n\x1a\n', 'png'),
    (b'GIF87a', 'gif'),
    (b'GIF89a', 'gif'),
]


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


def allowed_file(filename: str) -> bool:
    from app.core.utils.constants import ValidationRules
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ValidationRules.ALLOWED_EXTENSIONS


def validate_image_content(file) -> bool:
    header = file.read(8)
    file.seek(0)
    for sig, _ in _IMAGE_SIGNATURES:
        if header[:len(sig)] == sig:
            return True
    return False