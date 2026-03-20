from marshmallow import Schema, fields


class BaseSchema(Schema):
    pass


class TimestampField(fields.DateTime):
    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        return value.isoformat()