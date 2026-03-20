from flask import current_app
from flask_socketio import emit
from functools import wraps
import hashlib


def check_rate_limit(username: str, action: str, redis_client) -> bool:
    limit = current_app.config['RATE_LIMITS'].get(action)
    if not limit:
        return False
    username_hash = hashlib.sha256(username.encode()).hexdigest()[:16]
    key = f"rate:{username_hash}:{action}"
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, 1)
    results = pipe.execute()
    current = results[0]
    return current > limit


def rate_limit_socket(action: str):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            from flask_login import current_user
            if check_rate_limit(current_user.username, action, current_app.container.redis_client):
                emit('error', {'message': 'Превышен лимит запросов'})
                return
            return f(*args, **kwargs)
        return wrapped
    return decorator