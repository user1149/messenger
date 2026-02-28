// auth.js

class Auth {
    constructor(app) {
        this.app = app;
        this.isSubmitting = false;
        this.isLoginMode = true;
        this.attachListeners();
        setTimeout(() => this.attachListeners(), 100);
    }

    attachListeners() {
        if (this._listenersAttached) return;

        const toggleBtn = document.getElementById('auth-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMode();
            });
        }

        const submitBtn = document.getElementById('auth-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAuth();
            });
        }

        const passwordField = document.getElementById('auth-password');
        if (passwordField) {
            passwordField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAuth();
            });
        }

        // Скрываем ненужные группы
        const emailGroup = document.getElementById('email-group');
        if (emailGroup) emailGroup.classList.add('hidden');
        const usernameGroup = document.getElementById('username-group');
        if (usernameGroup) usernameGroup.classList.add('hidden');

        if (toggleBtn && submitBtn) {
            this._listenersAttached = true;
            console.log('Auth listeners attached');
        }
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;

        const title = document.getElementById('auth-title');
        const subtitle = document.getElementById('auth-subtitle');
        const submitBtn = document.getElementById('auth-submit');
        const toggleBtn = document.getElementById('auth-toggle');
        const confirmGroup = document.getElementById('password-confirm-group');

        if (this.isLoginMode) {
            if (title) title.textContent = 'Вход';
            if (subtitle) subtitle.textContent = 'Введите свои данные';
            if (submitBtn) submitBtn.textContent = 'Войти';
            if (toggleBtn) toggleBtn.textContent = 'Нет аккаунта? Зарегистрироваться';
            if (confirmGroup) confirmGroup.classList.add('hidden');
        } else {
            if (title) title.textContent = 'Регистрация';
            if (subtitle) subtitle.textContent = 'Создайте новый аккаунт';
            if (submitBtn) submitBtn.textContent = 'Зарегистрироваться';
            if (toggleBtn) toggleBtn.textContent = 'Уже есть аккаунт? Войти';
            if (confirmGroup) confirmGroup.classList.remove('hidden');
        }

        this.clearError();
    }

    clearError() {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
    }

    showError(message) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        } else {
            alert(message);
        }
    }

    async handleAuth() {
        if (this.isSubmitting) return;

        const loginField = document.getElementById('auth-login');
        const passwordField = document.getElementById('auth-password');

        const login = loginField?.value.trim();
        const password = passwordField?.value.trim();

        if (!login || !password) {
            this.showError('Заполните все поля');
            return;
        }

        if (this.isLoginMode) {
            await this.performLogin(login, password);
        } else {
            const confirmField = document.getElementById('auth-password-confirm');
            const confirm = confirmField?.value.trim();

            if (!confirm) {
                this.showError('Подтвердите пароль');
                return;
            }
            if (password !== confirm) {
                this.showError('Пароли не совпадают');
                return;
            }
            if (password.length < 8) {
                this.showError('Пароль должен быть не менее 8 символов');
                return;
            }
            await this.performRegister(login, password);
        }
    }

    async performLogin(username, password) {
        this.setSubmitting(true);
        try {
            const csrfToken = document.getElementById('csrf-token').value;
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                this.showError(data.error || 'Ошибка входа');
                return;
            }

            if (this.app && this.app.ui) {
                this.app.currentUserId = data.id;
                this.app.currentUsername = data.username;
                this.completeLogin();
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            this.showError('Ошибка соединения');
            console.error('Login error:', err);
        } finally {
            this.setSubmitting(false);
        }
    }

    async performRegister(username, password) {
        this.setSubmitting(true);
        try {
            const csrfToken = document.getElementById('csrf-token').value;
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                this.showError(data.error || 'Ошибка регистрации');
                return;
            }

            await this.performLogin(username, password);
        } catch (err) {
            this.showError('Ошибка соединения');
            console.error('Register error:', err);
        } finally {
            this.setSubmitting(false);
        }
    }

    setSubmitting(state) {
        this.isSubmitting = state;
        const submitBtn = document.getElementById('auth-submit');
        if (submitBtn) {
            submitBtn.disabled = state;
            submitBtn.textContent = state ? '⏳ Подождите...' : (this.isLoginMode ? 'Войти' : 'Зарегистрироваться');
        }
    }

    completeLogin() {
        const elements = this.app?.ui?.elements;
        if (elements?.authOverlay) elements.authOverlay.classList.add('hidden');
        if (elements?.mainInterface) elements.mainInterface.classList.remove('hidden');
        if (elements?.popupUsername) elements.popupUsername.textContent = this.app.currentUsername;
        if (elements?.inputArea) elements.inputArea.classList.add('hidden');
        if (this.app.socket) this.app.socket.connect();

        this.resetForm();
    }

    resetForm() {
        const loginField = document.getElementById('auth-login');
        const passwordField = document.getElementById('auth-password');
        const confirmField = document.getElementById('auth-password-confirm');

        if (loginField) loginField.value = '';
        if (passwordField) passwordField.value = '';
        if (confirmField) confirmField.value = '';
        this.clearError();
    }

    async tryAutoLogin() {
        try {
            const response = await fetch('/api/me', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (response.ok) {
                const data = await response.json();
                if (this.app) {
                    this.app.currentUserId = data.id;
                    this.app.currentUsername = data.username;

                    if (window.location.pathname === '/login') {
                        window.location.href = '/';
                        return;
                    }

                    const elements = this.app.ui?.elements;
                    if (elements?.loadingScreen) elements.loadingScreen.classList.add('hidden');
                    if (elements?.mainInterface) elements.mainInterface.classList.remove('hidden');
                    if (elements?.popupUsername) elements.popupUsername.textContent = this.app.currentUsername;
                    if (elements?.inputArea) elements.inputArea.classList.add('hidden');
                    if (this.app.socket) this.app.socket.connect();
                } else {
                    window.location.href = '/';
                }
            } else {
                this.showAuthScreen();
            }
        } catch (err) {
            console.error('Auto login error:', err);
            this.showAuthScreen();
        }
    }

    showAuthScreen() {
        if (window.location.pathname === '/login') return;

        const elements = this.app?.ui?.elements;
        if (elements?.loadingScreen) elements.loadingScreen.classList.add('hidden');
        if (elements?.authOverlay) elements.authOverlay.classList.remove('hidden');
        setTimeout(() => {
            const loginField = document.getElementById('auth-login');
            if (loginField) loginField.focus();
        }, 100);
    }

    async logout() {
        try {
            const csrfToken = document.getElementById('csrf-token').value;
            const response = await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                },
            });
            if (response.ok) {
                if (this.app?.socket?.socket) {
                    this.app.socket.manualDisconnect = true;
                    this.app.socket.socket.disconnect();
                }
                if (this.app?.ui?.closeSidebar) {
                    this.app.ui.closeSidebar();
                }
                location.reload();
            } else {
                this.app?.ui?.showNotification('Ошибка при выходе');
            }
        } catch (err) {
            this.app?.ui?.showNotification('Ошибка соединения');
            console.error('Logout error:', err);
        }
    }
}
