// chat.js
class Chat {
    constructor(app) {
        this.app = app;
        this.currentChatId = null;
        this.chatsData = {};
        this.unreadCounts = {};
        this.currentChatPartner = null;
        this.isLoadingHistory = false;
        this.currentTypingUsers = new Set();
        this.typingTimer = null;
        this.historyTimeout = null;
        this.searchDebounced = Utils.debounce(this.searchUsers.bind(this), 300);
        this.groupCreationInProgress = false;
        this.currentGroupInfo = null;
        this.activeMessageMenu = null;

        this.initGlobalHandlers();
    }

    initGlobalHandlers() {
        document.addEventListener('click', (e) => {
            if (this.activeMessageMenu && !this.activeMessageMenu.contains(e.target)) {
                this.closeMessageMenu();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeMessageMenu) {
                this.closeMessageMenu();
            }
        });
        window.addEventListener('scroll', () => this.closeMessageMenu(), true);
        window.addEventListener('resize', () => this.closeMessageMenu());
    }

    clearAllTimers() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        if (this.historyTimeout) {
            clearTimeout(this.historyTimeout);
            this.historyTimeout = null;
        }
    }

    renderChatsList() {
        let html = '';
        for (const id in this.chatsData) {
            const chat = this.chatsData[id];
            const activeClass = id === this.currentChatId ? 'active' : '';
            const name = chat.name || 'Чат';
            const lastMsg = chat.lastMessage || '';
            const lastTime = chat.lastTime || '';
            const displayTime = Utils.formatTime(lastTime);
            const unread = this.unreadCounts[id]
                ? `<span class="unread-badge">${this.unreadCounts[id]}</span>`
                : '';
            const avatar = name.charAt(0).toUpperCase();

            const nameHtml = chat.type === 'group'
                ? `<i class="fas fa-users"></i> ${Utils.escapeHtml(name)}`
                : Utils.escapeHtml(name);

            html += `
                <div class="chat-item ${activeClass}" data-chat-id="${id}">
                    <div class="chat-avatar">${avatar}</div>
                    <div class="chat-info">
                        <div class="chat-name">${nameHtml}</div>
                        <div class="chat-last-msg">${Utils.escapeHtml(lastMsg.substring(0, 30))}${lastMsg.length > 30 ? '…' : ''}</div>
                    </div>
                    <div class="chat-meta">
                        ${unread}
                        <span class="chat-time">${displayTime}</span>
                    </div>
                </div>
            `;
        }
        this.app.ui.elements.chatsList.innerHTML = html;

        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                if (this.isLoadingHistory) return;
                if (chatId === this.currentChatId) {
                    if (Utils.isMobile()) this.app.ui.closeSidebar();
                    return;
                }
                this.switchChat(chatId);
            });
        });
    }

    addMessageToChat(msg) {
        const container = this.app.ui.elements.messagesContainer;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.dataset.messageId = msg.id;
        msgDiv.dataset.userId = msg.user_id;

        const isOwn = msg.user_id === this.app.currentUserId;
        msgDiv.classList.add(isOwn ? 'own' : 'other');

        const safeNick = Utils.escapeHtml(msg.nickname);
        const safeText = Utils.escapeHtml(msg.text);
        const displayTime = Utils.formatTime(msg.timestamp);

        const chatData = this.chatsData[this.currentChatId];
        const chatType = chatData ? chatData.type : null;

        // Группировка только в групповых чатах и только для чужих сообщений
        const isGroupChat = chatType === 'group' && !isOwn;

        let shouldShowNick = true;
        let isFirstInGroup = true;

        if (isGroupChat && container.lastChild) {
            const lastMsg = container.lastChild;
            const lastUserId = lastMsg.dataset.userId;
            const lastWasOwn = lastMsg.classList.contains('own');
            const lastWasDeleted = lastMsg.classList.contains('deleted');

            if (!lastWasOwn && !lastWasDeleted && lastUserId === String(msg.user_id)) {
                shouldShowNick = false;
                isFirstInGroup = false;
                msgDiv.classList.add('same-user-message');
            } else {
                msgDiv.classList.add('first-in-group');
            }
        } else if (isGroupChat) {
            msgDiv.classList.add('first-in-group');
        }

        // Удалённое сообщение
        if (msg.is_deleted) {
            msgDiv.classList.add('deleted');

            // Аватар показываем только если это первое сообщение в группе
            const avatarHtml = !isOwn && shouldShowNick ?
                `<div class="avatar">${safeNick.charAt(0).toUpperCase()}</div>` : '';

            const showNick = !isOwn && chatType === 'group' && shouldShowNick;
            const nicknameHtml = showNick ? `<div class="message-nickname">${safeNick}</div>` : '';

            msgDiv.innerHTML = `
                ${avatarHtml}
                <div class="message-content">
                    ${nicknameHtml}
                    <div class="bubble">
                        <div class="message-row">
                            <span class="message-text">Сообщение удалено</span>
                            <span class="timestamp">${displayTime}</span>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(msgDiv);
            return;
        }

        // Обычное сообщение
        const avatarHtml = !isOwn && shouldShowNick ?
            `<div class="avatar">${safeNick.charAt(0).toUpperCase()}</div>` : '';

        const showNick = !isOwn && chatType === 'group' && shouldShowNick;
        const nicknameHtml = showNick ? `<div class="message-nickname">${safeNick}</div>` : '';

        const editedHtml = msg.edited ?
            '<span class="edited-indicator">ред.</span>' : '';

        const actionsHtml = isOwn ?
            `<div class="message-actions" data-message-id="${msg.id}">⋮</div>` : '';

        if (isOwn) {
            msgDiv.innerHTML = `
                <div class="message-content">
                    <div class="bubble">
                        <div class="message-row">
                            <span class="message-text">${safeText}${editedHtml}</span>
                            <span class="timestamp">${displayTime}</span>
                        </div>
                    </div>
                </div>
                ${actionsHtml}
            `;
        } else {
            msgDiv.innerHTML = `
                ${avatarHtml}
                <div class="message-content">
                    ${nicknameHtml}
                    <div class="bubble">
                        <div class="message-row">
                            <span class="message-text">${safeText}${editedHtml}</span>
                            <span class="timestamp">${displayTime}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        container.appendChild(msgDiv);

        if (isOwn) {
            const actionsBtn = msgDiv.querySelector('.message-actions');
            if (actionsBtn) {
                actionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showMessageActions(e, msg.id, msg.text);
                });
            }
        }
    }

    closeMessageMenu() {
        if (this.activeMessageMenu) {
            this.activeMessageMenu.classList.remove('show');
            setTimeout(() => {
                if (this.activeMessageMenu && this.activeMessageMenu.parentNode) {
                    this.activeMessageMenu.remove();
                }
                this.activeMessageMenu = null;
            }, 150);
        }
    }

    showMessageActions(event, messageId, currentText) {
        event.stopPropagation();

        this.closeMessageMenu();

        const messageDiv = event.target.closest('.message');
        if (!messageDiv) return;

        const menu = document.createElement('div');
        menu.className = 'message-actions-menu';
        menu.innerHTML = `
            <button class="edit-message">Редактировать</button>
            <button class="delete-message">Удалить</button>
        `;

        messageDiv.appendChild(menu);
        setTimeout(() => menu.classList.add('show'), 10);
        this.activeMessageMenu = menu;

        menu.querySelector('.edit-message').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeMessageMenu();
            this.app.ui.showEditMessageModal(messageId, currentText);
        });

        menu.querySelector('.delete-message').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeMessageMenu();
            this.app.ui.showDeleteConfirmModal(messageId);
        });
    }

    deleteMessage(messageId) {
        if (!this.currentChatId) return;
        this.app.socket.socket.emit('delete_message', {
            chat_id: this.currentChatId,
            message_id: messageId
        });
    }

    editMessage(messageId, newText) {
        if (!this.currentChatId) return;
        this.app.socket.socket.emit('edit_message', {
            chat_id: this.currentChatId,
            message_id: messageId,
            text: newText.trim()
        });
    }

    scrollMessagesToBottom() {
        const container = this.app.ui.elements.messagesContainer;
        container.scrollTop = container.scrollHeight;
    }

    resetToPlaceholder() {
        this.currentChatId = null;
        this.app.ui.elements.messagesContainer.innerHTML = '';
        this.app.ui.elements.messagesContainer.classList.add('hidden');
        this.app.ui.elements.chatPlaceholder.classList.remove('hidden');
        this.app.ui.elements.chatHeader.classList.remove('hidden');
        this.app.ui.elements.inputArea.classList.add('hidden');
        this.app.ui.updateHeaderForNoChat();
    }

    switchChat(chatId) {
        if (!this.app.socket.socket || !this.chatsData[chatId]) return;

        this.clearAllTimers();
        this.app.ui.elements.typingIndicator.classList.add('hidden');
        this.currentTypingUsers.clear();

        if (this.currentChatId) {
            this.app.socket.socket.emit('typing', { chat_id: this.currentChatId, typing: false });
        }

        this.isLoadingHistory = true;
        this.currentChatId = chatId;

        this.app.ui.elements.messagesContainer.innerHTML = '<div class="loader"></div>';
        this.app.ui.elements.messagesContainer.classList.remove('hidden');
        this.app.ui.elements.chatPlaceholder.classList.add('hidden');
        this.app.ui.elements.chatHeader.classList.add('hidden');
        this.app.ui.elements.inputArea.classList.add('hidden');

        this.historyTimeout = setTimeout(() => {
            if (this.isLoadingHistory) {
                this.isLoadingHistory = false;
                this.app.ui.showNotification('Не удалось загрузить историю. Проверьте соединение.');
                this.resetToPlaceholder();
            }
        }, 15000);

        this.app.socket.socket.emit('join_chat', { chat_id: chatId });

        if (Utils.isMobile()) {
            this.app.ui.closeSidebar();
            this.app.ui.elements.messageInput.blur();
        }
    }

    sendMessage() {
        const input = this.app.ui.elements.messageInput;
        const text = input.value.trim();
        if (!text) return;
        if (text.length > 500) {
            this.app.ui.showNotification(`Сообщение слишком длинное (макс. 500)`);
            return;
        }
        if (this.app.socket.socket && this.currentChatId) {
            this.app.socket.socket.emit('new_message', { chat_id: this.currentChatId, text });
            input.value = '';
            clearTimeout(this.typingTimer);
            this.app.socket.socket.emit('typing', { chat_id: this.currentChatId, typing: false });
        }
    }

    handleTyping() {
        if (!this.currentChatId) return;
        clearTimeout(this.typingTimer);
        const isTyping = this.app.ui.elements.messageInput.value.trim().length > 0;
        this.app.socket.socket.emit('typing', { chat_id: this.currentChatId, typing: isTyping });
        if (isTyping) {
            this.typingTimer = setTimeout(() => {
                this.app.socket.socket.emit('typing', { chat_id: this.currentChatId, typing: false });
            }, 2000);
        }
    }

    async searchUsers(query) {
        try {
            const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            const users = await response.json();
            const resultsEl = this.app.ui.elements.sidebarSearchResults;
            if (users.length === 0) {
                resultsEl.innerHTML = '<div class="empty-message">Ничего не найдено</div>';
                resultsEl.classList.add('show');
                return;
            }
            resultsEl.innerHTML = users
                .map(u => `<div class="result-item" data-username="${Utils.escapeHtml(u.username)}">${Utils.escapeHtml(u.username)}</div>`)
                .join('');
            resultsEl.classList.add('show');

            resultsEl.querySelectorAll('.result-item').forEach(div => {
                div.addEventListener('click', () => {
                    const username = div.dataset.username;
                    this.app.ui.elements.sidebarUserSearch.value = '';
                    resultsEl.classList.remove('show');
                    this.app.socket.socket.emit('create_private_chat', { username });
                });
            });
        } catch (err) {
            console.error('Ошибка поиска', err);
            this.app.ui.showNotification('Ошибка при поиске пользователей', true);
        }
    }

    createGroup(name, description, memberIds) {
        if (this.groupCreationInProgress) return;
        this.groupCreationInProgress = true;
        this.app.socket.socket.emit('create_group', {
            name: name,
            description: description,
            member_ids: memberIds
        });
    }

    addUserToGroup(chatId, userId) {
        this.app.socket.socket.emit('add_to_group', { chat_id: chatId, user_id: userId });
    }

    removeUserFromGroup(chatId, userId) {
        this.app.socket.socket.emit('remove_from_group', { chat_id: chatId, user_id: userId });
    }

    leaveGroup(chatId) {
        if (confirm('Вы уверены, что хотите покинуть группу?')) {
            this.app.socket.socket.emit('leave_group', { chat_id: chatId });
        }
    }

    fetchGroupInfo(chatId) {
        this.app.socket.socket.emit('get_group_info', { chat_id: chatId });
    }

    showGroupInfo(info) {
        this.currentGroupInfo = info;
        this.app.ui.showGroupInfoModal(info);
    }
}
