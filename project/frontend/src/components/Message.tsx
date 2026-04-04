import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { Message as MessageType } from '../types';
import { formatTime, escapeHtml } from '../services/utils';
import { DeleteConfirmModal, EditMessageModal } from './Modals';

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const { user } = useAuth();
  const { deleteMessage, editMessage } = useChat();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
          <div className="avatar" onClick={handleOpenProfile} style={{ cursor: 'pointer' }}>
            {message.avatar_url ? (
              <img src={message.avatar_url} alt={message.nickname} />
            ) : (
              message.nickname.charAt(0).toUpperCase()
            )}
          </div>
        )}
        <div className="message-content">
          {!isOwn && <div className="message-author">{message.nickname}</div>}
          <div className="message-text">{escapeHtml(message.text)}</div>
          <div className="message-time">{formatTime(message.timestamp)}</div>
        </div>
        {isOwn && (
          <div className="message-actions" ref={menuRef}>
            <button className="action-button" onClick={() => setShowMenu(!showMenu)}>
              <i className="fas fa-ellipsis-v"></i>
            </button>
            {showMenu && (
              <div className="action-menu">
                <button onClick={() => { setShowEditModal(true); setShowMenu(false); }}>
                  <i className="fas fa-edit"></i> Изменить
                </button>
                <button onClick={() => { setShowDeleteModal(true); setShowMenu(false); }}>
                  <i className="fas fa-trash"></i> Удалить
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {showDeleteModal && (
        <DeleteConfirmModal onConfirm={onDeleteConfirm} onCancel={() => setShowDeleteModal(false)} />
      )}
      {showEditModal && (
        <EditMessageModal
          initialText={message.text}
          onConfirm={onEditConfirm}
          onCancel={() => setShowEditModal(false)}
        />
      )}
    </>
  );
};

export default Message;
