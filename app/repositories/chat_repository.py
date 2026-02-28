from typing import Optional, List, Tuple, Dict
from sqlalchemy import select, case, func
from sqlalchemy.exc import IntegrityError
import uuid
from .base import BaseRepository
from app.models.chat import Chat
from app.models.user import User
from app.models.chat_participant import ChatParticipant
from app.models.private_chat import PrivateChat
from app.models.message import Message

class ChatRepository(BaseRepository):
    def get_by_id(self, chat_id: str) -> Optional[Chat]:
        return self.session.get(Chat, chat_id)

    def get_user_chats_with_last_message(self, user_id: int) -> List[Dict]:
        chat_ids_subq = select(ChatParticipant.chat_id).where(ChatParticipant.user_id == user_id).scalar_subquery()
        chats = self.session.query(Chat).filter(Chat.id.in_(chat_ids_subq)).all()
        if not chats:
            return []
        chat_ids = [c.id for c in chats]

        subq = self.session.query(
            Message.chat_id,
            Message.is_deleted,
            Message.text,
            Message.timestamp,
            func.row_number().over(partition_by=Message.chat_id, order_by=Message.id.desc()).label('rn')
        ).filter(Message.chat_id.in_(chat_ids)).subquery()

        last_msgs = self.session.query(
            subq.c.chat_id,
            case(
                (subq.c.is_deleted == True, 'Сообщение удалено'),
                else_=subq.c.text
            ).label('text'),
            subq.c.timestamp
        ).filter(subq.c.rn == 1).all()

        last_msg_dict = {msg.chat_id: {'text': msg.text, 'timestamp': msg.timestamp.isoformat() if msg.timestamp else ''} for msg in last_msgs}

        other_participants = self.session.query(
            ChatParticipant.chat_id,
            User.username,
            User.id
        ).join(User, User.id == ChatParticipant.user_id).filter(
            ChatParticipant.chat_id.in_(chat_ids),
            ChatParticipant.user_id != user_id
        ).all()

        other_dict = {}
        for chat_id, username, uid in other_participants:
            if chat_id not in other_dict:
                other_dict[chat_id] = username

        result = []
        for chat in chats:
            if chat.type == 'private':
                name = other_dict.get(chat.id, 'Личный чат')
            else:
                name = chat.name if chat.name else 'Группа'
            result.append({
                'id': chat.id,
                'name': name,
                'type': chat.type,
                'lastMessage': last_msg_dict.get(chat.id, {}).get('text', ''),
                'lastTime': last_msg_dict.get(chat.id, {}).get('timestamp', '')
            })
        return result

    def get_other_participant(self, chat_id: str, user_id: int) -> Optional[User]:
        return self.session.query(User).join(
            ChatParticipant, ChatParticipant.user_id == User.id
        ).filter(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id != user_id
        ).first()

    def get_participants(self, chat_id: str) -> List[User]:
        return self.session.query(User).join(
            ChatParticipant, ChatParticipant.user_id == User.id
        ).filter(ChatParticipant.chat_id == chat_id).all()

    def get_participants_count(self, chat_id: str) -> int:
        return self.session.query(ChatParticipant).filter_by(chat_id=chat_id).count()

    def get_common_users(self, user_id: int, chat_ids: List[str]) -> List[User]:
        if not chat_ids:
            return []
        return self.session.query(User).join(
            ChatParticipant, ChatParticipant.user_id == User.id
        ).filter(
            ChatParticipant.chat_id.in_(chat_ids),
            User.id != user_id
        ).distinct().all()

    def add_participant(self, user_id: int, chat_id: str):
        try:
            participant = ChatParticipant(user_id=user_id, chat_id=chat_id)
            self.session.add(participant)
            self.session.flush()
        except IntegrityError:
            self.session.rollback()
            # Если участник уже добавлен, считаем операцию успешной
            return

    def remove_participant(self, user_id: int, chat_id: str):
        self.session.query(ChatParticipant).filter_by(
            user_id=user_id, chat_id=chat_id
        ).delete()

    def create_group(self, name: str, creator_id: int, description: str = None) -> Chat:
        chat_id = str(uuid.uuid4())
        chat = Chat(
            id=chat_id,
            name=name,
            type='group',
            created_by=creator_id,
            description=description
        )
        self.session.add(chat)
        self.session.flush()
        participant = ChatParticipant(user_id=creator_id, chat_id=chat_id)
        self.session.add(participant)
        return chat

    def user_in_chat(self, user_id: int, chat_id: str) -> bool:
        return self.session.query(ChatParticipant).filter_by(
            user_id=user_id, chat_id=chat_id
        ).first() is not None

    def get_user_chat_ids(self, user_id: int) -> List[str]:
        rows = self.session.query(ChatParticipant.chat_id).filter_by(user_id=user_id).all()
        return [r.chat_id for r in rows]

    def is_group_creator(self, user_id: int, chat_id: str) -> bool:
        chat = self.get_by_id(chat_id)
        return chat and chat.type == 'group' and chat.created_by == user_id

    def get_or_create_private_chat(self, user1_id: int, user2_id: int) -> Tuple[Optional[Chat], bool]:
        u1, u2 = sorted([user1_id, user2_id])
        max_retries = 3
        for attempt in range(max_retries):
            try:
                private = self.session.query(PrivateChat).filter_by(user1_id=u1, user2_id=u2).first()
                if private and private.chat_id:
                    chat = self.get_by_id(private.chat_id)
                    if chat:
                        return chat, False

                chat_id = str(uuid.uuid4())
                chat = Chat(id=chat_id, type='private')
                self.session.add(chat)
                self.session.flush()

                private = PrivateChat(user1_id=u1, user2_id=u2, chat_id=chat_id)
                self.session.add(private)
                self.session.flush()

                self.session.add_all([
                    ChatParticipant(user_id=u1, chat_id=chat_id),
                    ChatParticipant(user_id=u2, chat_id=chat_id)
                ])
                self.session.commit()
                return chat, True

            except IntegrityError:
                self.session.rollback()
                if attempt == max_retries - 1:
                    raise
                continue
