import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { MainLayout } from './components/Layout';
import { AuthOverlay } from './components/Auth';
import { Loader, Notification } from './components/Common';
import { useAuth } from './contexts/AuthContext';
import { ProfileModal, CreateGroupModal, UserProfileModal } from './components/Modals';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    const handleOpenProfile = () => {
      console.log('Opening profile modal');
      setProfileModalOpen(true);
    };

    const handleOpenCreateGroup = () => {
      console.log('Opening create group modal');
      setCreateGroupModalOpen(true);
    };

    const handleOpenUserProfile = (e: CustomEvent<{ userId: number }>) => {
      console.log('Opening user profile modal for user:', e.detail.userId);
      setSelectedUserId(e.detail.userId);
      setUserProfileModalOpen(true);
    };

    window.addEventListener('openProfileModal', handleOpenProfile);
    window.addEventListener('openCreateGroupModal', handleOpenCreateGroup);
    window.addEventListener('openUserProfileModal', handleOpenUserProfile as EventListener);

    return () => {
      window.removeEventListener('openProfileModal', handleOpenProfile);
      window.removeEventListener('openCreateGroupModal', handleOpenCreateGroup);
      window.removeEventListener('openUserProfileModal', handleOpenUserProfile as EventListener);
    };
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    return <AuthOverlay />;
  }

  return (
    <>
      <MainLayout />
      <Notification />
      {profileModalOpen && (
        <ProfileModal
          onClose={() => {
            console.log('Closing profile modal');
            setProfileModalOpen(false);
          }}
        />
      )}
      {createGroupModalOpen && (
        <CreateGroupModal
          onClose={() => {
            console.log('Closing create group modal');
            setCreateGroupModalOpen(false);
          }}
        />
      )}
      {userProfileModalOpen && selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => {
            console.log('Closing user profile modal');
            setUserProfileModalOpen(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AuthProvider>
  );
};
