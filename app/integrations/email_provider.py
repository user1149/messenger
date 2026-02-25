"""Email интеграция - провайдеры для отправки писем."""
from abc import ABC, abstractmethod
from typing import Optional
from threading import Thread
from flask import Flask
from flask_mail import Message
from app.extensions import mail


class EmailProvider(ABC):
    """Базовый класс для email провайдера."""
    
    @abstractmethod
    def send_confirmation(self, to_email: str, username: str, token: str) -> bool:
        """Отправка письма подтверждения email."""
        pass


class FlaskMailProvider(EmailProvider):
    """Провайдер для отправки писем через Flask-Mail."""
    
    def __init__(self, app: Optional[Flask] = None):
        self.app = app
    
    def send_confirmation(self, to_email: str, username: str, token: str) -> bool:
        """Отправка письма подтверждения email в отдельном потоке."""
        if self.app:
            Thread(
                target=self._send_async,
                args=(self.app, to_email, username, token)
            ).start()
        return True
    
    @staticmethod
    def _send_async(app: Flask, to_email: str, username: str, token: str) -> None:
        """Асинхронная отправка письма."""
        with app.app_context():
            try:
                base_url = app.config.get("BASE_URL")
                if not base_url:
                    app.logger.error("BASE_URL not configured")
                    return
                
                confirm_url = f"{base_url}/auth/confirm/{token}"
                html = f"""
                <h2>Email подтверждение</h2>
                <p>Привет, {username}!</p>
                <p>Для завершения регистрации перейди по ссылке:</p>
                <p><a href="{confirm_url}">{confirm_url}</a></p>
                <p>Ссылка действительна 24 часа.</p>
                """
                
                msg = Message(
                    subject="Email подтверждение",
                    recipients=[to_email],
                    html=html
                )
                mail.send(msg)
                app.logger.info(f"Confirmation email sent to {to_email}")
            except Exception as e:
                app.logger.error(f"Failed to send confirmation email: {e}")
