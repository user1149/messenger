import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { profileAPI, usersAPI } from '../services/api';
import { debounce, escapeHtml } from '../services/utils';
import { showNotification } from './Common';

// Delete Confirm Modal
export const DeleteConfirmModal: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Удалить сообщение?</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p>Это действие нельзя отменить.</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={onConfirm}>
            Удалить
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Edit Message Modal
export const EditMessageModal: React.FC<{ initialText: string; onConfirm: (text: string) => void; onCancel: () => void }> = ({ initialText, onConfirm, onCancel }) => {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onConfirm(text.trim());
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Редактировать сообщение</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            maxLength={500}
            className="edit-input"
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onConfirm(text.trim())}>
            Сохранить
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Profile Modal
export const ProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { socket } = useChat();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await profileAPI.get();
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || null);
      } catch (err) {
        setError('Ошибка загрузки профиля');
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = async () => {
    if (bio.length > 500) {
      setError('Био слишком длинное');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await profileAPI.update(bio.trim());
      showNotification('Профиль обновлён', false);
      onClose();
    } catch (err) {
      setError('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Файл слишком большой', true);
      return;
    }

    if (!file.type.startsWith('image/')) {
      showNotification('Пожалуйста выберите изображение', true);
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);

    try {
      const response = await profileAPI.uploadAvatar(file);
      setAvatarUrl(response.avatar_url);
      showNotification('Аватар обновлён', false);
      socket?.emitChat('get_chat_list', {});
    } catch (err) {
      showNotification('Ошибка загрузки аватара', true);
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Мой профиль</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="modal-body">
          <div className="profile-section avatar-upload">
            <label htmlFor="avatar-upload" className="avatar-upload-trigger">
              <div className="profile-avatar-large">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" />
                ) : (
                  <div className="avatar-placeholder">{user?.username?.charAt(0).toUpperCase()}</div>
                )}
                {avatarUploading && (
                  <div className="avatar-overlay">
                    <div className="loader"></div>
                  </div>
                )}
              </div>
              <input id="avatar-upload" type="file" onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />
            </label>
          </div>
          <div className="profile-section">
            <label>О себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              className="profile-textarea"
              placeholder="Расскажите о себе..."
            />
            <small>{bio.length}/500</small>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// User Profile Modal
export const UserProfileModal: React.FC<{ userId: number; onClose: () => void }> = ({ userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    usersAPI.getProfile(userId)
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Ошибка загрузки профиля');
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Профиль пользователя</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loader" style={{ margin: '20px auto' }}></div>}
        {profile && (
          <div className="modal-body">
            <div className="profile-section">
              <div className="profile-avatar-large">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" />
                ) : (
                  <div className="avatar-placeholder">{profile.username.charAt(0).toUpperCase()}</div>
                )}
              </div>
            </div>
            <div className="profile-section">
              <label>Имя</label>
              <div className="field">{escapeHtml(profile.username)}</div>
            </div>
            <div className="profile-section">
              <label>О себе</label>
              <div className="field">{profile.bio ? escapeHtml(profile.bio) : 'Ничего не добавлено'}</div>
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Create Group Modal
export const CreateGroupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
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

  const handleCreate = () => {
    if (!name.trim()) {
      showNotification('Введите название', true);
      return;
    }
    if (selectedUsers.size < 1) {
      showNotification('Выберите участников', true);
      return;
    }
    const memberIds = Array.from(selectedUsers.keys());
    createGroup(name.trim(), description.trim(), memberIds);
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Создать группу</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {step === 1 ? (
            <>
              <div className="form-group">
                <label>Поиск участников</label>
                <div ref={searchRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Найти пользователя..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {showResults && (
                    <div className="search-results show">
                      {searchResults.length === 0 ? (
                        <div className="empty-message">Не найдено</div>
                      ) : (
                        searchResults.map(user => (
                          <div
                            key={user.id}
                            className="result-item"
                            onClick={() => {
                              setSelectedUsers(prev => new Map(prev).set(user.id, user));
                              setSearchQuery('');
                              setShowResults(false);
                            }}
                          >
                            <span>{user.username}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedUsers.size > 0 && (
                <div className="selected-users">
                  {Array.from(selectedUsers.values()).map(user => (
                    <div key={user.id} className="user-badge">
                      {user.username}
                      <button onClick={() => {
                        const newMap = new Map(selectedUsers);
                        newMap.delete(user.id);
                        setSelectedUsers(newMap);
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Название группы</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Введите название..."
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label>Описание (опционально)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Описание группы..."
                  maxLength={300}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-actions">
          {step === 2 && (
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Назад
            </button>
          )}
          {step === 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={selectedUsers.size === 0}>
              Далее
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreate}>
              Создать
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Group Info Modal
export const GroupInfoModal: React.FC<{ groupInfo: any; onClose: () => void }> = ({ groupInfo, onClose }) => {
  const { addUserToGroup, removeUserFromGroup, leaveGroup } = useChat();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; username: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const [members, setMembers] = useState(groupInfo.members);

  const isCreator = groupInfo.created_by === user?.id;

  const performSearch = debounce(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    try {
      const users = await usersAPI.search(q);
      const existingIds = new Set(members.map((m: any) => m.id));
      const filtered = users.filter((u: any) => !existingIds.has(u.id));
      setSearchResults(filtered);
      setShowResults(true);
    } catch (err) {
      showNotification('Ошибка поиска', true);
    }
  }, 300);

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAddUser = (useId: number) => {
    addUserToGroup(groupInfo.id, useId);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleRemoveUser = (userId: number) => {
    if (window.confirm('Удалить участника?')) {
      removeUserFromGroup(groupInfo.id, userId);
      setMembers(members.filter((m: any) => m.id !== userId));
    }
  };

  const handleLeave = () => {
    if (isCreator) {
      if (window.confirm('Вы создатель. Это удалит группу. Продолжить?')) {
        leaveGroup(groupInfo.id);
        onClose();
      }
    } else {
      if (window.confirm('Покинуть группу?')) {
        leaveGroup(groupInfo.id);
        onClose();
      }
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{escapeHtml(groupInfo.name)}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {groupInfo.description && (
            <div className="form-group">
              <label>Описание</label>
              <p>{escapeHtml(groupInfo.description)}</p>
            </div>
          )}
          {isCreator && (
            <div className="form-group">
              <label>Добавить участников</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Поиск пользователя..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {showResults && (
                  <div className="search-results show">
                    {searchResults.map(user => (
                      <div key={user.id} className="result-item" onClick={() => handleAddUser(user.id)}>
                        {user.username}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Участники ({members.length})</label>
            <div className="members-list">
              {members.map((m: any) => (
                <div key={m.id} className="member-item">
                  <span>{escapeHtml(m.username)}</span>
                  {m.is_creator && <span className="badge">Создатель</span>}
                  {isCreator && !m.is_creator && (
                    <button onClick={() => handleRemoveUser(m.id)} className="btn-sm btn-danger">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={handleLeave}>
            {isCreator ? 'Удалить группу' : 'Покинуть'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
