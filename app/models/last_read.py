from datetime import datetime
from app.extensions import db

class LastRead(db.Model):
    __tablename__ = 'last_read'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chat_id = db.Column(db.String(50), db.ForeignKey('chat.id'), nullable=False)
    last_message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=True)
    last_read_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'chat_id', name='unique_user_chat'),
        db.Index('ix_lastread_user_id', 'user_id'),
        db.Index('ix_lastread_chat_id', 'chat_id'),
    )
