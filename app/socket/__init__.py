"""Socket.IO структура приложения и точка входа для регистрации обработчиков."""
from .events import register_socket_events


def register_socket_handlers(socketio, container):
    """Совместимый alias для регистрации обработчиков Socket.IO.

    Оставлен для удобства использования в factory и других местах.
    """
    register_socket_events(socketio, container)


__all__ = ["register_socket_events", "register_socket_handlers"]
