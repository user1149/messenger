// auth.js
class Auth {
    constructor(app) {
        this.app = app;
        this.isLoginMode = true;
        this.isSubmitting = false;
        this.attachValidationListeners();
    }

    attachValidationListeners() {
        const elements = this.app.ui.elements;
        elements.authLogin?.addEventListener('input', () => this.clearFieldError());
        elements.authPassword.addEventListener('input', () => this.clearFieldError());
        if (elements.authUsername) {
            elements.authUsername.addEventListener('input', () => this.clearFieldError());
        }
        if (elements.authPasswordConfirm) {
            elements.authPasswordConfirm.addEventListener('input', () => this.clearFieldError());
        }
    }

    clearFieldError() {
        this.hideError();
    }

    hideError() {
        const errorEl = this.app.ui.elements.authError;
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    showError(message) {
        const errorEl = this.app.ui.elements.authError;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    validateField(field, value) {
        if (field === 'login') {
            return !value ? 'Поле не может быть пусто' : null;
        }
        if (field === 'password') {
            return !value ? 'Поле не может быть пусто' : null;
        }
        if (field === 'username') {
            return !value ? 'Поле не может быть пусто' : null;
        }
        if (field === 'email') {
            if (!value) return 'Поле не может быть пусто';
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return !emailRegex.test(value) ? 'Неверный формат email' : null;
        }
        if (field === 'password_confirm') {
            const password = this.app.ui.elements.authPassword.value;
            return value !== password ? 'Пароли не совпадают' : null;
        }
        return null;
    }

    validateAll() {
        const elements = this.app.ui.elements;
        if (this.isLoginMode) {
            const login = elements.authLogin.value.trim();
            const password = elements.authPassword.value;
            let error = this.validateField('login', login) || this.validateField('password', password);
            if (error) {
                this.showError(error);
                return false;
            }
        } else {
            const email = elements.authEmail.value.trim();
            const username = elements.authUsername.value.trim();
            const password = elements.authPassword.value;
            const passwordConfirm = elements.authPasswordConfirm.value;
            
            let error = this.validateField('email', email) || 
                       this.validateField('username', username) ||
                       this.validateField('password', password) ||
                       this.validateField('password_confirm', passwordConfirm);
            if (error) {
                this.showError(error);
                return false;
            }
        }
        this.hideError();
        return true;
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        const elements = this.app.ui.elements;
        elements.authTitle.textContent = this.isLoginMode ? 'Вход' : 'Регистрация';
        elements.authSubmit.textContent = this.isLoginMode ? 'Войти' : 'Зарегистрироваться';
        elements.authToggle.textContent = this.isLoginMode
            ? 'Нет аккаунта? Зарегистрироваться'
            : 'Уже есть аккаунт? Войти';
        this.hideError();

        const loginGroup = document.getElementById('login-group');
        const emailGroup = document.getElementById('email-group');
        const usernameGroup = document.getElementById('username-group');
        const passwordConfirmGroup = document.getElementById('password-confirm-group');

        if (loginGroup) loginGroup.classList.toggle('hidden', !this.isLoginMode);
        if (emailGroup) emailGroup.classList.toggle('hidden', this.isLoginMode);
        if (usernameGroup) usernameGroup.classList.toggle('hidden', this.isLoginMode);
        if (passwordConfirmGroup) passwordConfirmGroup.classList.toggle('hidden', this.isLoginMode);

        if (elements.authLogin) elements.authLogin.value = '';
        if (elements.authEmail) elements.authEmail.value = '';
        if (elements.authUsername) elements.authUsername.value = '';
        elements.authPassword.value = '';
        if (elements.authPasswordConfirm) elements.authPasswordConfirm.value = '';

        setTimeout(() => {
            if (this.isLoginMode && elements.authLogin) {
                elements.authLogin.focus();
            } else if (!this.isLoginMode && elements.authEmail) {
                elements.authEmail.focus();
            }
        }, 100);
    }

    async handleAuth() {
        if (this.isSubmitting) return;
        if (!this.validateAll()) return;

        this.isSubmitting = true;
        const elements = this.app.ui.elements;
        const submitBtn = elements.authSubmit;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Отправка...';
        submitBtn.disabled = true;

        let body;
        if (this.isLoginMode) {
            const login = elements.authLogin.value.trim();
            const password = elements.authPassword.value.trim();
            body = JSON.stringify({ login, password });
        } else {
            const email = elements.authEmail.value.trim().toLowerCase();
            const username = elements.authUsername.value.trim();
            const password = elements.authPassword.value.trim();
            body = JSON.stringify({ email, username, password });
        }

        const url = this.isLoginMode ? '/login' : '/register';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body,
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                if (data.not_confirmed) {
                    const email = data.email || (this.isLoginMode ? elements.authLogin.value.trim() : '');
                    elements.authError.innerHTML = `${data.error} <a href="#" id="resend-link" data-email="${email}">Отправить повторно</a>`;
                    elements.authError.classList.remove('hidden');
                    document.getElementById('resend-link').addEventListener('click', (e) => {
                        e.preventDefault();
                        this.resendConfirmation(email);
                    });
                } else {
                    this.showError(data.error || 'Ошибка сервера');
                }
                return;
            }

            if (this.isLoginMode) {
                this.app.currentUserId = data.id;
                this.app.currentUsername = data.username;
                elements.authOverlay.classList.add('hidden');
                elements.mainInterface.classList.remove('hidden');
                elements.popupUsername.textContent = this.app.currentUsername;
                elements.inputArea.classList.add('hidden');
                this.app.socket.connect();
            } else {
                elements.authEmail.value = '';
                elements.authUsername.value = '';
                elements.authPassword.value = '';
                if (elements.authPasswordConfirm) elements.authPasswordConfirm.value = '';
                this.isLoginMode = true;
                elements.authTitle.textContent = 'Вход';
                elements.authSubmit.textContent = 'Войти';
                elements.authToggle.textContent = 'Нет аккаунта? Зарегистрироваться';
                this.app.ui.showNotification(data.message || 'Проверьте почту для подтверждения', false);
                document.getElementById('login-group').classList.remove('hidden');
                document.getElementById('email-group').classList.add('hidden');
                document.getElementById('username-group').classList.add('hidden');
                document.getElementById('password-confirm-group').classList.add('hidden');
            }
        } catch (err) {
            this.showError('Ошибка соединения');
        } finally {
            this.isSubmitting = false;
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async resendConfirmation(email) {
        try {
            const response = await fetch('/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            this.app.ui.showNotification(data.message, !response.ok);
        } catch {
            this.app.ui.showNotification('Ошибка соединения', true);
        }
    }

    async tryAutoLogin() {
        try {
            const response = await fetch('/api/me', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (response.ok) {
                const data = await response.json();
                this.app.currentUserId = data.id;
                this.app.currentUsername = data.username;
                this.app.ui.elements.loadingScreen.classList.add('hidden');
                this.app.ui.elements.mainInterface.classList.remove('hidden');
                this.app.ui.elements.popupUsername.textContent = this.app.currentUsername;
                this.app.ui.elements.inputArea.classList.add('hidden');
                this.app.socket.connect();
            } else {
                this.showAuthScreen();
            }
        } catch {
            this.showAuthScreen();
        }
    }

    showAuthScreen() {
        this.app.ui.elements.loadingScreen.classList.add('hidden');
        this.app.ui.elements.authOverlay.classList.remove('hidden');
    }

    async logout() {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (response.ok) {
                if (this.app.socket.socket) this.app.socket.socket.disconnect();
                this.app.ui.closeSidebar();
                location.reload();
            } else {
                this.app.ui.showNotification('Ошибка при выходе');
            }
        } catch {
            this.app.ui.showNotification('Ошибка соединения');
        }
    }
}
