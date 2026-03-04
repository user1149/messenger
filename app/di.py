"""Контейнер зависимостей приложения."""
from typing import Any, Dict
from sqlalchemy.orm import Session
from redis import Redis

from app.services.chat_service import ChatService
from app.repositories import (
    UserRepository,
    ChatRepository,
    MessageRepository,
    LastReadRepository
)
from app.services import (
    AuthService,
    UserService,
    MessageService,
    GroupService,
    PresenceService
)


class Container:
    """DI контейнер с управлением всеми зависимостями."""

    def __init__(self, db_session: Session, redis_client: Redis, config: Dict[str, Any]) -> None:
        self.db_session = db_session
        self.redis_client = redis_client
        self.config = config

        # Репозитории
        self.user_repo = UserRepository(db_session)
        self.chat_repo = ChatRepository(db_session)
        self.message_repo = MessageRepository(db_session)
        self.last_read_repo = LastReadRepository(db_session)

        # Сервисы
        self.auth_service = AuthService(
            user_repo=self.user_repo,
            redis_client=self.redis_client,
            config=self.config
        )
        self.user_service = UserService(
            user_repo=self.user_repo
        )
        self.message_service = MessageService(
            user_repo=self.user_repo,
            message_repo=self.message_repo,
            last_read_repo=self.last_read_repo,
            chat_repo=self.chat_repo,
            redis_client=self.redis_client,
            config=self.config
        )
        self.group_service = GroupService(
            user_repo=self.user_repo,
            chat_repo=self.chat_repo,
            message_repo=self.message_repo,
            last_read_repo=self.last_read_repo,
            redis_client=self.redis_client,
            config=self.config
        )
        self.presence_service = PresenceService(
            redis_client=self.redis_client,
            chat_repo=self.chat_repo,
            user_repo=self.user_repo
        )
        self.chat_service = ChatService(
            chat_repo=self.chat_repo,
            user_repo=self.user_repo,
            message_repo=self.message_repo,
            redis_client=self.redis_client
        )
