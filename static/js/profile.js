// static/js/profile.js
const ProfileManager = class {
    constructor(app) {
        this.app = app;
        this.setupMenuItems();
    }

    setupMenuItems() {
        const profileBtn = document.getElementById('popup-profile');
        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openProfileModal();
            });
        }
        const createGroupBtn = document.getElementById('popup-create-group');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('user-popup')?.classList.add('hidden');
                if (this.app && this.app.chat) {
                    this.app.chat.showCreateGroupDialog?.();
                }
            });
        }
        const logoutBtn = document.getElementById('popup-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.app && this.app.auth) {
                    this.app.auth.logout();
                }
            });
        }
    }

    async openProfileModal(userId = null) {
        const userPopup = document.getElementById('user-popup');
        if (userPopup) userPopup.classList.add('hidden');
        const isOwn = !userId || userId === this.app.currentUserId;
        const targetId = userId || this.app.currentUserId;
        if (!isOwn) {
            this.openUserProfileModal(targetId);
            return;
        }
        let profileModal = document.getElementById('profile-modal');
        if (!profileModal) {
            this.createProfileModal();
            profileModal = document.getElementById('profile-modal');
        }
        if (profileModal) {
            profileModal.classList.remove('hidden');
            await this.loadProfileData(targetId, isOwn);
        }
    }

    async openUserProfileModal(userId) {
        const oldModal = document.getElementById('user-profile-view-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'user-profile-view-modal';
        modal.className = 'profile-modal';
        modal.innerHTML = `
            <div class="profile-modal-content">
                <div class="profile-modal-header">
                    <h3>Профиль пользователя</h3>
                    <button class="profile-modal-close" id="user-profile-close">✕</button>
                </div>
                <div id="user-profile-error" class="error-message hidden"></div>
                <div class="profile-section" style="text-align: center;">
                    <div id="user-profile-avatar" class="profile-avatar-large"></div>
                </div>
                <div class="profile-section">
                    <label>Имя пользователя</label>
                    <div id="user-profile-username" class="profile-field"></div>
                </div>
                <div class="profile-section">
                    <label>О себе</label>
                    <div id="user-profile-bio" class="profile-field"></div>
                </div>
                <div class="profile-actions">
                    <button id="user-profile-close-btn" class="btn-secondary">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const closeModal = () => {
            modal.style.display = 'none';
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        };
        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        document.getElementById('user-profile-close').addEventListener('click', closeModal);
        document.getElementById('user-profile-close-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', escapeHandler);
        modal.style.display = 'flex';
        try {
            const response = await fetch(`/api/users/${userId}/profile`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Ошибка загрузки');
            }
            const data = await response.json();
            document.getElementById('user-profile-username').textContent = data.username || '';
            document.getElementById('user-profile-bio').textContent = data.bio || '—';
            const avatarDiv = document.getElementById('user-profile-avatar');
            if (data.avatar_url) {
                avatarDiv.innerHTML = `<img src="${data.avatar_url}" alt="avatar" class="profile-avatar-img">`;
            } else {
                avatarDiv.innerHTML = `<div class="profile-avatar-placeholder">${data.username.charAt(0).toUpperCase()}</div>`;
            }
        } catch (err) {
            const errorDiv = document.getElementById('user-profile-error');
            errorDiv.textContent = err.message;
            errorDiv.classList.remove('hidden');
        }
    }

    createProfileModal() {
        const modal = document.createElement('div');
        modal.id = 'profile-modal';
        modal.className = 'profile-modal hidden';
        modal.innerHTML = `
            <div class="profile-modal-content">
                <div class="profile-modal-header">
                    <h3>Мой профиль</h3>
                    <button class="profile-modal-close" id="profile-modal-close">✕</button>
                </div>
                <div id="profile-error" class="error-message hidden"></div>

                <div class="profile-section" style="text-align: center;">
                    <div id="profile-avatar-container" class="profile-avatar-large">
                        <img id="profile-avatar-img" src="" alt="avatar" style="display: none;">
                        <div id="profile-avatar-placeholder"></div>
                    </div>
                    <label for="avatar-upload" class="btn-secondary" style="margin-top: 8px; display: inline-block;">
                        Загрузить фото
                    </label>
                    <input type="file" id="avatar-upload" accept="image/png, image/jpeg, image/gif" style="display: none;">
                </div>

                <div class="profile-section">
                    <label>Имя пользователя</label>
                    <input type="text" id="profile-modal-username" disabled>
                </div>

                <div class="profile-section">
                    <label>О себе</label>
                    <textarea id="profile-modal-bio" placeholder="Расскажите о себе..." maxlength="500"></textarea>
                    <div class="char-count" id="bio-char-count">0/500</div>
                </div>

                <div class="profile-actions">
                    <button id="profile-save-btn" class="btn-primary">Сохранить</button>
                    <button id="profile-cancel-btn" class="btn-secondary">Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.setupProfileModalEvents();
    }

    setupProfileModalEvents() {
        const closeBtn = document.getElementById('profile-modal-close');
        const cancelBtn = document.getElementById('profile-cancel-btn');
        const saveBtn = document.getElementById('profile-save-btn');
        const bioInput = document.getElementById('profile-modal-bio');
        const avatarUpload = document.getElementById('avatar-upload');
        const avatarImg = document.getElementById('profile-avatar-img');
        const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeProfileModal());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeProfileModal());
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveProfile());
        }
        if (bioInput) {
            bioInput.addEventListener('input', (e) => {
                const charCount = document.getElementById('bio-char-count');
                if (charCount) {
                    charCount.textContent = `${e.target.value.length}/500`;
                }
            });
        }
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    avatarImg.src = event.target.result;
                    avatarImg.style.display = 'block';
                    avatarPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
                this.uploadAvatar(file);
            });
        }
        document.getElementById('profile-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'profile-modal') {
                this.closeProfileModal();
            }
        });
    }

    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append('avatar', file);
        const csrfToken = document.getElementById('csrf-token').value;
        try {
            const response = await fetch('/api/profile/avatar', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки');
            }
            this.app.ui.showNotification('Аватар обновлён', false);
            const avatarImg = document.getElementById('profile-avatar-img');
            avatarImg.src = data.avatar_url + '?t=' + Date.now();
            avatarImg.style.display = 'block';
            document.getElementById('profile-avatar-placeholder').style.display = 'none';
        } catch (err) {
            this.app.ui.showNotification(err.message, true);
        }
    }

    async loadProfileData(userId, isOwn) {
        try {
            const url = isOwn ? '/api/profile' : `/api/users/${userId}/profile`;
            const response = await fetch(url, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok) {
                this.showProfileError('Ошибка загрузки профиля');
                return;
            }
            const data = await response.json();
            document.getElementById('profile-modal-username').value = data.username || '';
            const bioField = document.getElementById('profile-modal-bio');
            if (bioField) {
                bioField.value = data.bio || '';
                const charCount = document.getElementById('bio-char-count');
                if (charCount) {
                    charCount.textContent = `${(data.bio || '').length}/500`;
                }
            }
            const avatarImg = document.getElementById('profile-avatar-img');
            const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');
            if (data.avatar_url) {
                avatarImg.src = data.avatar_url;
                avatarImg.style.display = 'block';
                avatarPlaceholder.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarPlaceholder.style.display = 'flex';
                avatarPlaceholder.textContent = data.username.charAt(0).toUpperCase();
            }
            this.clearProfileError();
        } catch (err) {
            this.showProfileError('Ошибка загрузки профиля');
        }
    }

    async saveProfile() {
        const saveBtn = document.getElementById('profile-save-btn');
        const originalText = saveBtn?.textContent;
        if (saveBtn) {
            saveBtn.textContent = '⏳ Сохранение...';
            saveBtn.disabled = true;
        }
        try {
            const bio = document.getElementById('profile-modal-bio').value.trim();
            const csrfToken = document.getElementById('csrf-token').value;
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    bio: bio || null
                })
            });
            if (!response.ok) {
                this.showProfileError('Ошибка сохранения профиля');
                return;
            }
            this.app.ui.showNotification('Профиль обновлён', false);
            this.closeProfileModal();
        } catch (err) {
            this.showProfileError('Ошибка соединения');
        } finally {
            if (saveBtn) {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }
    }

    closeProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showProfileError(message) {
        const errorEl = document.getElementById('profile-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    clearProfileError() {
        const errorEl = document.getElementById('profile-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
    }
}
