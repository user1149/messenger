from flask_socketio import emit, join_room
from flask_login import current_user
from app.utils.rate_limit import check_rate_limit
from app.exceptions.chat_errors import ChatNotFoundError, AccessDeniedError
import logging

logger = logging.getLogger(__name__)

def register_messaging_handlers(socketio, container):
    message_service = container.message_service
    group_service = container.group_service
    redis_client = container.redis_client
    chat_repo = container.chat_repo

    @socketio.on('join_chat')
    def handle_join_chat(data):
        if check_rate_limit(current_user.username, 'join_chat', redis_client):
            emit('error', {'message': 'Превышен лимит запросов'})
            return
        
        chat_id = data.get('chat_id', '').strip()
        if not chat_id:
            emit('error', {'message': 'Неверный chat_id'})
            return
            
        chat_service = container.chat_service
        try:
            if not chat_repo.user_in_chat(current_user.id, chat_id):
                raise AccessDeniedError()
            join_room(chat_id)
            history = message_service.get_chat_history(chat_id, current_user.id)
            emit('chat_history', {'chat_id': chat_id, 'messages': history})
            message_service.mark_read(current_user.id, chat_id)
            counts = chat_service.get_unread_counts(current_user.id)
            emit('unread_counts', counts)
        except AccessDeniedError:
            emit('error', {'message': 'Доступ запрещен'})
        except ChatNotFoundError:
            emit('error', {'message': 'Чат не найден'})
        except Exception as e:
            logger.exception("Error in join_chat")
            emit('error', {'message': 'Внутренняя ошибка'})

    @socketio.on('new_message')
    def handle_new_message(data):
        if check_rate_limit(current_user.username, 'new_message', redis_client):
            emit('error', {'message': 'Превышен лимит запросов'})
            return
        
        if not data:
            emit('error', {'message': 'Невалидный запрос'})
            return
        chat_id = data.get('chat_id', '').strip()
        text = data.get('text', '').strip()
        
        if not chat_id or not text:
            emit('error', {'message': 'Неверные chat_id или text'})
            return
            
        chat_service = container.chat_service
        try:
            msg_dto = message_service.send_message(current_user.id, chat_id, text)
            emit('new_message', msg_dto, room=chat_id)
            participants = chat_repo.get_participants(chat_id)
            for user in participants:
                if user.id != current_user.id:
                    sid = redis_client.get(f"online:{user.username}")
                    if sid:
                        counts = chat_service.get_unread_counts(user.id)
                        socketio.emit('unread_counts', counts, room=sid)
        except Exception as e:
            logger.exception("Error in new_message")
            emit('error', {'message': str(e)})

    @socketio.on('typing')
    def handle_typing(data):
        if check_rate_limit(current_user.username, 'typing', redis_client):
            return
        
        chat_id = data.get('chat_id', '').strip()
        if not chat_id:
            return
            
        is_typing = data.get('typing', False)
        try:
            if not chat_repo.user_in_chat(current_user.id, chat_id):
                return
            emit('typing', {
                'username': current_user.username,
                'typing': is_typing,
                'chat_id': chat_id
            }, room=chat_id, include_self=False)
        except Exception as e:
            logger.exception("Error in typing")

    @socketio.on('mark_read')
    def handle_mark_read(data):
        if check_rate_limit(current_user.username, 'mark_read', redis_client):
            return
        
        chat_id = data.get('chat_id', '').strip()
        if not chat_id:
            return
            
        try:
            message_service.mark_read(current_user.id, chat_id)
            counts = message_service.get_unread_counts(current_user.id)
            emit('unread_counts', counts)
        except Exception as e:
            logger.exception("Error in mark_read")
            emit('error', {'message': str(e)})
