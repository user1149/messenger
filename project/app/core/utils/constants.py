class RateLimitAction:
    """Действия для rate limiting."""
    NEW_MESSAGE = "new_message"
    CREATE_PRIVATE_CHAT = "create_private_chat"
    JOIN_CHAT = "join_chat"
    TYPING = "typing"
    MARK_READ = "mark_read"


class ChatType:
    """Типы чатов."""
    PRIVATE = "private"
    GROUP = "group"


class MessageEditWindow:
    """Временное окно для редактирования сообщений."""
    SECONDS = 5 * 60


class SocketEvent:
    """Socket.IO события."""
    NEW_MESSAGE = "new_message"
    MESSAGE_DELETED = "message_deleted"
    MESSAGE_EDITED = "message_edited"
    CHAT_HISTORY = "chat_history"
    CHAT_CREATED = "chat_created"
    TYPING = "typing"
    MARK_READ = "mark_read"
    UNREAD_COUNTS = "unread_counts"
    USER_ONLINE = "user_online"
    USER_OFFLINE = "user_offline"
    CHAT_LIST = "chat_list"
    GROUP_CREATED = "group_created"
    GROUP_INFO = "group_info"
    GROUP_INFO_UPDATED = "group_info_updated"
    ADDED_TO_GROUP = "added_to_group"
    REMOVED_FROM_GROUP = "removed_from_group"
    LEFT_GROUP = "left_group"
    ERROR = "error"


class ValidationRules:
    """Правила валидации."""
    USERNAME_MIN_LEN = 3
    USERNAME_MAX_LEN = 20
    MESSAGE_MAX_LEN = 500
    GROUP_NAME_MAX_LEN = 100
    DESCRIPTION_MAX_LEN = 200
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    RESERVED_USERNAMES = {'admin', 'root', 'system', 'bot', 'support'}
    RESERVED_USERNAMES = {"admin", "root", "system", "support", "test", "api", "administrator"}


class AuditEvent:
    """События аудита."""
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    USER_REGISTERED = "USER_REGISTERED"
    MESSAGE_DELETED = "MESSAGE_DELETED"
    MESSAGE_EDITED = "MESSAGE_EDITED"
