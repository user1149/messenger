from flask_socketio import emit, join_room
from flask_login import current_user
from app.utils.rate_limit import check_rate_limit
from app.socket_handlers.presence import authenticated_only
import logging

logger = logging.getLogger(__name__)

def register_groups_handlers(socketio, container):
    group_service = container.group_service
    message_service = container.message_service
    redis_client = container.redis_client
    chat_repo = container.chat_repo

    @socketio.on('create_private_chat')
    @authenticated_only
    def handle_create_private_chat(data):
        if check_rate_limit(current_user.username, 'create_private_chat', redis_client):
            emit('error', {'message': 'Rate limit'})
            return
        
        other_username = data.get('username', '').strip()
        if not other_username:
            emit('error', {'message': 'Invalid username'})
            return
            
        try:
            chat_info, other_dto = group_service.create_private_chat(current_user.id, other_username)
            emit('chat_created', chat_info)
            emit('unread_counts', message_service.get_unread_counts(current_user.id))
            if other_dto:
                sid = redis_client.get(f"online:{other_dto['username']}")
                if sid:
                    socketio.emit('chat_created', chat_info, room=sid)
                    counts = message_service.get_unread_counts(other_dto['id'])
                    socketio.emit('unread_counts', counts, room=sid)
        except Exception as e:
            logger.exception("Error in create_private_chat")
            emit('error', {'message': str(e)})

    @socketio.on('create_group')
    @authenticated_only
    def handle_create_group(data):
        if check_rate_limit(current_user.username, 'create_private_chat', redis_client):
            emit('error', {'message': 'Rate limit'})
            return
        
        name = data.get('name', '').strip() if data else ''
        if not name or not name.strip() or len(name) > 100:
            emit('error', {'message': 'Invalid group name'})
            return
            
        description = data.get('description', '').strip()
        member_ids = data.get('member_ids', [])
        chat_service = container.chat_service
        try:
            chat_info = group_service.create_group(name, description, current_user.id, member_ids)
            emit('group_created', chat_info)
            emit('unread_counts', chat_service.get_unread_counts(current_user.id))
            join_room(chat_info['id'])
            for uid in member_ids:
                if uid != current_user.id:
                    user = container.user_service.get_user_by_id(uid)
                    if user:
                        sid = redis_client.get(f"online:{user['username']}")
                        if sid:
                            socketio.emit('chat_created', chat_info, room=sid)
                            counts = chat_service.get_unread_counts(uid)
                            socketio.emit('unread_counts', counts, room=sid)
        except Exception as e:
            logger.exception("Error in create_group")
            emit('error', {'message': str(e)})

    @socketio.on('add_to_group')
    @authenticated_only
    def handle_add_to_group(data):
        chat_id = data.get('chat_id', '').strip()
        try:
            user_id = int(data.get('user_id', 0))
        except (ValueError, TypeError):
            emit('error', {'message': 'Invalid user_id'})
            return
            
        if not chat_id or not user_id:
            emit('error', {'message': 'Invalid parameters'})
            return
            
        try:
            result = group_service.add_user_to_group(chat_id, user_id, current_user.id)
            user = container.user_service.get_user_by_id(user_id)
            if user:
                sid = redis_client.get(f"online:{user['username']}")
                if sid:
                    chat_info = group_service.get_group_info(chat_id, user_id)
                    socketio.emit('chat_created', chat_info, room=sid)
                    counts = message_service.get_unread_counts(user_id)
                    socketio.emit('unread_counts', counts, room=sid)
            updated_info = group_service.get_group_info(chat_id, None)
            if updated_info:
                socketio.emit('group_info_updated', updated_info, room=chat_id)
        except Exception as e:
            logger.exception("Error in add_to_group")
            emit('error', {'message': str(e)})

    @socketio.on('remove_from_group')
    @authenticated_only
    def handle_remove_from_group(data):
        chat_id = data.get('chat_id', '').strip()
        try:
            user_id = int(data.get('user_id', 0))
        except (ValueError, TypeError):
            emit('error', {'message': 'Invalid user_id'})
            return
            
        if not chat_id or not user_id:
            emit('error', {'message': 'Invalid parameters'})
            return
            
        try:
            result = group_service.remove_user_from_group(chat_id, user_id, current_user.id)
            if user_id != current_user.id:
                user = container.user_service.get_user_by_id(user_id)
                if user:
                    sid = redis_client.get(f"online:{user['username']}")
                    if sid:
                        socketio.emit('removed_from_group', {'chat_id': chat_id}, room=sid)
            updated_info = group_service.get_group_info(chat_id, None)
            if updated_info:
                socketio.emit('group_info_updated', updated_info, room=chat_id)
        except Exception as e:
            logger.exception("Error in remove_from_group")
            emit('error', {'message': str(e)})

    @socketio.on('get_group_info')
    @authenticated_only
    def handle_get_group_info(data):
        chat_id = data.get('chat_id')
        try:
            info = group_service.get_group_info(chat_id, current_user.id)
            if info:
                emit('group_info', info)
            else:
                emit('error', {'message': 'Group not found'})
        except Exception as e:
            logger.exception("Error in get_group_info")
            emit('error', {'message': str(e)})

    @socketio.on('leave_group')
    @authenticated_only
    def handle_leave_group(data):
        chat_id = data.get('chat_id')
        try:
            result = group_service.remove_user_from_group(chat_id, current_user.id, current_user.id)
            updated_info = group_service.get_group_info(chat_id, None)
            if updated_info:
                socketio.emit('group_info_updated', updated_info, room=chat_id)
            emit('left_group', {'chat_id': chat_id})
        except Exception as e:
            logger.exception("Error in leave_group")
            emit('error', {'message': str(e)})
