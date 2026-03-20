from marshmallow import fields

from app.core.base.schema import BaseSchema


class UserResponseSchema(BaseSchema):
    id = fields.Int(dump_only=True)
    username = fields.Str()
    bio = fields.Str(allow_none=True)
    avatar_url = fields.Str(allow_none=True)
    profile_completed = fields.Bool()


class UserSearchSchema(BaseSchema):
    id = fields.Int()
    username = fields.Str()


class UserSimpleSchema(BaseSchema):
    id = fields.Int()
    username = fields.Str()