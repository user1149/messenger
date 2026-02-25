"""Socket.IO обработчики регистрация (точка входа)."""
from app.socket.events import register_socket_events


def register_socket_handlers(socketio, container):
    """Регистрация всех socket.io обработчиков."""
    register_socket_events(socketio, container)

