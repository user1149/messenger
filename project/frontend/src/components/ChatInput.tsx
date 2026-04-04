import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { showNotification } from './Common';

const ChatInput: React.FC = () => {
  const { currentChatId, sendMessage, socket } = useChat();
  const [text, setText] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTyping = () => {
    if (!currentChatId) return;
    const hasText = text.trim().length > 0;
    socket?.emitChat('typing', { chat_id: currentChatId, typing: hasText });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (hasText) {
      typingTimeoutRef.current = setTimeout(() => {
        if (currentChatId) {
          socket?.emitChat('typing', { chat_id: currentChatId, typing: false });
        }
      }, 2000);
    }
  };

  useEffect(() => {
    handleTyping();
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [text]);

  const handleSend = () => {
    if (!currentChatId) return;
    if (!text.trim()) return;
    if (text.length > 500) {
      showNotification('Сообщение слишком длинное', true);
      return;
    }
    sendMessage(text);
    setText('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket?.emitChat('typing', { chat_id: currentChatId, typing: false });
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-area">
      <input
        ref={inputRef}
        type="text"
        placeholder="Сообщение..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={!currentChatId}
        autoComplete="off"
      />
      <button onClick={handleSend} disabled={!currentChatId || !text.trim()}>
        <i className="fas fa-paper-plane"></i>
      </button>
    </div>
  );
};

export default ChatInput;
