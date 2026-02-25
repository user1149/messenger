"""Base schema с общей функциональностью."""
from marshmallow import Schema, fields, validate, post_load, pre_load
from app.utils.constants import ValidationRules


class BaseSchema(Schema):
    """Базовая schema с общими методами."""
    
    class Meta:
        strict = True


class TimestampField(fields.DateTime):
    """Custom field для timestamp сериализации."""
    
    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        return value.isoformat()
