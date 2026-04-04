import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import { usersAPI } from '../../services/api';
import { debounce, escapeHtml } from '../../services/utils';
import { showNotification } from '../Common/Notification';

interface CreateGroupModalProps {
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose }) => {
  const { createGroup } = useChat();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Map<number, { id: number; username: string }>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; username: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const performSearch = debounce(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    try {
      const users = await usersAPI.search(q);
      const filtered = users.filter((u: any) => !selectedUsers.has(u.id));
      setSearchResults(filtered);
      setShowResults(true);
    } catch (err) {
      console.error(err);
      showNotification('Ошибка поиска', true);
    }
  }, 300);

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutsideModal = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutsideModal);
    return () => document.removeEventListener('mousedown', handleClickOutsideModal);
  }, [onClose]);

  const addUser = (user: { id: number; username: string }) => {
    if (selectedUsers.size >= 50) {
      showNotification('Группа не может содержать более 50 участников', true);
      return;
    }
    setSelectedUsers(prev => new Map(prev).set(user.id, user));
    setSearchQuery('');
    setShowResults(false);
  };

  const removeUser = (id: number) => {
    setSelectedUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  const handleCreate = () => {
    if (!name.trim()) {
      showNotification('Введите название группы', true);
      return;
    }
    if (name.trim().length > 100) {
      showNotification('Название группы не должно превышать 100 символов', true);
      return;
    }
    if (description.length > 300) {
      showNotification('Описание не должно превышать 300 символов', true);
      return;
    }
    if (selectedUsers.size < 1) {
      showNotification('Выберите хотя бы одного участника', true);
      return;
    }

    const memberIds = Array.from(selectedUsers.keys());
    createGroup(name.trim(), description.trim(), memberIds);
    onClose();
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return ReactDOM.createPortal(
    <div className="modal" style={{ display: 'block', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="modal-content"
        ref={modalRef}
        onClick={handleModalClick}
        style={{
          position: 'relative',
          maxWidth: '500px',
          width: '90%',
          margin: 'auto',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--panel)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px'
        }}
      >
        <span className="close" onClick={onClose} style={{ position: 'absolute', right: '20px', top: '20px', cursor: 'pointer', fontSize: '24px' }}>×</span>
        <h3 style={{ marginBottom: '20px' }}>Создать группу</h3>

        <div className="step-indicator" style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div className={`step ${step === 1 ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 'var(--r)', background: step === 1 ? 'var(--accent-subtle)' : 'transparent', color: step === 1 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
            1. Участники
          </div>
          <div className={`step ${step === 2 ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 'var(--r)', background: step === 2 ? 'var(--accent-subtle)' : 'transparent', color: step === 2 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
            2. Информация
          </div>
        </div>

        {step === 1 && (
          <div className="step-content">
            <div className="user-search-area" ref={searchRef} style={{ position: 'relative', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)' }}
              />
              {showResults && (
                <div className="search-results show" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r)', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                  {searchResults.length === 0 ? (
                    <div className="empty-message" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Пользователи не найдены</div>
                  ) : (
                    searchResults.map(user => (
                      <div
                        key={user.id}
                        className="result-item"
                        onClick={() => addUser(user)}
                        style={{ padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="avatar" style={{ width: '32px', height: '32px', borderRadius: 'var(--r)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                        <span className="username">{escapeHtml(user.username)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="selected-users" style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-sec)' }}>Участники ({selectedUsers.size}/50)</h4>
              <div className="selected-users-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedUsers.size === 0 && (
                  <div className="empty-state" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card)', borderRadius: 'var(--r)' }}>
                    Добавьте участников через поиск
                  </div>
                )}
                {Array.from(selectedUsers.values()).map(user => (
                  <span key={user.id} className="user-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--accent-subtle)', borderRadius: '20px', fontSize: '0.85rem' }}>
                    <span className="chip-avatar" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px' }}>
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="chip-name">{escapeHtml(user.username)}</span>
                    <i
                      className="fas fa-times"
                      onClick={() => removeUser(user.id)}
                      style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
                    ></i>
                  </span>
                ))}
              </div>
            </div>

            <div className="step-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(2)}
                disabled={selectedUsers.size === 0}
                className="btn-primary"
                style={{ cursor: selectedUsers.size === 0 ? 'not-allowed' : 'pointer', padding: '10px 24px' }}
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Название группы *</label>
              <input
                type="text"
                placeholder="Например: Друзья, Коллеги"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Описание</label>
              <textarea
                placeholder="Расскажите о группе..."
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={300}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', resize: 'vertical' }}
              />
              <div className="char-count" style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{description.length}/300</div>
            </div>

            <div className="step-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ cursor: 'pointer', padding: '10px 20px' }}>
                ← Назад
              </button>
              <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary" style={{ cursor: name.trim() ? 'pointer' : 'not-allowed', padding: '10px 24px' }}>
                Создать группу
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
