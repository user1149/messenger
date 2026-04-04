import React, { useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import Message from './Message';
import { Message as MessageType } from '../types';

interface MessageListProps {
  messages: MessageType[];
}

export const ChatMessageList: React.FC<MessageListProps> = ({ messages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentChatId, hasMoreHistory, loadMoreHistory, historyOffsets } = useChat();
  const loadingRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevLastMessageIdRef = useRef<number | null>(null);

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: MessageType[] }[] = [];
    messages.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString();
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === date) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date, messages: [msg] });
      }
    });
    return groups;
  };

  const groups = groupMessagesByDate();

  const handleScroll = useCallback(() => {
    if (!containerRef.current || !currentChatId) return;
    const { scrollTop } = containerRef.current;
    if (scrollTop <= 10 && hasMoreHistory[currentChatId] && !loadingRef.current) {
      loadingRef.current = true;
      const offset = historyOffsets[currentChatId] || 0;
      loadMoreHistory(currentChatId, offset);
      setTimeout(() => {
        loadingRef.current = false;
      }, 1000);
    }
  }, [currentChatId, hasMoreHistory, historyOffsets, loadMoreHistory]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const newLength = messages.length;
    const lastMessage = messages[messages.length - 1];
    const newLastId = lastMessage?.id ?? null;
    const prevLastId = prevLastMessageIdRef.current;

    const wasNewMessageAdded =
      newLength > prevMessagesLengthRef.current &&
      newLastId !== prevLastId &&
      (newLastId !== null && prevLastId !== null);

    if (wasNewMessageAdded) {
      container.scrollTop = container.scrollHeight;
    }

    prevMessagesLengthRef.current = newLength;
    prevLastMessageIdRef.current = newLastId;
  }, [messages]);

  return (
    <div className="messages-container" ref={containerRef}>
      {groups.map((group, i) => (
        <div key={i}>
          <div className="date-divider">{group.date}</div>
          {group.messages.map(msg => (
            <Message key={msg.id} message={msg} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default ChatMessageList;
