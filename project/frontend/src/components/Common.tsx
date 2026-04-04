import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { showNotification as sendNotification } from './Notification';

// Loader Component
export const Loader: React.FC = () => (
  <div className="loading-screen">
    <div className="loader"></div>
    <p>Загрузка...</p>
  </div>
);

// Notification Component
export const Notification: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(true);

  useEffect(() => {
    const handleNotify = (event: CustomEvent<{ message: string; isError: boolean }>) => {
      setMessage(event.detail.message);
      setIsError(event.detail.isError);
      setTimeout(() => setMessage(null), 3000);
    };
    window.addEventListener('notify', handleNotify as EventListener);
    return () => window.removeEventListener('notify', handleNotify as EventListener);
  }, []);

  if (!message) return null;
  return (
    <div className={`notification show ${isError ? 'error' : 'success'}`}>
      {message}
    </div>
  );
};

// User Menu Component
export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { socket } = useChat();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    if (socket) socket.disconnect();
    await logout();
    sendNotification('Вы вышли из системы', false);
  };

  const openProfile = () => {
    setOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openProfileModal'));
    }, 50);
  };

  const openCreateGroup = () => {
    setOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openCreateGroupModal'));
    }, 50);
  };

  return (
    <div className="user-menu-wrapper" ref={menuRef}>
      <button className="user-menu-button" onClick={() => setOpen(!open)}>
        <i className="fas fa-ellipsis-v"></i>
      </button>
      {open && (
        <div className="user-popup">
          <div className="popup-header">
            <div className="popup-username">{user?.username}</div>
          </div>
          <div className="popup-divider"></div>
          <button className="popup-item" onClick={openProfile}>
            <i className="fas fa-user"></i> Профиль
          </button>
          <button className="popup-item" onClick={openCreateGroup}>
            <i className="fas fa-users"></i> Создать группу
          </button>
          <div className="popup-divider"></div>
          <button className="popup-item logout" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i> Выйти
          </button>
          <div className="popup-footer">
            <div className="popup-version">v1.0</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export notification function separately
export const showNotification = (message: string, isError = true) => {
  window.dispatchEvent(new CustomEvent('notify', { detail: { message, isError } }));
};
