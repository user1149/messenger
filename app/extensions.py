from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO
from flask_mail import Mail
from flask_wtf.csrf import CSRFProtect
from sqlalchemy.orm import scoped_session

db = SQLAlchemy()
login_manager = LoginManager()
socketio = SocketIO()
mail = Mail()
csrf = CSRFProtect()
