# app/services/message_service.py
from typing import Dict, List, Any
from datetime import datetime, timedelta
from redis import Redis
from app.repositories import UserRepository, MessageRepository, LastReadRepository, ChatRepository
from app.exceptions.chat_errors import (
    AccessDeniedError,
    MessageNotFoundError,
    MessageEditTimeExpiredError
)
from app.utils.constants import MessageEditWindow
from app.utils.validators import validate_message_text, escape_html
from app.utils.logging import log_message_deleted, log_message_edited
from app.models import LastRead

class MessageService:
    def __init__(
        self,
        user_repo: UserRepository,
        message_repo: MessageRepository,
        last_read_repo: LastReadRepository,
        chat_repo: ChatRepository,
        redis_client: Redis,
        config: Dict[str, Any]
    ) -> None:
        self.user_repo = user_repo
        self.message_repo = message_repo
        self.last_read_repo = last_read_repo
        self.chat_repo = chat_repo
        self.redis = redis_client
        self.config = config

    def _check_user_in_chat(self, user_id: int, chat_id: str) -> bool:
        return self.chat_repo.user_in_chat(user_id, chat_id)

    def get_unread_counts(self, user_id: int) -> Dict[str, int]:
        chat_ids = self.chat_repo.get_user_chat_ids(user_id)
        return self.message_repo.count_unread_for_user(user_id, chat_ids, self.redis)

    def send_message(self, user_id: int, chat_id: str, text: str) -> Dict[str, Any]:
        if not self._check_user_in_chat(user_id, chat_id):
            raise AccessDeniedError("Вы не участник этого чата")
        validate_message_text(text)
        safe_text = escape_html(text)
        message = self.message_repo.create(chat_id, user_id, safe_text)
        self.message_repo.session.commit()
        user = self.user_repo.get_by_id(user_id)
        return {
            'id': message.id,
            'nickname': user.username,
            'avatar_url': user.avatar_url,
            'text': message.text,
            'timestamp': message.timestamp.isoformat(),
            'chat_id': chat_id,
            'user_id': user_id,
            'is_deleted': False,
            'edited': False
        }

    def get_chat_history(self, chat_id: str, user_id: int, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        if not self._check_user_in_chat(user_id, chat_id):
            raise AccessDeniedError("Вы не участник этого чата")
        messages = self.message_repo.get_chat_history(chat_id, limit=limit, offset=offset)
        return [{
            'id': m.id,
            'nickname': m.user.username,
            'text': m.text,
            'timestamp': m.timestamp.isoformat(),
            'chat_id': chat_id,
            'is_deleted': m.is_deleted,
            'edited': m.edited,
            'edited_at': m.edited_at.isoformat() if m.edited_at else None,
            'user_id': m.user_id
        } for m in messages]

    def mark_read(self, user_id: int, chat_id: str) -> None:
        if not self._check_user_in_chat(user_id, chat_id):
            raise AccessDeniedError()
        last_msg = self.message_repo.get_last_message(chat_id)
        if last_msg:
            last_read = self.last_read_repo.session.query(
                LastRead
            ).filter_by(
                user_id=user_id,
                chat_id=chat_id
            ).with_for_update().first()
            if last_read:
                last_read.last_message_id = last_msg.id
            else:
                last_read = LastRead(
                    user_id=user_id,
                    chat_id=chat_id,
                    last_message_id=last_msg.id
                )
                self.last_read_repo.session.add(last_read)
            self.last_read_repo.session.commit()
            if self.redis:
                self.redis.delete(f"unread:{user_id}")

    def delete_message(self, user_id: int, message_id: int, chat_id: str) -> Dict[str, Any]:
        if not self._check_user_in_chat(user_id, chat_id):
            raise AccessDeniedError()
        message = self.message_repo.get_by_id(message_id)
        if not message or message.chat_id != chat_id:
            raise MessageNotFoundError()
        if message.user_id != user_id:
            raise AccessDeniedError("Вы не можете удалить сообщение другого пользователя")
        if datetime.utcnow() - message.timestamp > timedelta(seconds=MessageEditWindow.SECONDS):
            raise MessageEditTimeExpiredError("Сообщения можно удалять только в течение 5 минут")
        success = self.message_repo.delete_message(message_id)
        if not success:
            raise MessageNotFoundError()
        self.message_repo.session.commit()
        user = self.user_repo.get_by_id(user_id)
        log_message_deleted(user_id, message_id, chat_id, user.username if user else "unknown")
        return {"chat_id": chat_id, "message_id": message_id}

    def edit_message(self, user_id: int, message_id: int, chat_id: str, new_text: str) -> Dict[str, Any]:
        if not self._check_user_in_chat(user_id, chat_id):
            raise AccessDeniedError()
        validate_message_text(new_text)
        message = self.message_repo.get_by_id(message_id)
        if not message or message.chat_id != chat_id:
            raise MessageNotFoundError()
        if message.user_id != user_id:
            raise AccessDeniedError("Вы не можете редактировать сообщение другого пользователя")
        if datetime.utcnow() - message.timestamp > timedelta(seconds=MessageEditWindow.SECONDS):
            raise MessageEditTimeExpiredError("Сообщения можно редактировать только в течение 5 минут")
        safe_text = escape_html(new_text)
        edited = self.message_repo.edit_message(message_id, safe_text)
        if not edited:
            raise MessageNotFoundError()
        self.message_repo.session.commit()
        user = self.user_repo.get_by_id(user_id)
        log_message_edited(user_id, message_id, chat_id, user.username if user else "unknown")
        return {
            'id': edited.id,
            'nickname': user.username,
            'text': edited.text,
            'timestamp': edited.timestamp.isoformat(),
            'edited_at': edited.edited_at.isoformat() if edited.edited_at else None,
            'chat_id': chat_id,
            'user_id': user_id,
            'is_deleted': False,
            'edited': True
        }
