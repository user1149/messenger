import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthOverlay: React.FC = () => {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const usernameTrimmed = username.trim();
    const passwordTrimmed = password.trim();

    if (!usernameTrimmed || !passwordTrimmed) {
      setError('Заполните все поля');
      return;
    }

    if (!isLoginMode) {
      if (!confirm.trim()) {
        setError('Подтвердите пароль');
        return;
      }
      if (passwordTrimmed !== confirm.trim()) {
        setError('Пароли не совпадают');
        return;
      }
      if (passwordTrimmed.length < 8) {
        setError('Пароль должен быть не менее 8 символов');
        return;
      }
      if (usernameTrimmed.length < 3 || usernameTrimmed.length > 20) {
        setError('Имя пользователя должно быть от 3 до 20 символов');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(usernameTrimmed)) {
        setError('Имя пользователя может содержать только буквы, цифры и подчеркивание');
        return;
      }
    }

    setLoading(true);
    try {
      const success = isLoginMode
        ? await login(usernameTrimmed, passwordTrimmed)
        : await register(usernameTrimmed, passwordTrimmed);

      if (!success) {
        setError(isLoginMode ? 'Неверное имя пользователя или пароль' : 'Ошибка регистрации');
      }
    } catch (err) {
      setError('Произошла ошибка. Попробуйте позже');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    setUsername('');
    setPassword('');
    setConfirm('');
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <h2 className="auth-card-title">{isLoginMode ? 'Добро пожаловать' : 'Создать аккаунт'}</h2>
        <p className="auth-card-subtitle">
          {isLoginMode ? 'Войдите, чтобы продолжить общение' : 'Заполните форму для регистрации'}
        </p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input
              type="text"
              placeholder="Имя пользователя"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={isLoginMode ? 'current-password' : 'new-password'}
            />
          </div>
          {!isLoginMode && (
            <div className="input-group">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                placeholder="Подтвердите пароль"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Загрузка...' : isLoginMode ? 'Войти' : 'Регистрация'}
          </button>
        </form>
        <div className="auth-footer">
          <span>{isLoginMode ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}</span>
          <button type="button" onClick={toggleMode} className="auth-toggle">
            {isLoginMode ? 'Регистрация' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};
