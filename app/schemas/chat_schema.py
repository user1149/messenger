"""Schemas для операций с чатами."""
from marshmallow import fields, validate, validates, ValidationError as MarshmallowValidationError
from app.schemas.base import BaseSchema, TimestampField
from app.utils.constants import ValidationRules


class ChatMessageSchema(BaseSchema):
    """Schema для сообщения в чате."""
    id = fields.Int(dump_only=True)
    chat_id = fields.Str()
    user_id = fields.Int()
    nickname = fields.Str()
    text = fields.Str()
    timestamp = TimestampField()
    edited = fields.Bool()
    edited_at = TimestampField(allow_none=True)
    is_deleted = fields.Bool()


class ChatListItemSchema(BaseSchema):
    """Schema для элемента в списке чатов."""
    id = fields.Str()
    name = fields.Str()
    type = fields.Str()
    lastMessage = fields.Str(allow_none=True)
    lastTime = fields.Str(allow_none=True)


class ChatParticipantSchema(BaseSchema):
    """Schema для участника чата."""
    id = fields.Int()
    username = fields.Str()
    is_creator = fields.Bool()


class CreatePrivateChatSchema(BaseSchema):
    """Schema для создания приватного чата."""
    username = fields.Str(required=True, validate=validate.Length(min=1))


class CreateGroupSchema(BaseSchema):
    """Schema для создания группы."""
    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=ValidationRules.GROUP_NAME_MAX_LEN)
    )
    description = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.Length(max=ValidationRules.DESCRIPTION_MAX_LEN)
    )
    member_ids = fields.List(fields.Int(), required=True)
    
    @validates("member_ids")
    def validate_member_ids(self, value):
        """Проверка списка участников."""
        if not value or len(value) < 2:
            raise MarshmallowValidationError("Group must have at least 2 members")


class GroupInfoSchema(BaseSchema):
    """Schema информации о группе."""
    id = fields.Str(dump_only=True)
    name = fields.Str()
    type = fields.Str()
    description = fields.Str(allow_none=True)
    created_by = fields.Int()
    member_count = fields.Int()
    members = fields.List(fields.Nested(ChatParticipantSchema))


class AddUserToGroupSchema(BaseSchema):
    """Schema для добавления пользователя в группу."""
    chat_id = fields.Str(required=True)
    user_id = fields.Int(required=True)


class RemoveUserFromGroupSchema(BaseSchema):
    """Schema для удаления пользователя из группы."""
    chat_id = fields.Str(required=True)
    user_id = fields.Int(required=True)


class SendMessageSchema(BaseSchema):
    """Schema для отправки сообщения."""
    chat_id = fields.Str(required=True)
    text = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=ValidationRules.MESSAGE_MAX_LEN)
    )


class EditMessageSchema(BaseSchema):
    """Schema для редактирования сообщения."""
    message_id = fields.Int(required=True)
    chat_id = fields.Str(required=True)
    text = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=ValidationRules.MESSAGE_MAX_LEN)
    )


class DeleteMessageSchema(BaseSchema):
    """Schema для удаления сообщения."""
    message_id = fields.Int(required=True)
    chat_id = fields.Str(required=True)


class MarkReadSchema(BaseSchema):
    """Schema для отметки чата как прочитанного."""
    chat_id = fields.Str(required=True)
