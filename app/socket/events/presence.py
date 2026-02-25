"""Socket.IO обработчики для presence (онлайн статус)."""
from typing import Any, Callable
from functools import wraps
import logging
from flask import request
from flask_socketio import emit, disconnect, SocketIO
from flask_login import current_user
from app.utils.constants import SocketEvent
from app.di import Container

logger = logging.getLogger(__name__)


def authenticated_only(f: Callable) -> Callable:
    """Decorator для проверки аутентификации в socket handlers."""
    @wraps(f)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        if not current_user.is_authenticated:
            try:
                disconnect()
            except Exception:
                pass
            return
        return f(*args, **kwargs)
    return wrapped


def register_presence_handlers(socketio: SocketIO, container: Container) -> None:
    """Регистрация обработчиков для presence."""
    presence_service = container.presence_service
    chat_service = container.chat_service

    @socketio.on("connect")
    @authenticated_only
    def handle_connect() -> None:
        """Обработка подключения пользователя."""
        try:
            presence_service.user_connected(
                current_user.id,
                current_user.username,
                request.sid
            )
            logger.info(f"User connected: {current_user.username}")

            # Отправить список чатов
            chats = chat_service.get_user_chats(current_user.id)
            emit(SocketEvent.CHAT_LIST, chats)
            
            # Отправить количество непрочитанных
            counts = container.message_service.get_unread_counts(current_user.id)
            emit(SocketEvent.UNREAD_COUNTS, counts)

            # Уведомить других онлайн пользователей
            online_users = presence_service.get_online_users_in_chats(current_user.id)
            for username in online_users:
                sid = container.redis_client.get(f"online:{username}")
                if sid:
                    socketio.emit(
                        SocketEvent.USER_ONLINE,
                        {"username": current_user.username},
                        room=sid
                    )
        except Exception as e:
            logger.exception("Error in connect handler")
            try:
                emit(SocketEvent.ERROR, {"message": "Connection error"})
                disconnect()
            except Exception:
                pass

    @socketio.on("disconnect")
    @authenticated_only
    def handle_disconnect() -> None:
        """Обработка отключения пользователя."""
        try:
            username = current_user.username
            presence_service.user_disconnected(username)
            logger.info(f"User disconnected: {username}")

            # Уведомить других что пользователь офлайн
            online_users = presence_service.get_online_users_in_chats(current_user.id)
            for other_username in online_users:
                sid = container.redis_client.get(f"online:{other_username}")
                if sid:
                    socketio.emit(
                        SocketEvent.USER_OFFLINE,
                        {"username": username},
                        room=sid
                    )

            # Отправить that user stopped typing в все чаты
            user_chat_ids = container.chat_repo.get_user_chat_ids(current_user.id)
            for chat_id in user_chat_ids:
                socketio.emit(
                    SocketEvent.TYPING,
                    {
                        "username": username,
                        "typing": False,
                        "chat_id": chat_id
                    },
                    room=chat_id
                )
        except Exception as e:
            logger.exception("Error in disconnect handler")
