import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { profileAPI } from '../../services/api';
import { showNotification } from '../Common/Notification';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { socket } = useChat();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSave = async () => {
    if (bio.length > 500) {
      setError('Био не может превышать 500 символов');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await profileAPI.update(bio.trim());
      showNotification('Профиль обновлён', false);
      onClose();
    } catch (err) {
      setError('Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Файл слишком большой (макс. 10 MB)', true);
      return;
    }

    if (!file.type.startsWith('image/')) {
      showNotification('Пожалуйста, выберите изображение', true);
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

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return ReactDOM.createPortal(
    <div className="profile-modal" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999 }} onClick={onClose}>
      <div
        className="profile-modal-content"
        ref={modalRef}
        onClick={handleModalClick}
        style={{
          position: 'relative',
          maxWidth: '500px',
          width: '90%',
          margin: 'auto',
          background: 'var(--panel)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div className="profile-modal-header">
          <h3>Мой профиль</h3>
          <button className="profile-modal-close" onClick={onClose} style={{ cursor: 'pointer' }}>×</button>
        </div>

        {error && <div className="error-message" style={{ marginBottom: '16px', padding: '10px' }}>{error}</div>}

        <div className="profile-section avatar-upload-section" style={{ textAlign: 'center' }}>
          <label className="avatar-upload-trigger" style={{ cursor: 'pointer', display: 'inline-block' }}>
            <div className="profile-avatar-large" style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div className="profile-avatar-placeholder" style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', background: 'var(--accent-subtle)' }}>
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              {avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="loader" style={{ width: '30px', height: '30px' }}></div>
                </div>
              )}
              <div className="avatar-edit-overlay" style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <i className="fas fa-camera" style={{ fontSize: '14px' }}></i>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
              disabled={avatarUploading}
            />
          </label>
        </div>

        <div className="profile-section" style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Имя пользователя</label>
          <input type="text" value={user?.username || ''} disabled style={{ width: '100%', padding: '10px', borderRadius: 'var(--r)', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>

        <div className="profile-section" style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>О себе</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 500))}
            rows={4}
            placeholder="Расскажите о себе..."
            maxLength={500}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--r)', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', resize: 'vertical' }}
          />
          <div className="char-count" style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{bio.length}/500</div>
        </div>

        <div className="profile-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1, cursor: 'pointer' }}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1, cursor: 'pointer' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
