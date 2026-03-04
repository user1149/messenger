// static/js/ui.js
const UI = class {
    constructor(app) {
        this.app = app;
        this.elements = {};
        this.cacheDom();
        this.bindEvents();
        this.selectedUsers = null;
    }

    cacheDom() {
        const ids = [
            'loading-screen', 'auth-overlay', 'main-interface', 'auth-title',
            'auth-login', 'auth-email', 'auth-username', 'auth-password', 'auth-password-confirm',
            'auth-submit', 'auth-toggle', 'auth-error', 'chats-list',
            'messages-container', 'chat-placeholder', 'message-input', 'send-btn',
            'chat-header', 'chat-partner-name', 'online-status', 'typing-indicator',
            'input-area', 'sidebar-user-search', 'sidebar-search-results',
            'chats-sidebar', 'user-menu-button', 'user-popup', 'popup-username',
            'popup-logout', 'back-button', 'resizer', 'notification',
            'login-group', 'email-group', 'username-group', 'password-confirm-group',
            'popup-create-group', 'chat-avatar-img', 'chat-avatar-placeholder', 'chat-header-avatar'
        ];
        this.elements = Object.fromEntries(
            ids.map(id => [id.replace(/-([a-z])/g, (_, l) => l.toUpperCase()), document.getElementById(id)])
        );
        if (!this.elements.userMenuButton) {
            setTimeout(() => this.cacheDom(), 100);
            return;
        }
        this.ensureSidebarOverlay();
    }

    ensureSidebarOverlay() {
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.querySelector('.app-container').appendChild(overlay);
        }
        this.elements.sidebarOverlay = document.querySelector('.sidebar-overlay');
    }

    bindEvents() {
        if (this.elements.userMenuButton) {
            this.elements.userMenuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.elements.userPopup.classList.toggle('hidden');
            });
        }
        document.addEventListener('click', (e) => {
            if (!this.elements.userPopup.contains(e.target) && e.target !== this.elements.userMenuButton) {
                this.elements.userPopup.classList.add('hidden');
            }
        });
        this.elements.popupLogout.addEventListener('click', () => this.app.auth.logout());
        if (this.elements.popupCreateGroup) {
            this.elements.popupCreateGroup.addEventListener('click', () => {
                this.elements.userPopup.classList.add('hidden');
                this.showCreateGroupModal();
            });
        }
        if (this.elements.resizer) {
            this.elements.resizer.addEventListener('mousedown', this.startResize.bind(this));
        }
        if (this.elements.backButton) {
            this.elements.backButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.chat.resetToPlaceholder();
                if (Utils.isMobile()) {
                    this.openSidebar();
                }
            });
        }
        if (this.elements.sidebarOverlay) {
            this.elements.sidebarOverlay.addEventListener('click', this.closeSidebar.bind(this));
        }
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        this.initSwipeHandlers();
    }

    startResize(e) {
        if (Utils.isMobile()) return;
        this.app.isResizing = true;
        document.body.style.cursor = 'col-resize';
        this.resizeHandler = this.resize.bind(this);
        this.stopResizeHandler = this.stopResize.bind(this);
        document.addEventListener('mousemove', this.resizeHandler);
        document.addEventListener('mouseup', this.stopResizeHandler);
        e.preventDefault();
    }

    resize(e) {
        if (!this.app.isResizing) return;
        const sidebar = this.elements.chatsSidebar;
        const newWidth = e.clientX - sidebar.getBoundingClientRect().left;
        const clampedWidth = Math.max(200, Math.min(500, newWidth));
        sidebar.style.width = clampedWidth + 'px';
    }

    stopResize() {
        this.app.isResizing = false;
        document.body.style.cursor = '';
        if (this.resizeHandler) {
            document.removeEventListener('mousemove', this.resizeHandler);
        }
        if (this.stopResizeHandler) {
            document.removeEventListener('mouseup', this.stopResizeHandler);
        }
        this.resizeHandler = null;
        this.stopResizeHandler = null;
    }

    toggleSidebar() {
        if (!Utils.isMobile()) return;
        if (this.elements.chatsSidebar.classList.contains('open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        if (!Utils.isMobile()) return;
        this.elements.chatsSidebar.classList.add('open');
        this.elements.sidebarOverlay?.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    closeSidebar() {
        if (!Utils.isMobile()) return;
        this.elements.chatsSidebar.classList.remove('open');
        this.elements.sidebarOverlay?.classList.remove('visible');
        document.body.style.overflow = '';
    }

    initSwipeHandlers() {
        let touchstartX = 0, touchstartY = 0;
        let touchendX = 0, touchendY = 0;
        document.addEventListener('touchstart', (e) => {
            touchstartX = e.changedTouches[0].screenX;
            touchstartY = e.changedTouches[0].screenY;
        });
        document.addEventListener('touchend', (e) => {
            touchendX = e.changedTouches[0].screenX;
            touchendY = e.changedTouches[0].screenY;
            this.handleSwipe(touchstartX, touchendX, touchstartY, touchendY);
        });
    }

    handleSwipe(startX, endX, startY, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                this.openSidebar();
            } else {
                if (this.app.chat.currentChatId) {
                    this.app.chat.resetToPlaceholder();
                    this.openSidebar();
                } else {
                    this.closeSidebar();
                }
            }
        }
    }

    handleWindowResize() {
        if (!Utils.isMobile()) {
            this.elements.chatsSidebar.classList.remove('open');
            this.elements.sidebarOverlay?.classList.remove('visible');
            document.body.style.overflow = '';
        } else if (!this.app.chat.currentChatId) {
            this.updateHeaderForNoChat();
        }
    }

    updateHeaderForNoChat() {
        this.elements.chatPartnerName.textContent = 'Чаты';
        this.elements.onlineStatus.textContent = '';
        this.elements.typingIndicator.classList.add('hidden');
    }

    showNotification(message, isError = true) {
        const notif = this.elements.notification;
        if (!notif) return;
        notif.textContent = message;
        notif.classList.add('show');
        notif.style.background = isError ? '#c62828' : '#4f7eb3';
        setTimeout(() => notif.classList.remove('show'), 3000);
    }

    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showEditMessageModal(messageId, currentText) {
        const oldModal = document.getElementById('edit-message-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'edit-message-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Редактировать сообщение</h3>
                <input type="text" id="edit-message-input" class="edit-message-input" value="${Utils.escapeHtml(currentText)}">
                <div class="modal-actions">
                    <button id="edit-message-save" class="modal-btn modal-btn-primary">Сохранить</button>
                    <button id="edit-message-cancel" class="modal-btn modal-btn-secondary">Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const closeBtn = modal.querySelector('.close');
        const saveBtn = modal.querySelector('#edit-message-save');
        const cancelBtn = modal.querySelector('#edit-message-cancel');
        const input = modal.querySelector('#edit-message-input');
        const closeModal = () => {
            modal.style.display = 'none';
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        };
        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        saveBtn.onclick = () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                this.app.chat.editMessage(messageId, newText);
            }
            closeModal();
        };
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveBtn.click();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', escapeHandler);
        modal.style.display = 'block';
        input.focus();
        input.select();
    }

    showDeleteConfirmModal(messageId) {
        const oldModal = document.getElementById('delete-confirm-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'delete-confirm-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Подтверждение удаления</h3>
                <p>Вы уверены, что хотите удалить это сообщение?</p>
                <div class="modal-actions">
                    <button id="delete-confirm-yes" class="modal-btn modal-btn-danger">Удалить</button>
                    <button id="delete-confirm-no" class="modal-btn modal-btn-secondary">Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const closeBtn = modal.querySelector('.close');
        const yesBtn = modal.querySelector('#delete-confirm-yes');
        const noBtn = modal.querySelector('#delete-confirm-no');
        const closeModal = () => {
            modal.style.display = 'none';
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        };
        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        closeBtn.onclick = closeModal;
        noBtn.onclick = closeModal;
        yesBtn.onclick = () => {
            this.app.chat.deleteMessage(messageId);
            closeModal();
        };
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', escapeHandler);
        modal.style.display = 'block';
    }

    showCreateGroupModal() {
        const oldModal = document.getElementById('create-group-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'create-group-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <div class="group-creation">
                    <div class="step-indicator">
                        <div class="step active" data-step="1">1. Участники</div>
                        <div class="step" data-step="2">2. Название</div>
                    </div>
                    <div class="step-content" id="group-step-1">
                        <h3>Выберите участников</h3>
                        <div class="user-search-area">
                            <input type="text" id="group-user-search" placeholder="Поиск по имени..." autocomplete="off">
                            <div id="group-search-results" class="search-results"></div>
                        </div>
                        <div class="selected-users">
                            <h4>Выбранные участники:</h4>
                            <div id="selected-users-list" class="selected-users-list"></div>
                        </div>
                        <div class="step-actions">
                            <button id="group-next-step" disabled>Далее</button>
                        </div>
                    </div>
                    <div class="step-content hidden" id="group-step-2">
                        <h3>Название группы</h3>
                        <input type="text" id="group-name" placeholder="Название" maxlength="100">
                        <textarea id="group-description" placeholder="Описание (необязательно)" rows="3"></textarea>
                        <div class="step-actions">
                            <button id="group-back-step">Назад</button>
                            <button id="create-group-btn" disabled>Создать</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.selectedUsers = new Map();
        this.bindGroupModalEvents(modal);
        this.showModalWithEscape(modal);
    }

    showModalWithEscape(modal) {
        const closeModal = () => {
            modal.style.display = 'none';
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        };
        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) closeBtn.onclick = closeModal;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', escapeHandler);
        modal.style.display = 'block';
    }

    bindGroupModalEvents(modal) {
        const searchInput = modal.querySelector('#group-user-search');
        const resultsDiv = modal.querySelector('#group-search-results');
        const selectedDiv = modal.querySelector('#selected-users-list');
        const nextBtn = modal.querySelector('#group-next-step');
        const backBtn = modal.querySelector('#group-back-step');
        const createBtn = modal.querySelector('#create-group-btn');
        const nameInput = modal.querySelector('#group-name');
        const descInput = modal.querySelector('#group-description');
        const step1 = modal.querySelector('#group-step-1');
        const step2 = modal.querySelector('#group-step-2');
        const steps = modal.querySelectorAll('.step');
        if (!this.selectedUsers) {
            this.selectedUsers = new Map();
        }
        const updateNextButton = () => {
            nextBtn.disabled = this.selectedUsers.size === 0;
        };
        const goToStep = (step) => {
            if (step === 1) {
                step1.classList.remove('hidden');
                step2.classList.add('hidden');
                steps[0].classList.add('active');
                steps[1].classList.remove('active');
            } else {
                step1.classList.add('hidden');
                step2.classList.remove('hidden');
                steps[0].classList.remove('active');
                steps[1].classList.add('active');
                createBtn.disabled = !nameInput.value.trim();
            }
        };
        nextBtn.addEventListener('click', () => goToStep(2));
        backBtn.addEventListener('click', () => goToStep(1));
        const addUserChip = (id, username) => {
            const chip = document.createElement('span');
            chip.className = 'user-chip';
            chip.dataset.id = id;
            chip.innerHTML = `
                <span class="chip-avatar">${username.charAt(0).toUpperCase()}</span>
                <span class="chip-name">${Utils.escapeHtml(username)}</span>
                <i class="fas fa-times"></i>
            `;
            chip.querySelector('i').addEventListener('click', (e) => {
                e.stopPropagation();
                chip.remove();
                this.selectedUsers.delete(id);
                updateNextButton();
            });
            selectedDiv.appendChild(chip);
        };
        searchInput.addEventListener('input', Utils.debounce(async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                resultsDiv.classList.remove('show');
                return;
            }
            try {
                const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Ошибка загрузки пользователей');
                const users = await response.json();
                if (users.length === 0) {
                    resultsDiv.innerHTML = '<div class="empty-message">Ничего не найдено</div>';
                    resultsDiv.classList.add('show');
                    return;
                }
                const available = users.filter(u => !this.selectedUsers.has(u.id));
                resultsDiv.innerHTML = available.map(u => `
                    <div class="result-item" data-id="${u.id}" data-username="${u.username}">
                        <span class="avatar">${u.username.charAt(0).toUpperCase()}</span>
                        <span class="username">${Utils.escapeHtml(u.username)}</span>
                    </div>
                `).join('');
                resultsDiv.classList.add('show');
                resultsDiv.querySelectorAll('.result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const id = parseInt(item.dataset.id);
                        const username = item.dataset.username;
                        if (!this.selectedUsers.has(id)) {
                            this.selectedUsers.set(id, { id, username });
                            addUserChip(id, username);
                        }
                        resultsDiv.classList.remove('show');
                        searchInput.value = '';
                        updateNextButton();
                    });
                });
            } catch (err) {
                console.error('Ошибка поиска', err);
                this.app.ui.showNotification('Ошибка поиска пользователей', true);
            }
        }, 300));
        nameInput.addEventListener('input', () => {
            createBtn.disabled = !nameInput.value.trim();
        });
        createBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const description = descInput.value.trim();
            const memberIds = Array.from(this.selectedUsers.keys());
            this.app.chat.createGroup(name, description, memberIds);
            modal.style.display = 'none';
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        });
        document.addEventListener('click', (e) => {
            if (!modal.contains(e.target) || (!searchInput.contains(e.target) && !resultsDiv.contains(e.target))) {
                resultsDiv.classList.remove('show');
            }
        });
    }

    showGroupInfoModal(info) {
        const oldModal = document.getElementById('group-info-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'group-info-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
        const membersHtml = info.members.map(m => `
            <div class="member-item" data-id="${m.id}">
                <span class="member-avatar">${m.avatar_url ? `<img src="${m.avatar_url}" class="member-avatar-img" alt="avatar">` : m.username.charAt(0).toUpperCase()}</span>
                <span>${Utils.escapeHtml(m.username)} ${m.is_creator ? '(создатель)' : ''}</span>
                ${this.app.currentUsername !== m.username && info.created_by === this.app.currentUserId ?
                    `<button class="remove-member-btn">Удалить</button>` : ''}
            </div>
        `).join('');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>${Utils.escapeHtml(info.name)}</h3>
                <p>${Utils.escapeHtml(info.description || '')}</p>
                <p>Участников: ${info.member_count}</p>
                <h4>Участники:</h4>
                <div class="members-list">${membersHtml}</div>
                ${info.created_by === this.app.currentUserId ?
                    `<div class="add-member-section">
                        <input type="text" id="group-info-search" placeholder="Добавить участника...">
                        <div id="group-info-results" class="search-results"></div>
                    </div>` : ''}
                <button id="leave-group-btn">Покинуть группу</button>
            </div>
        `;
        this.showModalWithEscape(modal);
        if (info.created_by === this.app.currentUserId) {
            const searchInput = modal.querySelector('#group-info-search');
            const resultsDiv = modal.querySelector('#group-info-results');
            searchInput.addEventListener('input', Utils.debounce(async (e) => {
                const query = e.target.value.trim();
                if (query.length < 2) return;
                try {
                    const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
                    if (!response.ok) return;
                    const users = await response.json();
                    const existingIds = new Set(info.members.map(m => m.id));
                    const available = users.filter(u => !existingIds.has(u.id));
                    resultsDiv.innerHTML = available.map(u => `<div class="result-item" data-id="${u.id}">${Utils.escapeHtml(u.username)}</div>`).join('');
                    resultsDiv.classList.add('show');
                    resultsDiv.querySelectorAll('.result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const userId = parseInt(item.dataset.id);
                            this.app.chat.addUserToGroup(info.id, userId);
                            resultsDiv.classList.remove('show');
                            searchInput.value = '';
                        });
                    });
                } catch (err) {
                    console.error('Ошибка поиска', err);
                }
            }, 300));
        }
        modal.querySelectorAll('.remove-member-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = parseInt(e.target.closest('.member-item').dataset.id);
                if (confirm('Удалить участника?')) {
                    this.app.chat.removeUserFromGroup(info.id, memberId);
                }
            });
        });
        const leaveBtn = modal.querySelector('#leave-group-btn');
        leaveBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
            this.app.chat.leaveGroup(info.id);
        });
    }

    updateGroupHeader(info) {
        this.elements.chatPartnerName.textContent = info.name;
    }
}
