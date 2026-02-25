"""Socket.IO обработчики для модерации сообщений (moderation)."""
from typing import Optional, Dict, Any
import logging
from flask_socketio import emit, SocketIO
from flask_login import current_user
from app.utils.constants import SocketEvent
from app.exceptions.chat_errors import (
    AccessDeniedError,
    MessageNotFoundError,
    MessageEditTimeExpiredError
)
from app.socket.events.presence import authenticated_only
from app.di import Container

logger = logging.getLogger(__name__)


def register_moderation_handlers(socketio: SocketIO, container: Container) -> None:
    """Регистрация обработчиков для модерации сообщений."""
    message_service = container.message_service
    chat_service = container.chat_service

    @socketio.on("delete_message")
    @authenticated_only
    def handle_delete_message(data: Optional[Dict[str, Any]]) -> None:
        """Удалить сообщение."""
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        chat_id = data.get("chat_id", "").strip()
        try:
            message_id = int(data.get("message_id", 0))
        except (ValueError, TypeError):
            emit(SocketEvent.ERROR, {"message": "Invalid message_id"})
            return
            
        if not chat_id or not message_id:
            emit(SocketEvent.ERROR, {"message": "Invalid parameters"})
            return
            
        try:
            result = message_service.delete_message(current_user.id, message_id, chat_id)
            emit(SocketEvent.MESSAGE_DELETED, result, room=chat_id)
        except AccessDeniedError as e:
            emit(SocketEvent.ERROR, {"message": str(e)})
        except MessageNotFoundError as e:
            emit(SocketEvent.ERROR, {"message": str(e)})
        except MessageEditTimeExpiredError as e:
            emit(SocketEvent.ERROR, {"message": str(e)})
        except Exception as e:
            logger.exception("Error in delete_message")
            emit(SocketEvent.ERROR, {"message": "Internal error"})

    @socketio.on("edit_message")
    @authenticated_only
    def handle_edit_message(data: Optional[Dict[str, Any]]) -> None:
        """Редактировать сообщение."""
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        chat_id = data.get("chat_id", "").strip()
        try:
            message_id = int(data.get("message_id", 0))
        except (ValueError, TypeError):
            emit(SocketEvent.ERROR, {"message": "Invalid message_id"})
            return
            
        new_text = data.get("text", "").strip()
        
        if not chat_id or not message_id or not new_text:
            emit(SocketEvent.ERROR, {"message": "Invalid parameters"})
            return
            
        try:
            updated = message_service.edit_message(current_user.id, message_id, chat_id, new_text)
            emit(SocketEvent.MESSAGE_EDITED, updated, room=chat_id)
        except AccessDeniedError as e:
            emit(SocketEvent.ERROR, {"message": str(e)})
        except MessageNotFoundError as e:
            emit(SocketEvent.ERROR, {"message": str(e)})
        except MessageEditTimeExpiredError as e:
            emit(SocketEvent.ERROR, {"message": str(e)})
        except Exception as e:
            logger.exception("Error in edit_message")
            emit(SocketEvent.ERROR, {"message": "Internal error"})
