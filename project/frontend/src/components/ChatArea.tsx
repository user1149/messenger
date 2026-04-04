import React from 'react';
import { useChat } from '../contexts/ChatContext';
import ChatHeader from './ChatHeader';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatAreaProps {
  onBack?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onBack }) => {
  const { currentChatId, isLoadingHistory, messages } = useChat();

  if (!currentChatId && !isLoadingHistory) {
    return (
      <div className="chat-placeholder">
        <div className="placeholder-icon">
          <i className="fas fa-comment-dots"></i>
        </div>
        <div className="placeholder-title">Мессенджер</div>
        <div className="placeholder-sub">Выберите чат, чтобы начать</div>
      </div>
    );
  }

  if (isLoadingHistory) {
    return (
      <div className="chat-area">
        <ChatHeader onBack={onBack} />
        <div className="loading-screen" style={{ position: 'relative', background: 'transparent' }}>
          <div className="loader"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <ChatHeader onBack={onBack} />
      <ChatMessageComponent messages={messages} />
      <ChatInput />
    </div>
  );
};
