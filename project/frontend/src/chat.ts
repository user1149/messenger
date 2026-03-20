import { ChatApplication } from './main';
import { escapeHtml, formatTime, isMobile, debounce } from './utils';
import type { Chat as ChatType, Message, GroupInfo } from './types';

export class Chat {
    private app: ChatApplication;
    currentChatId: string | null = null;
    currentChatPartnerId: number | null = null;
    chatsData: { [id: string]: ChatType } = {};
    unreadCounts: { [id: string]: number } = {};
    currentChatPartner: string | null = null;
    isLoadingHistory = false;
    currentTypingUsers = new Set<string>();
    typingTimer: ReturnType<typeof setTimeout> | null = null;
    historyTimeout: ReturnType<typeof setTimeout> | null = null;
    searchDebounced: (query: string) => void;
    groupCreationInProgress = false;
    currentGroupInfo: GroupInfo | null = null;
    activeMessageMenu: HTMLElement | null = null;

    constructor(app: ChatApplication) {
        this.app = app;
        this.searchDebounced = debounce(this.searchUsers.bind(this), 300);
        this.initGlobalHandlers();
    }

    initGlobalHandlers() {
        document.addEventListener('click', (e) => {
            if (this.activeMessageMenu && !this.activeMessageMenu.contains(e.target as Node)) {
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
        if (this.typingTimer) clearTimeout(this.typingTimer);
        if (this.historyTimeout) clearTimeout(this.historyTimeout);
    }

    renderChatsList() {
        let html = '';
        for (const id in this.chatsData) {
            const chat = this.chatsData[id];
            const activeClass = id === this.currentChatId ? 'active' : '';
            const name = chat.name || 'Чат';
            const lastMsg = chat.lastMessage || '';
            const lastTime = chat.lastTime || '';
            const displayTime = formatTime(lastTime);
            const unread = this.unreadCounts[id] ? `<span class="unread-badge">${this.unreadCounts[id]}</span>` : '';

            let avatarHtml: string;
            if (chat.avatarUrl) {
                avatarHtml = `<img src="${chat.avatarUrl}" class="chat-avatar-img" alt="avatar">`;
            } else {
                avatarHtml = chat.type === 'group' ? '<i class="fas fa-users"></i>' : name.charAt(0).toUpperCase();
            }

            const nameHtml = chat.type === 'group' ? `<i class="fas fa-users"></i> ${escapeHtml(name)}` : escapeHtml(name);

            html += `
                <div class="chat-item ${activeClass}" data-chat-id="${id}">
                    <div class="chat-avatar">${avatarHtml}</div>
                    <div class="chat-info">
                        <div class="chat-name">${nameHtml}</div>
                        <div class="chat-last-msg">${escapeHtml(lastMsg.substring(0, 30))}${lastMsg.length > 30 ? '…' : ''}</div>
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
                const chatId = (item as HTMLElement).dataset.chatId;
                if (this.isLoadingHistory || !chatId) return;
                if (chatId === this.currentChatId) {
                    if (isMobile()) this.app.ui.closeSidebar();
                    return;
                }
                this.switchChat(chatId);
            });
        });
    }

    addMessageToChat(msg: Message) {
        const container = this.app.ui.elements.messagesContainer;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.dataset.messageId = msg.id.toString();
        msgDiv.dataset.userId = msg.user_id.toString();
        const isOwn = msg.user_id === this.app.currentUserId;
        msgDiv.classList.add(isOwn ? 'own' : 'other');
        const safeNick = escapeHtml(msg.nickname);
        const safeText = escapeHtml(msg.text);
        const displayTime = formatTime(msg.timestamp);
        const chatData = this.chatsData[this.currentChatId!];
        const chatType = chatData ? chatData.type : null;
        const isGroupChat = chatType === 'group';
        let shouldShowNick = true;
        let isFirstInGroup = true;

        if (isGroupChat && !isOwn && container.lastChild) {
            const lastMsgEl = container.lastChild as HTMLElement;
            const lastUserId = lastMsgEl.dataset.userId;
            const lastWasOwn = lastMsgEl.classList.contains('own');
            const lastWasDeleted = lastMsgEl.classList.contains('deleted');
            if (!lastWasOwn && !lastWasDeleted && lastUserId === String(msg.user_id)) {
                shouldShowNick = false;
                isFirstInGroup = false;
                msgDiv.classList.add('same-user-message');
            } else {
                msgDiv.classList.add('first-in-group');
            }
        } else if (isGroupChat && !isOwn) {
            msgDiv.classList.add('first-in-group');
        }

        if (msg.is_deleted) {
            msgDiv.classList.add('deleted');
            const avatarHtml = !isOwn && isGroupChat && shouldShowNick ?
                `<div class="avatar" data-user-id="${msg.user_id}">${msg.avatar_url ? `<img src="${msg.avatar_url}" class="message-avatar-img">` : safeNick.charAt(0).toUpperCase()}</div>` : '';
            const showNick = !isOwn && isGroupChat && shouldShowNick;
            const nicknameHtml = showNick ? `<div class="message-nickname"><span class="clickable-nickname" data-user-id="${msg.user_id}">${safeNick}</span></div>` : '';
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
            this.attachProfileClickHandlers(msgDiv, msg.user_id);
            return;
        }

        const avatarHtml = !isOwn && isGroupChat && shouldShowNick ?
            `<div class="avatar" data-user-id="${msg.user_id}">${msg.avatar_url ? `<img src="${msg.avatar_url}" class="message-avatar-img">` : safeNick.charAt(0).toUpperCase()}</div>` : '';
        const showNick = !isOwn && isGroupChat && shouldShowNick;
        const nicknameHtml = showNick ? `<div class="message-nickname"><span class="clickable-nickname" data-user-id="${msg.user_id}">${safeNick}</span></div>` : '';
        const editedHtml = msg.edited ? '<span class="edited-indicator">ред.</span>' : '';
        const actionsHtml = isOwn ? `<div class="message-actions" data-message-id="${msg.id}">⋮</div>` : '';

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
            const actionsBtn = msgDiv.querySelector('.message-actions') as HTMLElement;
            if (actionsBtn) {
                actionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showMessageActions(e as MouseEvent, msg.id, msg.text);
                });
            }
        }
        this.attachProfileClickHandlers(msgDiv, msg.user_id);
    }

    attachProfileClickHandlers(msgDiv: HTMLElement, userId: number) {
        msgDiv.querySelectorAll('.avatar[data-user-id], .clickable-nickname[data-user-id]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.profile.openProfileModal(userId);
            });
        });
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

    showMessageActions(event: MouseEvent, messageId: number, currentText: string) {
        event.stopPropagation();
        this.closeMessageMenu();
        const messageDiv = (event.target as HTMLElement).closest('.message') as HTMLElement;
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
        menu.querySelector('.edit-message')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeMessageMenu();
            this.app.ui.showEditMessageModal(messageId, currentText);
        });
        menu.querySelector('.delete-message')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeMessageMenu();
            this.app.ui.showDeleteConfirmModal(messageId);
        });
    }

    deleteMessage(messageId: number) {
        if (!this.currentChatId) return;
        this.app.socket.emitChat('delete_message', {
            chat_id: this.currentChatId,
            message_id: messageId
        });
    }

    editMessage(messageId: number, newText: string) {
        if (!this.currentChatId) return;
        this.app.socket.emitChat('edit_message', {
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
        this.currentChatPartnerId = null;
        this.currentChatPartner = null;
        this.app.ui.elements.messagesContainer.innerHTML = '';
        this.app.ui.elements.messagesContainer.classList.add('hidden');
        this.app.ui.elements.chatPlaceholder.classList.remove('hidden');
        this.app.ui.elements.chatHeader.classList.remove('hidden');
        this.app.ui.elements.inputArea.classList.add('hidden');
        this.app.ui.updateHeaderForNoChat();
        this.clearChatHeaderAvatar();
    }

    clearChatHeaderAvatar() {
        const avatarImg = this.app.ui.elements.chatAvatarImg as HTMLImageElement;
        const avatarPlaceholder = this.app.ui.elements.chatAvatarPlaceholder as HTMLElement;
        if (avatarImg) avatarImg.style.display = 'none';
        if (avatarPlaceholder) {
            avatarPlaceholder.style.display = 'flex';
            avatarPlaceholder.textContent = '';
        }
    }

    switchChat(chatId: string) {
        if (!this.app.socket || !this.chatsData[chatId]) return;
        this.clearAllTimers();
        this.app.ui.elements.typingIndicator.classList.add('hidden');
        this.currentTypingUsers.clear();
        if (this.currentChatId) {
            this.app.socket.emitChat('typing', { chat_id: this.currentChatId, typing: false });
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
        this.app.socket.emitChat('join_chat', { chat_id: chatId });
        if (isMobile()) {
            this.app.ui.closeSidebar();
            (this.app.ui.elements.messageInput as HTMLInputElement).blur();
        }
    }

    async loadChatAvatar(chatId: string, username: string) {
        try {
            const resp = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`);
            if (!resp.ok) return;
            const userData = await resp.json();
            if (this.chatsData[chatId]) {
                this.chatsData[chatId].avatarUrl = userData.avatar_url || undefined;
                this.renderChatsList();
            }
        } catch (err) {
            console.error('Failed to load chat avatar', err);
        }
    }

    async loadChatPartnerProfile(chatId: string) {
        const chat = this.chatsData[chatId];
        if (!chat || chat.type !== 'private') return;
        const partnerName = chat.name;
        try {
            const resp = await fetch(`/api/users/by-username/${encodeURIComponent(partnerName)}`);
            if (!resp.ok) return;
            const userData = await resp.json();
            this.currentChatPartnerId = userData.id;
            this.updateChatHeaderAvatar(userData.avatar_url || undefined, userData.username);
            this.makeChatHeaderAvatarClickable(userData.id);
        } catch (err) {
            console.error('Failed to load partner profile', err);
        }
    }

    makeChatHeaderAvatarClickable(userId: number) {
        const avatarContainer = this.app.ui.elements.chatHeaderAvatar as HTMLElement;
        if (avatarContainer) {
            avatarContainer.style.cursor = 'pointer';
            avatarContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.profile.openProfileModal(userId);
            });
        }
    }

    updateChatHeaderAvatar(avatarUrl: string | null, username: string) {
        const avatarImg = this.app.ui.elements.chatAvatarImg as HTMLImageElement;
        const avatarPlaceholder = this.app.ui.elements.chatAvatarPlaceholder as HTMLElement;
        if (avatarUrl) {
            avatarImg.src = avatarUrl;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
            avatarPlaceholder.textContent = username.charAt(0).toUpperCase();
        }
    }

    sendMessage() {
        const input = this.app.ui.elements.messageInput as HTMLInputElement;
        const text = input.value.trim();
        if (!text) return;
        if (text.length > 500) {
            this.app.ui.showNotification(`Сообщение слишком длинное (макс. 500)`);
            return;
        }
        if (this.app.socket && this.currentChatId) {
            this.app.socket.emitChat('new_message', { chat_id: this.currentChatId, text });
            input.value = '';
            if (this.typingTimer) clearTimeout(this.typingTimer);
            this.app.socket.emitChat('typing', { chat_id: this.currentChatId, typing: false });
        }
    }

    handleTyping() {
        if (!this.currentChatId) return;
        if (this.typingTimer) clearTimeout(this.typingTimer);
        const input = this.app.ui.elements.messageInput as HTMLInputElement;
        const isTyping = input.value.trim().length > 0;
        this.app.socket.emitChat('typing', { chat_id: this.currentChatId, typing: isTyping });
        if (isTyping) {
            this.typingTimer = setTimeout(() => {
                this.app.socket.emitChat('typing', { chat_id: this.currentChatId!, typing: false });
            }, 2000);
        }
    }

    async searchUsers(query: string) {
        try {
            const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            const users = await response.json();
            const resultsEl = this.app.ui.elements.sidebarSearchResults as HTMLElement;
            if (users.length === 0) {
                resultsEl.innerHTML = '<div class="empty-message">Ничего не найдено</div>';
                resultsEl.classList.add('show');
                return;
            }
            resultsEl.innerHTML = users
                .map((u: any) => `<div class="result-item" data-username="${escapeHtml(u.username)}">${escapeHtml(u.username)}</div>`)
                .join('');
            resultsEl.classList.add('show');
            resultsEl.querySelectorAll('.result-item').forEach(div => {
                div.addEventListener('click', () => {
                    const username = (div as HTMLElement).dataset.username!;
                    (this.app.ui.elements.sidebarUserSearch as HTMLInputElement).value = '';
                    resultsEl.classList.remove('show');
                    this.app.socket.emitChat('create_private_chat', { username });
                });
            });
        } catch (err) {
            console.error('Ошибка поиска', err);
            this.app.ui.showNotification('Ошибка при поиске пользователей', true);
        }
    }

    createGroup(name: string, description: string, memberIds: number[]) {
        if (this.groupCreationInProgress) return;
        this.groupCreationInProgress = true;
        this.app.socket.emitGroup('create_group', { name, description, member_ids: memberIds });
    }

    addUserToGroup(chatId: string, userId: number) {
        this.app.socket.emitGroup('add_to_group', { chat_id: chatId, user_id: userId });
    }

    removeUserFromGroup(chatId: string, userId: number) {
        this.app.socket.emitGroup('remove_from_group', { chat_id: chatId, user_id: userId });
    }

    leaveGroup(chatId: string) {
        if (confirm('Вы уверены, что хотите покинуть группу?')) {
            this.app.socket.emitGroup('leave_group', { chat_id: chatId });
        }
    }

    fetchGroupInfo(chatId: string) {
        this.app.socket.emitGroup('get_group_info', { chat_id: chatId });
    }

    showGroupInfo(info: GroupInfo) {
        this.currentGroupInfo = info;
        this.app.ui.showGroupInfoModal(info);
    }

    // Socket handlers
    handleChatList(chats: any[]) {
        this.chatsData = {};
        chats.forEach(c => {
            this.chatsData[c.id] = {
                id: c.id,
                name: c.name,
                type: c.type,
                lastMessage: c.lastMessage || '',
                lastTime: c.lastTime || '',
                avatarUrl: undefined
            };
        });
        this.renderChatsList();
        Object.entries(this.chatsData).forEach(([chatId, chat]) => {
            if (chat.type === 'private') this.loadChatAvatar(chatId, chat.name);
        });
        if (!this.currentChatId) {
            this.app.ui.updateHeaderForNoChat();
            if (isMobile()) this.app.ui.openSidebar();
        } else {
            const chat = this.chatsData[this.currentChatId];
            if (chat) {
                this.app.ui.elements.chatPartnerName.textContent =
                    chat.type === 'private' ? chat.name : (chat.type === 'group' ? chat.name : 'Общий чат');
            }
        }
    }

    handleUnreadCounts(counts: { [id: string]: number }) {
        this.unreadCounts = counts;
        this.renderChatsList();
    }

    handleChatCreated(chat: any) {
        if (!this.chatsData[chat.id]) {
            this.chatsData[chat.id] = {
                id: chat.id,
                name: chat.name,
                type: chat.type,
                lastMessage: '',
                lastTime: '',
                avatarUrl: undefined
            };
        }
        this.renderChatsList();
        if (chat.type === 'private') this.loadChatAvatar(chat.id, chat.name);
        this.switchChat(chat.id);
    }

    handleChatHistory(data: { chat_id: string; messages: Message[] }) {
        if (this.historyTimeout) clearTimeout(this.historyTimeout);
        const currentChatId = this.currentChatId;
        if (!this.isLoadingHistory || currentChatId !== data.chat_id) return;
        this.isLoadingHistory = false;

        const elements = this.app.ui.elements;
        elements.messagesContainer.innerHTML = '';
        elements.chatPlaceholder.classList.add('hidden');
        elements.messagesContainer.classList.remove('hidden');
        elements.chatHeader.classList.remove('hidden');
        elements.inputArea.classList.remove('hidden');

        data.messages.forEach(msg => this.addMessageToChat(msg));
        this.scrollMessagesToBottom();

        if (data.messages.length > 0) {
            const lastMsg = data.messages[data.messages.length - 1];
            if (this.chatsData[currentChatId!]) {
                const lastMessageText = lastMsg.is_deleted ? 'Сообщение удалено' : lastMsg.text;
                this.chatsData[currentChatId!].lastMessage = lastMessageText;
                this.chatsData[currentChatId!].lastTime = lastMsg.timestamp;
            }
            this.renderChatsList();
        }

        const chat = this.chatsData[currentChatId!];
        if (chat) {
            if (chat.type === 'private') {
                this.currentChatPartner = chat.name;
                elements.chatPartnerName.textContent = this.currentChatPartner;
                this.loadChatPartnerProfile(currentChatId!);
            } else if (chat.type === 'group') {
                this.currentChatPartner = null;
                elements.chatPartnerName.textContent = chat.name;
                this.clearChatHeaderAvatar();
            } else {
                this.currentChatPartner = null;
                elements.chatPartnerName.textContent = 'Общий чат';
                this.clearChatHeaderAvatar();
            }
        }
        elements.onlineStatus.textContent = '';
        elements.typingIndicator.classList.add('hidden');
        this.app.socket.emitChat('mark_read', { chat_id: this.currentChatId });

        if (isMobile()) this.app.ui.closeSidebar();
    }

    handleNewMessage(msg: Message) {
        if (this.chatsData[msg.chat_id]) {
            const lastMessageText = msg.is_deleted ? 'Сообщение удалено' : msg.text;
            this.chatsData[msg.chat_id].lastMessage = lastMessageText;
            this.chatsData[msg.chat_id].lastTime = msg.timestamp;
        }
        if (msg.user_id === this.app.currentUserId) {
            this.unreadCounts[msg.chat_id] = 0;
        }
        if (msg.chat_id === this.currentChatId) {
            this.addMessageToChat(msg);
            const container = this.app.ui.elements.messagesContainer;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
            if (isNearBottom) this.scrollMessagesToBottom();
            this.app.socket.emitChat('mark_read', { chat_id: this.currentChatId });
        } else {
            if (msg.user_id !== this.app.currentUserId) {
                this.unreadCounts[msg.chat_id] = (this.unreadCounts[msg.chat_id] || 0) + 1;
            }
        }
        this.renderChatsList();
    }

    handleUserOnline(data: { username: string }) {
        if (this.currentChatPartner === data.username) {
            this.app.ui.elements.onlineStatus.textContent = '● онлайн';
        }
    }

    handleUserOffline(data: { username: string }) {
        if (this.currentChatPartner === data.username) {
            this.app.ui.elements.onlineStatus.textContent = '○ офлайн';
        }
        if (this.currentTypingUsers.has(data.username)) {
            this.currentTypingUsers.delete(data.username);
            const chat = this.chatsData[this.currentChatId!];
            if (chat && chat.type !== 'private') {
                this.app.ui.elements.typingIndicator.classList.toggle('hidden', this.currentTypingUsers.size === 0);
            }
        }
    }

    handleTypingIndicator(data: { chat_id: string; username: string; typing: boolean }) {
        if (data.chat_id !== this.currentChatId) return;
        const chat = this.chatsData[this.currentChatId!];
        if (!chat) return;
        if (chat.type === 'private') {
            if (data.username === this.currentChatPartner) {
                this.app.ui.elements.typingIndicator.classList.toggle('hidden', !data.typing);
            }
        } else {
            if (data.typing) {
                this.currentTypingUsers.add(data.username);
            } else {
                this.currentTypingUsers.delete(data.username);
            }
            this.app.ui.elements.typingIndicator.classList.toggle('hidden', this.currentTypingUsers.size === 0);
        }
    }

    handleGroupCreated(chatInfo: any) {
        this.groupCreationInProgress = false;
        if (!this.chatsData[chatInfo.id]) {
            this.chatsData[chatInfo.id] = {
                id: chatInfo.id,
                name: chatInfo.name,
                type: chatInfo.type,
                lastMessage: '',
                lastTime: '',
                avatarUrl: undefined
            };
        }
        this.renderChatsList();
        this.switchChat(chatInfo.id);
    }

    handleGroupInfo(info: GroupInfo) {
        this.showGroupInfo(info);
    }

    handleGroupInfoUpdated(info: any) {
        if (this.currentChatId === info.id) {
            this.app.ui.updateGroupHeader(info);
        }
        const modal = document.getElementById('group-info-modal');
        if (modal && modal.style.display === 'block' && this.currentGroupInfo && this.currentGroupInfo.id === info.id) {
            this.showGroupInfo(info);
        }
    }

    handleRemovedFromGroup(data: { chat_id: string }) {
        this.app.ui.showNotification('Вас удалили из группы', true);
        delete this.chatsData[data.chat_id];
        this.renderChatsList();
        if (this.currentChatId === data.chat_id) this.resetToPlaceholder();
    }

    handleLeftGroup(data: { chat_id: string }) {
        this.app.ui.showNotification('Вы покинули группу', false);
        delete this.chatsData[data.chat_id];
        this.renderChatsList();
        if (this.currentChatId === data.chat_id) this.resetToPlaceholder();
        const modal = document.getElementById('group-info-modal');
        if (modal) modal.remove();
    }

    handleMessageDeleted(data: { message_id: number }) {
        const msgDiv = document.querySelector(`.message[data-message-id="${data.message_id}"]`) as HTMLElement;
        if (msgDiv) {
            msgDiv.classList.add('deleted');
            const bubble = msgDiv.querySelector('.bubble') as HTMLElement;
            if (bubble) {
                bubble.innerHTML = '<div class="message-text">Сообщение удалено</div>' + bubble.querySelector('.timestamp')?.outerHTML;
            }
            const actions = msgDiv.querySelector('.message-actions');
            if (actions) actions.remove();
        }
    }

    handleMessageEdited(data: Message) {
        const msgDiv = document.querySelector(`.message[data-message-id="${data.id}"]`) as HTMLElement;
        if (msgDiv && !msgDiv.classList.contains('deleted')) {
            const bubble = msgDiv.querySelector('.bubble') as HTMLElement;
            if (bubble) {
                const textDiv = bubble.querySelector('.message-text') as HTMLElement;
                if (textDiv) {
                    textDiv.innerHTML = escapeHtml(data.text) + '<span class="edited-indicator">ред.</span>';
                }
            }
        }
    }
}
