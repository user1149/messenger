from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from .base import BaseRepository
from app.models.message import Message
from app.models.last_read import LastRead

class MessageRepository(BaseRepository):
    def create(self, chat_id: str, user_id: int, text: str) -> Message:
        message = Message(chat_id=chat_id, user_id=user_id, text=text)
        self.session.add(message)
        self.session.flush()
        return message

    def get_by_id(self, message_id: int) -> Optional[Message]:
        return self.session.get(Message, message_id)

    def get_last_message(self, chat_id: str) -> Optional[Message]:
        return self.session.query(Message).filter_by(chat_id=chat_id).order_by(Message.id.desc()).first()

    def get_chat_history(self, chat_id: str, limit: int = 100, offset: int = 0) -> List[Message]:
        return self.session.query(Message).filter_by(chat_id=chat_id).options(
            joinedload(Message.user)
        ).order_by(Message.timestamp.desc()).limit(limit).offset(offset).all()

    def count_unread_for_user(self, user_id: int, chat_ids: list, redis_client=None) -> dict:
        if not chat_ids:
            return {}
        
        cache_key = f"unread:{user_id}"
        if redis_client:
            cached = redis_client.get(cache_key)
            if cached:
                import json
                return json.loads(cached)
        
        from sqlalchemy import case
        results = self.session.query(
            Message.chat_id,
            func.sum(case((Message.id > func.coalesce(LastRead.last_message_id, 0), 1), else_=0)).label('unread_count')
        ).outerjoin(
            LastRead,
            (LastRead.user_id == user_id) & (LastRead.chat_id == Message.chat_id)
        ).filter(
            Message.chat_id.in_(chat_ids),
            Message.is_deleted == False
        ).group_by(Message.chat_id).all()
        
        unread_counts = {chat_id: 0 for chat_id in chat_ids}
        for chat_id, unread_count in results:
            unread_counts[chat_id] = unread_count or 0
        
        if redis_client:
            import json
            redis_client.setex(cache_key, 30, json.dumps(unread_counts))
        
        return unread_counts

    def delete_message(self, message_id: int) -> bool:
        message = self.get_by_id(message_id)
        if not message:
            return False
        message.is_deleted = True
        self.session.flush()
        return True

    def edit_message(self, message_id: int, new_text: str) -> Optional[Message]:
        message = self.get_by_id(message_id)
        if not message or message.is_deleted:
            return None
        message.text = new_text
        message.edited = True
        message.edited_at = datetime.utcnow()
        self.session.flush()
        return message
