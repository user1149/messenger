from datetime import datetime
from app.extensions import db

class Message(db.Model):
    __tablename__ = 'message'
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.String(50), db.ForeignKey('chat.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index('ix_message_chat_id', 'chat_id'),
        db.Index('ix_message_user_id', 'user_id'),
        db.Index('ix_message_timestamp', 'timestamp'),
        db.Index('ix_message_is_deleted', 'is_deleted'),
    )
