from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=True)

    confirmed = db.Column(db.Boolean, default=False)
    confirmed_at = db.Column(db.DateTime)
    confirmation_token = db.Column(db.String(200), unique=True)
    token_expiration = db.Column(db.DateTime)

    messages = db.relationship('Message', backref='user', cascade='all, delete-orphan', lazy='select')
    chat_participants = db.relationship('ChatParticipant', backref='user', cascade='all, delete-orphan', lazy='select')
    last_reads = db.relationship('LastRead', backref='user', cascade='all, delete-orphan', lazy='select')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    phone_number = db.Column(db.String(20), unique=True, nullable=True)
    phone_verified = db.Column(db.Boolean, default=False)
    phone_verified_at = db.Column(db.DateTime)
    
    profile_completed = db.Column(db.Boolean, default=False)
    bio = db.Column(db.String(500), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
