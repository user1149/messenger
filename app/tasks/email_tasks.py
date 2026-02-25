"""Email задачи для приложения."""
from typing import Optional
from flask import Flask
from app.integrations.email_provider import FlaskMailProvider


class EmailTask:
    """Wrapper для отправки email через EmailProvider."""
    
    def __init__(self, app: Optional[Flask] = None) -> None:
        self.provider = FlaskMailProvider(app)
    
    def send_confirmation(self, to_email: str, username: str, token: str) -> bool:
        """Отправить письмо подтверждения."""
        return self.provider.send_confirmation(to_email, username, token)

