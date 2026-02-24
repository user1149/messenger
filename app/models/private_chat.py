from app.extensions import db

class PrivateChat(db.Model):
    __tablename__ = 'private_chat'
    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user2_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chat_id = db.Column(db.String(50), db.ForeignKey('chat.id'), nullable=True)
    __table_args__ = (
        db.UniqueConstraint('user1_id', 'user2_id', name='unique_private_chat_pair'),
        db.Index('ix_privatechat_user1_id', 'user1_id'),
        db.Index('ix_privatechat_user2_id', 'user2_id'),
    )
