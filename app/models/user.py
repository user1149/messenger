from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class User(UserMixin, db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.String(200), nullable=True)

    confirmed = db.Column(db.Boolean, default=False)
    confirmed_at = db.Column(db.DateTime, nullable=True)

    phone_number = db.Column(db.String(32), unique=True, nullable=True)
    phone_verified = db.Column(db.Boolean, default=False)
    phone_verified_at = db.Column(db.DateTime, nullable=True)

    bio = db.Column(db.String(500), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    profile_completed = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    messages = db.relationship('Message', backref='user', cascade='all, delete-orphan', lazy='select')
    chat_participants = db.relationship('ChatParticipant', backref='user', cascade='all, delete-orphan', lazy='select')
    last_reads = db.relationship('LastRead', backref='user', cascade='all, delete-orphan', lazy='select')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
