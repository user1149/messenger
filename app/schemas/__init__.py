"""Schemas для приложения."""
from .user_schema import (
    UserRegisterSchema,
    UserLoginSchema,
    UserResponseSchema,
    UserSearchSchema,
    UserSimpleSchema,
    ConfirmEmailSchema,
    ResendConfirmationSchema
)
from .chat_schema import (
    ChatMessageSchema,
    ChatListItemSchema,
    ChatParticipantSchema,
    CreatePrivateChatSchema,
    CreateGroupSchema,
    GroupInfoSchema,
    AddUserToGroupSchema,
    RemoveUserFromGroupSchema,
    SendMessageSchema,
    EditMessageSchema,
    DeleteMessageSchema,
    MarkReadSchema
)

__all__ = [
    "UserRegisterSchema",
    "UserLoginSchema",
    "UserResponseSchema",
    "UserSearchSchema",
    "UserSimpleSchema",
    "ConfirmEmailSchema",
    "ResendConfirmationSchema",
    "ChatMessageSchema",
    "ChatListItemSchema",
    "ChatParticipantSchema",
    "CreatePrivateChatSchema",
    "CreateGroupSchema",
    "GroupInfoSchema",
    "AddUserToGroupSchema",
    "RemoveUserFromGroupSchema",
    "SendMessageSchema",
    "EditMessageSchema",
    "DeleteMessageSchema",
    "MarkReadSchema"
]
