import re
import html
from app.exceptions.auth_errors import ValidationError

def escape_html(text: str) -> str:
    return html.escape(text)

def validate_email(email: str):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValidationError("Invalid email")

def validate_username(username: str):
    if len(username) < 3 or len(username) > 20:
        raise ValidationError("Username must be 3-20 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise ValidationError("Username can only contain letters, numbers and underscores")

def validate_password(password: str):
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        raise ValidationError("Password must contain uppercase letter")
    if not any(c.isdigit() for c in password):
        raise ValidationError("Password must contain digit")

def validate_message_text(text: str):
    if not text or len(text) > 500:
        raise ValidationError("Message text must be between 1 and 500 characters")
