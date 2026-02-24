from datetime import datetime
from app.extensions import db

class ChatParticipant(db.Model):
    __tablename__ = 'chat_participant'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chat_id = db.Column(db.String(50), db.ForeignKey('chat.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_chatparticipant_user_id', 'user_id'),
        db.Index('ix_chatparticipant_chat_id', 'chat_id'),
        db.UniqueConstraint('user_id', 'chat_id', name='unique_user_chat'),
    )
