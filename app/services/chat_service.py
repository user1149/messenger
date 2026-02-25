from typing import List, Dict
from app.repositories import ChatRepository, UserRepository, MessageRepository

class ChatService:
    def __init__(self, chat_repo: ChatRepository, user_repo: UserRepository, message_repo: MessageRepository, redis_client=None):
        self.chat_repo = chat_repo
        self.user_repo = user_repo
        self.message_repo = message_repo
        self.redis = redis_client

    def get_user_chats(self, user_id: int) -> List[Dict]:
        """Возвращает список чатов пользователя с последним сообщением."""
        return self.chat_repo.get_user_chats_with_last_message(user_id)

    def get_unread_counts(self, user_id: int) -> Dict[str, int]:
        """Возвращает словарь {chat_id: количество непрочитанных} для пользователя."""
        chat_ids = self.chat_repo.get_user_chat_ids(user_id)
        return self.message_repo.count_unread_for_user(user_id, chat_ids, self.redis)
