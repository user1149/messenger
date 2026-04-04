import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { Message as MessageType } from '../../types';
import { formatTime, escapeHtml } from '../../services/utils';
import { DeleteConfirmModal, EditMessageModal } from '../Modals';

interface MessageProps {
  message: MessageType;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const { user } = useAuth();
  const { deleteMessage, editMessage } = useChat();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const isOwn = message.user_id === user?.id;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setShowDeleteModal(true);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const onEditConfirm = (newText: string) => {
    if (newText.trim() && newText !== message.text) {
      editMessage(message.id, newText.trim());
    }
    setShowEditModal(false);
  };

  const onDeleteConfirm = () => {
    deleteMessage(message.id);
    setShowDeleteModal(false);
  };

  const handleOpenProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('openUserProfileModal', { detail: { userId: message.user_id } }));
  };

  return (
    <>
      <div className={`message ${isOwn ? 'own' : 'other'} ${message.is_deleted ? 'deleted' : ''}`}>
        {!isOwn && (
          <div
            className="avatar"
            data-user-id={message.user_id}
            onClick={handleOpenProfile}
            style={{ cursor: 'pointer' }}
          >
            {message.avatar_url ? (
              <img src={message.avatar_url} alt={message.nickname} />
            ) : (
              message.nickname.charAt(0).toUpperCase()
            )}
          </div>
        )}
        <div className="message-content">
          {!isOwn && (
            <div className="message-nickname">
              <span
                className="clickable-nickname"
                data-user-id={message.user_id}
                onClick={handleOpenProfile}
                style={{ cursor: 'pointer' }}
              >
                {escapeHtml(message.nickname)}
              </span>
            </div>
          )}
          <div className="bubble">
            <div className="message-row">
              <span className="message-text">
                {message.is_deleted
                  ? 'Сообщение удалено'
                  : escapeHtml(message.text)}
                {message.edited && !message.is_deleted && (
                  <span className="edited-indicator"> (ред.)</span>
                )}
              </span>
              <span className="timestamp">{formatTime(message.timestamp)}</span>
            </div>
          </div>
        </div>
        {isOwn && !message.is_deleted && (
          <div
            className="message-actions"
            onClick={toggleMenu}
            ref={buttonRef}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            ⋮
            {showMenu && (
              <div
                className="message-actions-menu show"
                ref={menuRef}
                style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: '4px' }}
              >
                <button onClick={handleEdit} style={{ cursor: 'pointer' }}>
                  ✏️ Редактировать
                </button>
                <button onClick={handleDelete} className="delete-message" style={{ cursor: 'pointer' }}>
                  🗑️ Удалить
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={onDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
      {showEditModal && (
        <EditMessageModal
          currentText={message.text}
          onConfirm={onEditConfirm}
          onCancel={() => setShowEditModal(false)}
        />
      )}
    </>
  );
};
