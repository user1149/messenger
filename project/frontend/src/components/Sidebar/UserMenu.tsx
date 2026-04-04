import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { showNotification } from '../Common/Notification';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { socket } = useChat();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    showNotification('Вы вышли из системы', false);
  };

  const openProfile = () => {
    setOpen(false);
    // Используем setTimeout чтобы дать время закрыть меню перед открытием модалки
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

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  return (
    <div className="user-menu-wrapper" ref={menuRef} style={{ position: 'relative' }}>
      <button
        className="user-menu-button"
        onClick={toggleMenu}
        ref={buttonRef}
        style={{ cursor: 'pointer', zIndex: 100 }}
      >
        <i className="fas fa-ellipsis-v"></i>
      </button>
      <div className={`user-popup ${open ? '' : 'hidden'}`} style={{ zIndex: 1000 }}>
        <div className="popup-header">
          <div className="popup-username">{user?.username}</div>
        </div>
        <div className="popup-divider"></div>
        <button
          className="popup-item"
          onClick={openProfile}
          style={{ cursor: 'pointer', width: '100%' }}
        >
          <i className="fas fa-user"></i> Профиль
        </button>
        <button
          className="popup-item"
          onClick={openCreateGroup}
          style={{ cursor: 'pointer', width: '100%' }}
        >
          <i className="fas fa-users"></i> Создать группу
        </button>
        <div className="popup-divider"></div>
        <button
          className="popup-item logout"
          onClick={handleLogout}
          style={{ cursor: 'pointer', width: '100%' }}
        >
          <i className="fas fa-sign-out-alt"></i> Выйти
        </button>
        <div className="popup-footer">
          <div className="popup-version">v1.0</div>
        </div>
      </div>
    </div>
  );
};
