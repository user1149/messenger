// main.js
class ChatApplication {
    constructor() {
        this.currentUserId = null;
        this.currentUsername = '';
        this.isResizing = false;
        this.ui = new UI(this);
        this.auth = new Auth(this);
        this.chat = new Chat(this);
        this.socket = new SocketManager(this);
        this.profile = new ProfileManager(this);
        this.init();
    }

    init() {
        this.bindEvents();
        this.auth.tryAutoLogin();
    }

    bindEvents() {
        this.ui.elements.authToggle.addEventListener('click', () => this.auth.toggleMode());
        this.ui.elements.authSubmit.addEventListener('click', () => this.auth.handleAuth());
        this.ui.elements.authPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.auth.handleAuth();
        });
        this.ui.elements.sendBtn.addEventListener('click', () => this.chat.sendMessage());
        this.ui.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.chat.sendMessage();
        });
        this.ui.elements.messageInput.addEventListener('input', () => this.chat.handleTyping());
        this.ui.elements.sidebarUserSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                this.ui.elements.sidebarSearchResults.classList.remove('visible');
                return;
            }
            this.chat.searchDebounced(query);
        });
        this.ui.elements.sidebarUserSearch.addEventListener('focus', () => {
            if (this.ui.elements.sidebarUserSearch.value.trim().length >= 2) {
                this.ui.elements.sidebarSearchResults.classList.add('visible');
            }
        });
        document.addEventListener('click', (e) => {
            if (!this.ui.elements.sidebarUserSearch.contains(e.target) && !this.ui.elements.sidebarSearchResults.contains(e.target)) {
                this.ui.elements.sidebarSearchResults.classList.remove('visible');
            }
        });
    }
}

new ChatApplication();
