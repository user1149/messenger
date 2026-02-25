"""Socket.IO обработчики для групп (groups management)."""
from typing import Optional, Dict, Any
import logging
from flask_socketio import emit, join_room, SocketIO
from flask_login import current_user
from app.utils.rate_limit import check_rate_limit
from app.utils.constants import SocketEvent, RateLimitAction
from app.socket.events.presence import authenticated_only
from app.di import Container

logger = logging.getLogger(__name__)


def register_groups_handlers(socketio: SocketIO, container: Container) -> None:
    """Регистрация обработчиков для управления группами."""
    group_service = container.group_service
    message_service = container.message_service
    chat_service = container.chat_service
    redis_client = container.redis_client
    chat_repo = container.chat_repo

    @socketio.on("create_private_chat")
    @authenticated_only
    def handle_create_private_chat(data: Optional[Dict[str, Any]]) -> None:
        """Создать приватный чат."""
        if check_rate_limit(current_user.username, RateLimitAction.CREATE_PRIVATE_CHAT, redis_client):
            emit(SocketEvent.ERROR, {"message": "Rate limit exceeded"})
            return
        
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        other_username = data.get("username", "").strip()
        if not other_username:
            emit(SocketEvent.ERROR, {"message": "Invalid username"})
            return
            
        try:
            chat_info, other_dto = group_service.create_private_chat(
                current_user.id,
                other_username
            )
            
            emit(SocketEvent.CHAT_CREATED, chat_info)
            emit(SocketEvent.UNREAD_COUNTS, message_service.get_unread_counts(current_user.id))
            
            # Уведомить другого пользователя если он онлайн
            if other_dto:
                sid = redis_client.get(f"online:{other_dto['username']}")
                if sid:
                    socketio.emit(SocketEvent.CHAT_CREATED, chat_info, room=sid)
                    counts = message_service.get_unread_counts(other_dto["id"])
                    socketio.emit(SocketEvent.UNREAD_COUNTS, counts, room=sid)
        except Exception as e:
            logger.exception("Error in create_private_chat")
            emit(SocketEvent.ERROR, {"message": str(e)})

    @socketio.on("create_group")
    @authenticated_only
    def handle_create_group(data: Optional[Dict[str, Any]]) -> None:
        """Создать новую группу."""
        if check_rate_limit(current_user.username, RateLimitAction.CREATE_PRIVATE_CHAT, redis_client):
            emit(SocketEvent.ERROR, {"message": "Rate limit exceeded"})
            return
        
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        name = data.get("name", "").strip()
        if not name:
            emit(SocketEvent.ERROR, {"message": "Invalid group name"})
            return
            
        description = data.get("description", "").strip() if data.get("description") else None
        member_ids = data.get("member_ids", [])
        
        try:
            chat_info = group_service.create_group(
                name,
                description,
                current_user.id,
                member_ids
            )
            
            emit(SocketEvent.GROUP_CREATED, chat_info)
            emit(SocketEvent.UNREAD_COUNTS, chat_service.get_unread_counts(current_user.id))
            join_room(chat_info["id"])
            
            # Уведомить всех участников
            for uid in member_ids:
                if uid != current_user.id:
                    user = container.user_service.get_user_by_id(uid)
                    if user:
                        sid = redis_client.get(f"online:{user['username']}")
                        if sid:
                            socketio.emit(SocketEvent.CHAT_CREATED, chat_info, room=sid)
                            counts = chat_service.get_unread_counts(uid)
                            socketio.emit(SocketEvent.UNREAD_COUNTS, counts, room=sid)
        except Exception as e:
            logger.exception("Error in create_group")
            emit(SocketEvent.ERROR, {"message": str(e)})

    @socketio.on("add_to_group")
    @authenticated_only
    def handle_add_to_group(data: Optional[Dict[str, Any]]) -> None:
        """Добавить пользователя в группу."""
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        chat_id = data.get("chat_id", "").strip()
        try:
            user_id = int(data.get("user_id", 0))
        except (ValueError, TypeError):
            emit(SocketEvent.ERROR, {"message": "Invalid user_id"})
            return
            
        if not chat_id or not user_id:
            emit(SocketEvent.ERROR, {"message": "Invalid parameters"})
            return
            
        try:
            result = group_service.add_user_to_group(chat_id, user_id, current_user.id)
            
            # Уведомить добавленного пользователя если он онлайн
            user = container.user_service.get_user_by_id(user_id)
            if user:
                sid = redis_client.get(f"online:{user['username']}")
                if sid:
                    chat_info = group_service.get_group_info(chat_id, user_id)
                    socketio.emit(SocketEvent.CHAT_CREATED, chat_info, room=sid)
                    counts = message_service.get_unread_counts(user_id)
                    socketio.emit(SocketEvent.UNREAD_COUNTS, counts, room=sid)
            
            # Уведомить всех участников об обновлении группы
            updated_info = group_service.get_group_info(chat_id, None)
            if updated_info:
                socketio.emit(SocketEvent.GROUP_INFO_UPDATED, updated_info, room=chat_id)
        except Exception as e:
            logger.exception("Error in add_to_group")
            emit(SocketEvent.ERROR, {"message": str(e)})

    @socketio.on("remove_from_group")
    @authenticated_only
    def handle_remove_from_group(data: Optional[Dict[str, Any]]) -> None:
        """Удалить пользователя из группы."""
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        chat_id = data.get("chat_id", "").strip()
        try:
            user_id = int(data.get("user_id", 0))
        except (ValueError, TypeError):
            emit(SocketEvent.ERROR, {"message": "Invalid user_id"})
            return
            
        if not chat_id or not user_id:
            emit(SocketEvent.ERROR, {"message": "Invalid parameters"})
            return
            
        try:
            result = group_service.remove_user_from_group(chat_id, user_id, current_user.id)
            
            # Если удаляем другого пользователя, уведомить его
            if user_id != current_user.id:
                user = container.user_service.get_user_by_id(user_id)
                if user:
                    sid = redis_client.get(f"online:{user['username']}")
                    if sid:
                        socketio.emit(SocketEvent.REMOVED_FROM_GROUP, {"chat_id": chat_id}, room=sid)
            
            # Уведомить всех участников об обновлении группы
            updated_info = group_service.get_group_info(chat_id, None)
            if updated_info:
                socketio.emit(SocketEvent.GROUP_INFO_UPDATED, updated_info, room=chat_id)
        except Exception as e:
            logger.exception("Error in remove_from_group")
            emit(SocketEvent.ERROR, {"message": str(e)})

    @socketio.on("get_group_info")
    @authenticated_only
    def handle_get_group_info(data: Optional[Dict[str, Any]]) -> None:
        """Получить информацию о группе."""
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        chat_id = data.get("chat_id", "").strip()
        if not chat_id:
            emit(SocketEvent.ERROR, {"message": "Invalid chat_id"})
            return
        
        try:
            info = group_service.get_group_info(chat_id, current_user.id)
            if info:
                emit(SocketEvent.GROUP_INFO, info)
            else:
                emit(SocketEvent.ERROR, {"message": "Group not found"})
        except Exception as e:
            logger.exception("Error in get_group_info")
            emit(SocketEvent.ERROR, {"message": str(e)})

    @socketio.on("leave_group")
    @authenticated_only
    def handle_leave_group(data: Optional[Dict[str, Any]]) -> None:
        """Покинуть группу."""
        if not data:
            emit(SocketEvent.ERROR, {"message": "Invalid data"})
            return
        
        chat_id = data.get("chat_id", "").strip()
        if not chat_id:
            emit(SocketEvent.ERROR, {"message": "Invalid chat_id"})
            return
        
        try:
            result = group_service.remove_user_from_group(chat_id, current_user.id, current_user.id)
            
            # Уведомить остальных участников об обновлении группы
            updated_info = group_service.get_group_info(chat_id, None)
            if updated_info:
                socketio.emit(SocketEvent.GROUP_INFO_UPDATED, updated_info, room=chat_id)
            
            emit(SocketEvent.LEFT_GROUP, {"chat_id": chat_id})
        except Exception as e:
            logger.exception("Error in leave_group")
            emit(SocketEvent.ERROR, {"message": str(e)})
