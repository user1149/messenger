import logging
import os
from logging.handlers import RotatingFileHandler

def init_logging(app):
    if not app.debug and not app.testing:
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = RotatingFileHandler('logs/messenger.log', maxBytes=10240000, backupCount=10)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        
        audit_logger = logging.getLogger('audit')
        audit_handler = RotatingFileHandler('logs/audit.log', maxBytes=10240000, backupCount=10)
        audit_handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
        audit_handler.setLevel(logging.INFO)
        audit_logger.addHandler(audit_handler)
        audit_logger.setLevel(logging.INFO)
    
    app.logger.setLevel(logging.INFO)

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
