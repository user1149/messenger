import logging

# Единый модуль логирования для событий приложения (аудит)
audit_logger = logging.getLogger('audit')

def log_message_deleted(user_id: int, message_id: int, chat_id: str, username: str):
    audit_logger.info(f"MESSAGE_DELETED | user_id={user_id} username={username} message_id={message_id} chat_id={chat_id}")


def log_message_edited(user_id: int, message_id: int, chat_id: str, username: str):
    audit_logger.info(f"MESSAGE_EDITED | user_id={user_id} username={username} message_id={message_id} chat_id={chat_id}")


def log_user_login(user_id: int, username: str, ip: str):
    audit_logger.info(f"USER_LOGIN | user_id={user_id} username={username} ip={ip}")


def log_user_logout(user_id: int, username: str):
    audit_logger.info(f"USER_LOGOUT | user_id={user_id} username={username}")


def log_user_registered(user_id: int, username: str, email: str):
    audit_logger.info(f"USER_REGISTERED | user_id={user_id} username={username} email={email}")
