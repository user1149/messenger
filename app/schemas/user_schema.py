"""Schemas для операций с пользователями."""
from marshmallow import Schema, fields, validate, validates, ValidationError as MarshmallowValidationError
from app.schemas.base import BaseSchema
from app.utils.constants import ValidationRules
import re


class UserRegisterSchema(BaseSchema):
    """Schema для регистрации пользователя."""
    username = fields.Str(
        required=True,
        validate=[
            validate.Length(min=ValidationRules.USERNAME_MIN_LEN, max=ValidationRules.USERNAME_MAX_LEN),
            validate.Regexp(r"^[a-zA-Z0-9_]+$", error="Username can only contain letters, digits and underscore")
        ]
    )
    email = fields.Email(required=True, validate=validate.Length(max=ValidationRules.EMAIL_MAX_LEN))
    password = fields.Str(required=True, validate=validate.Length(min=ValidationRules.PASSWORD_MIN_LEN))
    
    @validates("password")
    def validate_password(self, value):
        """Проверка сложности пароля."""
        if not any(c.isupper() for c in value):
            raise MarshmallowValidationError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in value):
            raise MarshmallowValidationError("Password must contain at least one digit")
    
    @validates("username")
    def validate_username_reserved(self, value):
        """Проверка зарезервированных имён."""
        if value.lower() in ValidationRules.RESERVED_USERNAMES:
            raise MarshmallowValidationError("This username is reserved")


class UserLoginSchema(BaseSchema):
    """Schema для входа пользователя."""
    login = fields.Str(required=True)
    password = fields.Str(required=True)


class UserResponseSchema(BaseSchema):
    """Schema для ответа с данными пользователя."""
    id = fields.Int(dump_only=True)
    username = fields.Str()
    email = fields.Email()
    confirmed = fields.Bool()
    confirmed_at = fields.DateTime(allow_none=True)


class UserSearchSchema(BaseSchema):
    """Schema для поиска пользователей."""
    id = fields.Int()
    username = fields.Str()
    confirmed = fields.Bool()


class UserSimpleSchema(BaseSchema):
    """Simplified schema для пользователя."""
    id = fields.Int()
    username = fields.Str()


class ConfirmEmailSchema(BaseSchema):
    """Schema для подтверждения email."""
    email = fields.Email(required=True)


class ResendConfirmationSchema(BaseSchema):
    """Schema для переотправки письма подтверждения."""
    email = fields.Email(required=True)
