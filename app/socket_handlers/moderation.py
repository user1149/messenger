from flask_socketio import emit
from flask_login import current_user
from app.utils.validators import validate_chat_id
from app.exceptions.auth_errors import ValidationError
from app.exceptions.chat_errors import AccessDeniedError, MessageNotFoundError, MessageEditTimeExpiredError
from app.socket_handlers.presence import authenticated_only
import logging

logger = logging.getLogger(__name__)

def register_moderation_handlers(socketio, container):
    message_service = container.message_service
    redis_client = container.redis_client
    chat_repo = container.chat_repo

    @socketio.on('delete_message')
    @authenticated_only
    def handle_delete_message(data):
        try:
            chat_id = data.get('chat_id', '').strip()
            validate_chat_id(chat_id)
        except ValidationError as e:
            emit('error', {'message': str(e)})
            return
            
        try:
            message_id = int(data.get('message_id', 0))
        except (ValueError, TypeError):
            emit('error', {'message': 'Неверный message_id'})
            return
            
        if not message_id:
            emit('error', {'message': 'Неверные параметры'})
            return
            
        chat_service = container.chat_service
        try:
            result = message_service.delete_message(current_user.id, message_id, chat_id)
            emit('message_deleted', result, room=chat_id)
        except AccessDeniedError as e:
            emit('error', {'message': str(e)})
        except MessageNotFoundError as e:
            emit('error', {'message': str(e)})
        except MessageEditTimeExpiredError as e:
            emit('error', {'message': str(e)})
        except Exception as e:
            logger.exception("Error in delete_message")
            emit('error', {'message': 'Внутренняя ошибка'})

    @socketio.on('edit_message')
    @authenticated_only
    def handle_edit_message(data):
        try:
            chat_id = data.get('chat_id', '').strip()
            validate_chat_id(chat_id)
        except ValidationError as e:
            emit('error', {'message': str(e)})
            return
            
        try:
            message_id = int(data.get('message_id', 0))
        except (ValueError, TypeError):
            emit('error', {'message': 'Неверный message_id'})
            return
            
        new_text = data.get('text', '').strip()
        
        if not message_id or not new_text:
            emit('error', {'message': 'Неверные параметры'})
            return
            
        chat_service = container.chat_service
        try:
            updated = message_service.edit_message(current_user.id, message_id, chat_id, new_text)
            emit('message_edited', updated, room=chat_id)
        except Exception as e:
            logger.exception("Error in edit_message")
            emit('error', {'message': str(e)})
