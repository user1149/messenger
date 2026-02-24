from typing import List, Dict, Optional, Tuple

from app.exceptions.chat_errors import (
    ChatNotFoundError,
    AccessDeniedError
)
from app.exceptions.auth_errors import (
    UserNotFoundError,
    ValidationError
)

class GroupService:
    def __init__(self, user_repo, chat_repo, message_repo, last_read_repo, redis_client, config):
        self.user_repo = user_repo
        self.chat_repo = chat_repo
        self.message_repo = message_repo
        self.last_read_repo = last_read_repo
        self.redis = redis_client
        self.config = config

    def create_group(self, name: str, description: str, creator_id: int, member_ids: List[int]) -> Dict:
        if not name or not name.strip() or len(name.strip()) > 100:
            raise ValidationError("Invalid group name")

        if creator_id not in member_ids:
            member_ids.append(creator_id)

        users = self.user_repo.get_by_ids(member_ids)
        if len(users) != len(member_ids):
            raise UserNotFoundError("Some users not found")

        for user in users:
            if not user.confirmed:
                raise ValidationError(f"User {user.username} is not confirmed")

        chat = self.chat_repo.create_group(name, creator_id, description)
        for user_id in member_ids:
            self.chat_repo.add_participant(user_id, chat.id)

        self.chat_repo.session.commit()

        return {
            'id': chat.id,
            'name': chat.name,
            'type': chat.type,
            'description': chat.description,
            'created_by': creator_id,
            'member_count': len(member_ids)
        }

    def add_user_to_group(self, chat_id: str, user_id: int, adder_id: int) -> Dict:
        chat = self.chat_repo.get_by_id(chat_id)
        if not chat or chat.type != 'group':
            raise ChatNotFoundError("Group not found")

        if not self.chat_repo.is_group_creator(adder_id, chat_id):
            raise AccessDeniedError("Only creator can add users")

        if self.chat_repo.user_in_chat(user_id, chat_id):
            raise ValidationError("User already in group")

        user = self.user_repo.get_by_id(user_id)
        if not user or not user.confirmed:
            raise UserNotFoundError("User not found or not confirmed")

        self.chat_repo.add_participant(user_id, chat_id)
        self.chat_repo.session.commit()

        return {"chat_id": chat_id, "user_id": user_id}

    def remove_user_from_group(self, chat_id: str, user_id: int, remover_id: int) -> Dict:
        chat = self.chat_repo.get_by_id(chat_id)
        if not chat or chat.type != 'group':
            raise ChatNotFoundError("Group not found")

        if user_id == remover_id:
            # Выход из группы
            if not self.chat_repo.user_in_chat(remover_id, chat_id):
                raise AccessDeniedError("You are not in this group")
            self.chat_repo.remove_participant(remover_id, chat_id)
            self.chat_repo.session.commit()
            return {"chat_id": chat_id, "user_id": remover_id, "left": True}

        # Удаление другого пользователя
        if not self.chat_repo.is_group_creator(remover_id, chat_id):
            raise AccessDeniedError("Only creator can remove users")

        if not self.chat_repo.user_in_chat(user_id, chat_id):
            raise UserNotFoundError("User not in group")

        self.chat_repo.remove_participant(user_id, chat_id)
        self.chat_repo.session.commit()

        return {"chat_id": chat_id, "user_id": user_id, "left": False}

    def get_group_info(self, chat_id: str, user_id: Optional[int] = None) -> Optional[Dict]:
        chat = self.chat_repo.get_by_id(chat_id)
        if not chat or chat.type != 'group':
            return None

        if user_id is not None and not self.chat_repo.user_in_chat(user_id, chat_id):
            return None

        participants = self.chat_repo.get_participants(chat_id)
        members = [{'id': u.id, 'username': u.username, 'is_creator': (u.id == chat.created_by)} for u in participants]

        return {
            'id': chat.id,
            'name': chat.name,
            'type': chat.type,
            'description': chat.description,
            'created_by': chat.created_by,
            'member_count': len(members),
            'members': members
        }

    def create_private_chat(self, current_user_id: int, other_username: str) -> Tuple[Dict, Optional[Dict]]:
        other_user = self.user_repo.get_by_username(other_username)
        if not other_user:
            raise UserNotFoundError("User not found")
        if other_user.id == current_user_id:
            raise ValidationError("Cannot create chat with yourself")
        if not other_user.confirmed:
            raise ValidationError("User is not confirmed")

        chat, created = self.chat_repo.get_or_create_private_chat(current_user_id, other_user.id)
        if not chat:
            raise ChatNotFoundError("Failed to create chat")

        self.chat_repo.session.commit()  # коммитим создание

        chat_info = {'id': chat.id, 'name': other_user.username, 'type': 'private'}
        other_dto = {'id': other_user.id, 'username': other_user.username, 'confirmed': other_user.confirmed} if created else None
        return chat_info, other_dto
