from flask import current_app
from flask_socketio import emit
from functools import wraps

def check_rate_limit(username: str, action: str, redis_client) -> bool:
    limit = current_app.config['RATE_LIMITS'].get(action)
    if not limit:
        return False
    key = f"rate:{username}:{action}"
    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, 1)
    return current > limit

def rate_limit_socket(action: str):
    def decorator(f):
        @wraps(f)
        def wrapped(data=None):
            from flask_login import current_user
            if check_rate_limit(current_user.username, action, current_app.container.redis_client):
                emit('error', {'message': 'Превышен лимит запросов'})
                return
            return f(data)
        return wrapped
    return decorator
