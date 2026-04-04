import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { useChat } from '../contexts/ChatContext';
import { isMobile } from '../services/utils';

export const MainLayout: React.FC = () => {
  const { currentChatId } = useChat();
  const [isMobileDevice, setIsMobileDevice] = useState(isMobile());
  const [showSidebar, setShowSidebar] = useState(!isMobileDevice || !currentChatId);

  useEffect(() => {
    const handleResize = () => {
      const mobile = isMobile();
      setIsMobileDevice(mobile);
      if (mobile) {
        setShowSidebar(!currentChatId);
      } else {
        setShowSidebar(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentChatId]);

  const toggleSidebar = () => setShowSidebar(prev => !prev);

  return (
    <div className={`main-panel ${isMobileDevice && currentChatId ? 'chat-open' : ''}`}>
      {showSidebar && <Sidebar />}
      <ChatArea onBack={toggleSidebar} />
    </div>
  );
};
