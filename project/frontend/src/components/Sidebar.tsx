import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '../contexts/ChatContext';
import { usersAPI } from '../services/api';
import { debounce, escapeHtml, formatTime } from '../services/utils';
import { UserMenu } from './Common';
import { showNotification } from './Common';

// Search Component
const Search: React.FC = () => {
  const { socket } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: number; username: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const performSearch = debounce(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    try {
      const users = await usersAPI.search(q);
      setResults(users);
      setShowResults(true);
    } catch (err) {
      showNotification('Ошибка поиска', true);
    }
  }, 300);

  useEffect(() => {
    performSearch(query);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelect = (username: string) => {
    setQuery('');
    setShowResults(false);
    socket?.emitChat('create_private_chat', { username });
  };

  return (
    <div className="search-wrapper" ref={searchRef}>
      <i className="fas fa-search search-icon"></i>
      <input
        type="text"
        placeholder="Поиск пользователей..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {showResults && (
        <div className="search-results show">
          {results.length === 0 ? (
            <div className="empty-message">Не найдено</div>
          ) : (
            results.map(user => (
              <div key={user.id} className="result-item" onClick={() => handleSelect(user.username)}>
                <span className="avatar">{user.username.charAt(0).toUpperCase()}</span>
                <span className="username">{user.username}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Chat List Component
const ChatListComponent: React.FC = () => {
  const { chats, currentChatId, unreadCounts, switchChat } = useChat();

  const sortedChats = useMemo(() => {
    return Object.values(chats).sort((a, b) => {
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
    });
  }, [chats]);

  if (sortedChats.length === 0) {
    return (
      <div className="chats-empty">
        <i className="fas fa-comments"></i>
        <p>Нет чатов</p>
      </div>
    );
  }

  return (
    <>
      {sortedChats.map(chat => (
        <div
          key={chat.id}
          className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
          onClick={() => switchChat(chat.id)}
        >
          <div className="chat-avatar">
            {chat.avatarUrl ? (
              <img src={chat.avatarUrl} alt="" />
            ) : chat.type === 'group' ? (
              <i className="fas fa-users"></i>
            ) : (
              chat.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="chat-info">
            <div className="chat-name">
              {chat.type === 'group' && <i className="fas fa-users"></i>}
              {escapeHtml(chat.name)}
            </div>
            <div className="chat-last-msg">{escapeHtml(chat.lastMessage?.substring(0, 30) || '')}</div>
          </div>
          <div className="chat-meta">
            {unreadCounts[chat.id] > 0 && (
              <span className="unread-badge">{unreadCounts[chat.id]}</span>
            )}
            <span className="chat-time">{formatTime(chat.lastTime || '')}</span>
          </div>
        </div>
      ))}
    </>
  );
};

// Main Sidebar Component
export const Sidebar: React.FC = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <UserMenu />
        <Search />
      </div>
      <div className="sidebar-section">
        <div className="section-title">Сообщения</div>
        <div className="chats-list">
          <ChatListComponent />
        </div>
      </div>
    </div>
  );
};
