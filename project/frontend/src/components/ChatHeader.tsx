import React from 'react';
import { useChat } from '../contexts/ChatContext';

interface ChatHeaderProps {
  onBack?: () => void;
}

const formatLastSeen = (lastSeenStr: string | null): string => {
  if (!lastSeenStr) return 'был(а) недавно';
  const lastSeen = new Date(lastSeenStr);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'был(а) только что';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return lastSeen.toLocaleDateString();
};

const ChatHeader: React.FC<ChatHeaderProps> = ({ onBack }) => {
  const { chats, currentChatId, currentChatPartnerId, getOnlineStatus, getLastSeen, getTypingUsernames } = useChat();
  const chat = currentChatId ? chats[currentChatId] : null;
  const isGroup = chat?.type === 'group';
  const isPrivate = chat?.type === 'private';

  const avatarUrl = chat?.avatarUrl;
  const partnerName = chat?.name || 'Chat';

  const handleAvatarClick = () => {
    if (isPrivate && currentChatPartnerId) {
      window.dispatchEvent(new CustomEvent('openUserProfileModal', { detail: { userId: currentChatPartnerId } }));
    }
  };

  const typingUsernames = currentChatId ? getTypingUsernames(currentChatId) : [];
  const typingText = typingUsernames.length > 0 ? `Печатает: ${typingUsernames.join(', ')}` : '';

  const isOnline = isPrivate && getOnlineStatus(partnerName);
  const lastSeenStr = isPrivate ? getLastSeen(partnerName) : null;

  return (
    <div className="chat-header">
      {onBack && (
        <button className="back-button" onClick={onBack}>
          <i className="fas fa-arrow-left"></i>
        </button>
      )}
      <div className="chat-header-avatar" onClick={handleAvatarClick}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <div className="avatar-placeholder">{partnerName.charAt(0).toUpperCase()}</div>
        )}
      </div>
      <div className="chat-header-info">
        <div className="chat-partner-name">{partnerName}</div>
        <div className="online-status">
          {isPrivate ? (
            isOnline ? (
              <span className="online">● онлайн</span>
            ) : (
              <span className="offline">○ {formatLastSeen(lastSeenStr)}</span>
            )
          ) : typingText ? (
            <span className="typing-text">{typingText}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
