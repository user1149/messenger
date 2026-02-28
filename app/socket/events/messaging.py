# app/socket/events/messaging.py
from typing import Any
import logging
from flask_socketio import emit, join_room, SocketIO
from flask_login import current_user
from app.utils.rate_limit import check_rate_limit
from app.utils.constants import SocketEvent, RateLimitAction
from app.exceptions.chat_errors import ChatNotFoundError, AccessDeniedError
from app.di import Container

logger = logging.getLogger(__name__)

def register_messaging_handlers(socketio: SocketIO, container: Container) -> None:
    message_service = container.message_service
    chat_service = container.chat_service
    redis_client = container.redis_client
    chat_repo = container.chat_repo

    @socketio.on("join_chat")
    def handle_join_chat(data: dict) -> None:
        if check_rate_limit(current_user.username, RateLimitAction.JOIN_CHAT, redis_client):
            emit(SocketEvent.ERROR, {"message": "Rate limit exceeded"})
            return
        chat_id = data.get("chat_id", "").strip() if data else ""
        if not chat_id:
            emit(SocketEvent.ERROR, {"message": "Invalid chat_id"})
            return
        try:
            chat = chat_repo.get_by_id(chat_id)
            if not chat:
                raise ChatNotFoundError()
            if not chat_repo.user_in_chat(current_user.id, chat_id):
                if chat.type == "group" and chat.created_by == current_user.id:
                    chat_repo.add_participant(current_user.id, chat_id)
                    chat_repo.session.commit()
                else:
                    raise AccessDeniedError()
            join_room(chat_id)
            history = message_service.get_chat_history(chat_id, current_user.id)
            emit(SocketEvent.CHAT_HISTORY, {"chat_id": chat_id, "messages": history})
            message_service.mark_read(current_user.id, chat_id)
            counts = chat_service.get_unread_counts(current_user.id)
            emit(SocketEvent.UNREAD_COUNTS, counts)
        except AccessDeniedError:
            emit(SocketEvent.ERROR, {"message": "Access denied"})
        except ChatNotFoundError:
            emit(SocketEvent.ERROR, {"message": "Chat not found"})
        except Exception as e:
            logger.exception("Error in join_chat")
            emit(SocketEvent.ERROR, {"message": "Internal error"})

    @socketio.on("new_message")
    def handle_new_message(data: dict) -> None:
        if check_rate_limit(current_user.username, RateLimitAction.NEW_MESSAGE, redis_client):
            emit(SocketEvent.ERROR, {"message": "Rate limit exceeded"})
            return
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid request"})
            return
        chat_id = data.get("chat_id", "").strip()
        text = data.get("text", "").strip()
        if not chat_id or not text:
            emit(SocketEvent.ERROR, {"message": "Invalid chat_id or text"})
            return
        try:
            msg_dto = message_service.send_message(current_user.id, chat_id, text)
            emit(SocketEvent.NEW_MESSAGE, msg_dto, room=chat_id)
            participants = chat_repo.get_participants(chat_id)
            for participant in participants:
                if participant.id != current_user.id:
                    sid = redis_client.get(f"online:{participant.username}")
                    if sid:
                        counts = chat_service.get_unread_counts(participant.id)
                        socketio.emit(SocketEvent.UNREAD_COUNTS, counts, room=sid)
        except Exception as e:
            logger.exception("Error in new_message")
            emit(SocketEvent.ERROR, {"message": str(e)})

    @socketio.on("typing")
    def handle_typing(data: dict) -> None:
        if check_rate_limit(current_user.username, RateLimitAction.TYPING, redis_client):
            return
        if not data:
            return
        chat_id = data.get("chat_id", "").strip()
        if not chat_id:
            return
        is_typing = data.get("typing", False)
        try:
            if not chat_repo.user_in_chat(current_user.id, chat_id):
                return
            emit(SocketEvent.TYPING, {
                "username": current_user.username,
                "typing": is_typing,
                "chat_id": chat_id
            }, room=chat_id, include_self=False)
        except Exception as e:
            logger.exception("Error in typing")

    @socketio.on("mark_read")
    def handle_mark_read(data: dict) -> None:
        if check_rate_limit(current_user.username, RateLimitAction.MARK_READ, redis_client):
            return
        if not data:
            return
        chat_id = data.get("chat_id", "").strip()
        if not chat_id:
            return
        try:
            message_service.mark_read(current_user.id, chat_id)
            counts = message_service.get_unread_counts(current_user.id)
            emit(SocketEvent.UNREAD_COUNTS, counts)
        except Exception as e:
            logger.exception("Error in mark_read")
            emit(SocketEvent.ERROR, {"message": str(e)})
