import uuid
from datetime import datetime, timezone


def is_valid_uuid(val):
    try:
        uuid.UUID(val)
        return True
    except ValueError:
        return False


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)