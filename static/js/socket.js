// static/js/socket.js
const SocketManager = class {
    constructor(app) {
        this.app = app;
        this.socket = null;
        this.manualDisconnect = false;
    }

    connect() {
        this.socket = io({
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ['websocket', 'polling']
        });
        this.setupHandlers();
    }

    setupHandlers() {
        this.socket.on('chat_list', (data) => {
            try {
                this.handleChatList(data);
            } catch (e) {
                console.error('Error in chat_list handler:', e);
            }
        });
        this.socket.on('unread_counts', (data) => {
            try {
                this.handleUnreadCounts(data);
            } catch (e) {
                console.error('Error in unread_counts handler:', e);
            }
        });
        this.socket.on('chat_created', (data) => {
            try {
                this.handleChatCreated(data);
            } catch (e) {
                console.error('Error in chat_created handler:', e);
            }
        });
        this.socket.on('chat_history', (data) => {
            try {
                this.handleChatHistory(data);
            } catch (e) {
                console.error('Error in chat_history handler:', e);
            }
        });
        this.socket.on('new_message', (data) => {
            try {
                this.handleNewMessage(data);
            } catch (e) {
                console.error('Error in new_message handler:', e);
            }
        });
        this.socket.on('user_online', (data) => {
            try {
                this.handleUserOnline(data);
            } catch (e) {
                console.error('Error in user_online handler:', e);
            }
        });
        this.socket.on('user_offline', (data) => {
            try {
                this.handleUserOffline(data);
            } catch (e) {
                console.error('Error in user_offline handler:', e);
            }
        });
        this.socket.on('typing', (data) => {
            try {
                this.handleTypingIndicator(data);
            } catch (e) {
                console.error('Error in typing handler:', e);
            }
        });
        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.app.ui.showNotification('Ошибка: ' + (data?.message || 'Неизвестная ошибка'));
            this.app.chat.groupCreationInProgress = false;
        });
        this.socket.on('disconnect', (reason) => {
            console.warn('Socket disconnected:', reason);
            this.handleDisconnect();
        });
        this.socket.on('connect', (data) => {
            try {
                this.handleReconnect();
            } catch (e) {
                console.error('Error in connect handler:', e);
            }
        });
        this.socket.on('group_created', (data) => {
            try {
                this.handleGroupCreated(data);
            } catch (e) {
                console.error('Error in group_created handler:', e);
            }
        });
        this.socket.on('group_info', (data) => {
            try {
                this.handleGroupInfo(data);
            } catch (e) {
                console.error('Error in group_info handler:', e);
            }
        });
        this.socket.on('group_info_updated', (data) => {
            try {
                this.handleGroupInfoUpdated(data);
            } catch (e) {
                console.error('Error in group_info_updated handler:', e);
            }
        });
        this.socket.on('removed_from_group', (data) => {
            try {
                this.handleRemovedFromGroup(data);
            } catch (e) {
                console.error('Error in removed_from_group handler:', e);
            }
        });
        this.socket.on('left_group', (data) => {
            try {
                this.handleLeftGroup(data);
            } catch (e) {
                console.error('Error in left_group handler:', e);
            }
        });
        this.socket.on('message_deleted', (data) => {
            try {
                this.handleMessageDeleted(data);
            } catch (e) {
                console.error('Error in message_deleted handler:', e);
            }
        });
        this.socket.on('message_edited', (data) => {
            try {
                this.handleMessageEdited(data);
            } catch (e) {
                console.error('Error in message_edited handler:', e);
            }
        });
    }

    handleChatList(chats) {
        this.app.chat.chatsData = {};
        chats.forEach(c => {
            this.app.chat.chatsData[c.id] = {
                name: Utils.escapeHtml(c.name),
                type: c.type,
                lastMessage: c.lastMessage || '',
                lastTime: c.lastTime || '',
                avatarUrl: null
            };
        });
        this.app.chat.renderChatsList();

        Object.entries(this.app.chat.chatsData).forEach(([chatId, chat]) => {
            if (chat.type === 'private') {
                this.app.chat.loadChatAvatar(chatId, chat.name);
            }
        });

        if (!this.app.chat.currentChatId) {
            this.app.ui.updateHeaderForNoChat();
            if (Utils.isMobile()) this.app.ui.openSidebar();
        } else {
            const chat = this.app.chat.chatsData[this.app.chat.currentChatId];
            if (chat) {
                this.app.ui.elements.chatPartnerName.textContent =
                    chat.type === 'private' ? chat.name : (chat.type === 'group' ? chat.name : 'Общий чат');
            }
        }
    }

    handleUnreadCounts(counts) {
        this.app.chat.unreadCounts = counts;
        this.app.chat.renderChatsList();
    }

    handleChatCreated(chat) {
        if (!this.app.chat.chatsData[chat.id]) {
            this.app.chat.chatsData[chat.id] = {
                name: Utils.escapeHtml(chat.name),
                type: chat.type,
                lastMessage: '',
                lastTime: '',
                avatarUrl: null
            };
        }
        this.app.chat.renderChatsList();
        if (chat.type === 'private') {
            this.app.chat.loadChatAvatar(chat.id, chat.name);
        }
        this.app.chat.switchChat(chat.id);
    }

    handleChatHistory(data) {
        clearTimeout(this.app.chat.historyTimeout);
        const currentChatId = this.app.chat.currentChatId;
        if (!this.app.chat.isLoadingHistory || currentChatId !== data.chat_id) return;
        this.app.chat.isLoadingHistory = false;

        const elements = this.app.ui.elements;
        elements.messagesContainer.innerHTML = '';
        elements.chatPlaceholder.classList.add('hidden');
        elements.messagesContainer.classList.remove('hidden');
        elements.chatHeader.classList.remove('hidden');
        elements.inputArea.classList.remove('hidden');

        data.messages.forEach(msg => this.app.chat.addMessageToChat(msg));
        this.app.chat.scrollMessagesToBottom();

        if (data.messages.length > 0) {
            const lastMsg = data.messages[data.messages.length - 1];
            if (this.app.chat.chatsData[currentChatId]) {
                const lastMessageText = lastMsg.is_deleted ? 'Сообщение удалено' : lastMsg.text;
                this.app.chat.chatsData[currentChatId].lastMessage = lastMessageText;
                this.app.chat.chatsData[currentChatId].lastTime = lastMsg.timestamp;
            }
            this.app.chat.renderChatsList();
        }

        const chat = this.app.chat.chatsData[currentChatId];
        if (chat) {
            if (chat.type === 'private') {
                this.app.chat.currentChatPartner = chat.name;
                elements.chatPartnerName.textContent = this.app.chat.currentChatPartner;
                this.app.chat.loadChatPartnerProfile(currentChatId);
            } else if (chat.type === 'group') {
                this.app.chat.currentChatPartner = null;
                elements.chatPartnerName.textContent = chat.name;
                this.app.chat.clearChatHeaderAvatar();
            } else {
                this.app.chat.currentChatPartner = null;
                elements.chatPartnerName.textContent = 'Общий чат';
                this.app.chat.clearChatHeaderAvatar();
            }
        }
        elements.onlineStatus.textContent = '';
        elements.typingIndicator.classList.add('hidden');
        this.socket.emit('mark_read', { chat_id: this.app.chat.currentChatId });

        if (Utils.isMobile()) this.app.ui.closeSidebar();
    }

    handleNewMessage(msg) {
        if (this.app.chat.chatsData[msg.chat_id]) {
            const lastMessageText = msg.is_deleted ? 'Сообщение удалено' : msg.text;
            this.app.chat.chatsData[msg.chat_id].lastMessage = lastMessageText;
            this.app.chat.chatsData[msg.chat_id].lastTime = msg.timestamp;
        }

        if (msg.nickname === this.app.currentUsername) {
            this.app.chat.unreadCounts[msg.chat_id] = 0;
        }

        if (msg.chat_id === this.app.chat.currentChatId) {
            this.app.chat.addMessageToChat(msg);
            const container = this.app.ui.elements.messagesContainer;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
            if (isNearBottom) this.app.chat.scrollMessagesToBottom();
            this.socket.emit('mark_read', { chat_id: this.app.chat.currentChatId });
        } else {
            if (msg.nickname !== this.app.currentUsername) {
                this.app.chat.unreadCounts[msg.chat_id] = (this.app.chat.unreadCounts[msg.chat_id] || 0) + 1;
            }
        }
        this.app.chat.renderChatsList();
    }

    handleUserOnline(data) {
        if (this.app.chat.currentChatPartner === data.username) {
            this.app.ui.elements.onlineStatus.textContent = '● онлайн';
        }
    }

    handleUserOffline(data) {
        if (this.app.chat.currentChatPartner === data.username) {
            this.app.ui.elements.onlineStatus.textContent = '○ офлайн';
        }
        if (this.app.chat.currentTypingUsers.has(data.username)) {
            this.app.chat.currentTypingUsers.delete(data.username);
            const chat = this.app.chat.chatsData[this.app.chat.currentChatId];
            if (chat && chat.type !== 'private') {
                this.app.ui.elements.typingIndicator.classList.toggle('hidden', this.app.chat.currentTypingUsers.size === 0);
            }
        }
    }

    handleTypingIndicator(data) {
        if (data.chat_id !== this.app.chat.currentChatId) return;
        const chat = this.app.chat.chatsData[this.app.chat.currentChatId];
        if (!chat) return;

        if (chat.type === 'private') {
            if (data.username === this.app.chat.currentChatPartner) {
                this.app.ui.elements.typingIndicator.classList.toggle('hidden', !data.typing);
            }
        } else {
            if (data.typing) {
                this.app.chat.currentTypingUsers.add(data.username);
            } else {
                this.app.chat.currentTypingUsers.delete(data.username);
            }
            this.app.ui.elements.typingIndicator.classList.toggle('hidden', this.app.chat.currentTypingUsers.size === 0);
        }
    }

    handleDisconnect() {
        if (this.manualDisconnect) {
            this.manualDisconnect = false;
            return;
        }
        this.app.ui.showNotification('Соединение потеряно. Попытка восстановить...', false);
        this.disableInput(true);
        this.app.chat.currentTypingUsers.clear();
        this.app.ui.elements.typingIndicator.classList.add('hidden');
    }

    handleReconnect() {
        this.app.ui.showNotification('Соединение восстановлено.', false);
        this.disableInput(false);
        if (this.app.chat.currentChatId) this.app.chat.switchChat(this.app.chat.currentChatId);
    }

    disableInput(disabled) {
        this.app.ui.elements.sendBtn.disabled = disabled;
        this.app.ui.elements.messageInput.disabled = disabled;
    }

    handleGroupCreated(chatInfo) {
        this.app.chat.groupCreationInProgress = false;
        if (!this.app.chat.chatsData[chatInfo.id]) {
            this.app.chat.chatsData[chatInfo.id] = {
                name: Utils.escapeHtml(chatInfo.name),
                type: chatInfo.type,
                lastMessage: '',
                lastTime: '',
                avatarUrl: null
            };
        }
        this.app.chat.renderChatsList();
        this.app.chat.switchChat(chatInfo.id);
    }

    handleGroupInfo(info) {
        this.app.chat.showGroupInfo(info);
    }

    handleGroupInfoUpdated(info) {
        if (this.app.chat.currentChatId === info.id) {
            this.app.ui.updateGroupHeader(info);
        }
        const modal = document.getElementById('group-info-modal');
        if (modal && modal.style.display === 'block' && this.app.chat.currentGroupInfo && this.app.chat.currentGroupInfo.id === info.id) {
            this.app.chat.showGroupInfo(info);
        }
    }

    handleRemovedFromGroup(data) {
        this.app.ui.showNotification('Вас удалили из группы', true);
        delete this.app.chat.chatsData[data.chat_id];
        this.app.chat.renderChatsList();
        if (this.app.chat.currentChatId === data.chat_id) {
            this.app.chat.resetToPlaceholder();
        }
    }

    handleLeftGroup(data) {
        this.app.ui.showNotification('Вы покинули группу', false);
        delete this.app.chat.chatsData[data.chat_id];
        this.app.chat.renderChatsList();
        if (this.app.chat.currentChatId === data.chat_id) {
            this.app.chat.resetToPlaceholder();
        }
        const modal = document.getElementById('group-info-modal');
        if (modal && modal.style.display === 'block') {
            modal.style.display = 'none';
            modal.remove();
        }
    }

    handleMessageDeleted(data) {
        const msgDiv = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
        if (msgDiv) {
            msgDiv.classList.add('deleted');
            const bubble = msgDiv.querySelector('.bubble');
            if (bubble) {
                bubble.innerHTML = '<div class="message-text">Сообщение удалено</div>' + bubble.querySelector('.timestamp').outerHTML;
            }
            const actions = msgDiv.querySelector('.message-actions');
            if (actions) actions.remove();
        }
    }

    handleMessageEdited(data) {
        const msgDiv = document.querySelector(`.message[data-message-id="${data.id}"]`);
        if (msgDiv && !msgDiv.classList.contains('deleted')) {
            const bubble = msgDiv.querySelector('.bubble');
            if (bubble) {
                const textDiv = bubble.querySelector('.message-text');
                if (textDiv) {
                    textDiv.innerHTML = Utils.escapeHtml(data.text) + '<span class="edited-indicator">ред.</span>';
                }
            }
        }
    }
}
