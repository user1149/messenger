// socket.js
class SocketManager {
    constructor(app) {
        this.app = app;
        this.socket = null;
    }

    connect() {
        this.socket = io();
        this.setupHandlers();
    }

    setupHandlers() {
        this.socket.on('chat_list', this.handleChatList.bind(this));
        this.socket.on('unread_counts', this.handleUnreadCounts.bind(this));
        this.socket.on('chat_created', this.handleChatCreated.bind(this));
        this.socket.on('chat_history', this.handleChatHistory.bind(this));
        this.socket.on('new_message', this.handleNewMessage.bind(this));
        this.socket.on('user_online', this.handleUserOnline.bind(this));
        this.socket.on('user_offline', this.handleUserOffline.bind(this));
        this.socket.on('typing', this.handleTypingIndicator.bind(this));
        this.socket.on('error', (data) => {
            this.app.ui.showNotification('Ошибка: ' + data.message);
            this.app.chat.groupCreationInProgress = false;
        });
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('connect', this.handleReconnect.bind(this));
        this.socket.on('group_created', this.handleGroupCreated.bind(this));
        this.socket.on('group_info', this.handleGroupInfo.bind(this));
        this.socket.on('group_info_updated', this.handleGroupInfoUpdated.bind(this));
        this.socket.on('removed_from_group', this.handleRemovedFromGroup.bind(this));
        this.socket.on('left_group', this.handleLeftGroup.bind(this));
        this.socket.on('message_deleted', this.handleMessageDeleted.bind(this));
        this.socket.on('message_edited', this.handleMessageEdited.bind(this));
    }

    handleChatList(chats) {
        this.app.chat.chatsData = {};
        chats.forEach(c => {
            this.app.chat.chatsData[c.id] = {
                name: Utils.escapeHtml(c.name),
                type: c.type,
                lastMessage: c.lastMessage || '',
                lastTime: c.lastTime || '',
            };
        });
        this.app.chat.renderChatsList();

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
            };
        }
        this.app.chat.renderChatsList();
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
            } else if (chat.type === 'group') {
                this.app.chat.currentChatPartner = null;
                elements.chatPartnerName.textContent = chat.name;
            } else {
                this.app.chat.currentChatPartner = null;
                elements.chatPartnerName.textContent = 'Общий чат';
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
                lastTime: ''
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
