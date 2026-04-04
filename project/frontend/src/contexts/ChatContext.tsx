import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import { Chat, Message, GroupInfo } from '../types';
import { SocketManager, ChatEventHandlers } from '../services/SocketManager';
import { usersAPI } from '../services/api';
import { showNotification } from '../components/Notification';

interface ChatContextType {
  chats: Record<string, Chat>;
  currentChatId: string | null;
  messages: Message[];
  unreadCounts: Record<string, number>;
  typingUsers: Map<string, Set<string>>;
  isLoadingHistory: boolean;
  currentChatPartnerId: number | null;
  groupInfo: GroupInfo | null;
  hasMoreHistory: Record<string, boolean>;
  loadMoreHistory: (chatId: string, offset: number) => void;
  historyOffsets: Record<string, number>;
  setCurrentChatId: (id: string | null) => void;
  sendMessage: (text: string) => void;
  switchChat: (chatId: string) => void;
  loadChatAvatar: (chatId: string, username: string) => Promise<void>;
  createGroup: (name: string, description: string, memberIds: number[]) => void;
  addUserToGroup: (chatId: string, userId: number) => void;
  removeUserFromGroup: (chatId: string, userId: number) => void;
  leaveGroup: (chatId: string) => void;
  fetchGroupInfo: (chatId: string) => void;
  deleteMessage: (messageId: number) => void;
  editMessage: (messageId: number, newText: string) => void;
  socket: SocketManager | null;
  onlineStatuses: Record<string, boolean>;
  lastSeen: Record<string, string>;
  getOnlineStatus: (username: string) => boolean;
  getLastSeen: (username: string) => string | null;
  getTypingUsernames: (chatId: string) => string[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // State
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentChatPartnerId, setCurrentChatPartnerId] = useState<number | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [socket, setSocket] = useState<SocketManager | null>(null);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const [hasMoreHistory, setHasMoreHistory] = useState<Record<string, boolean>>({});
  const [historyOffsets, setHistoryOffsets] = useState<Record<string, number>>({});

  // Refs
  const currentChatIdRef = useRef(currentChatId);
  const userRef = useRef(user);
  const chatsRef = useRef(chats);
  const unreadCountsRef = useRef(unreadCounts);
  const typingUsersRef = useRef(typingUsers);
  const onlineStatusesRef = useRef(onlineStatuses);
  const lastSeenRef = useRef(lastSeen);

  // Cache
  const avatarCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    unreadCountsRef.current = unreadCounts;
  }, [unreadCounts]);

  useEffect(() => {
    typingUsersRef.current = typingUsers;
  }, [typingUsers]);

  useEffect(() => {
    onlineStatusesRef.current = onlineStatuses;
  }, [onlineStatuses]);

  useEffect(() => {
    lastSeenRef.current = lastSeen;
  }, [lastSeen]);

  // Handlers
  const handlers = useRef<ChatEventHandlers>({
    onChatList: (data: any[]) => {
      const newChats: Record<string, Chat> = {};
      data.forEach(c => {
        newChats[c.id] = {
          id: c.id,
          name: c.name,
          type: c.type,
          lastMessage: c.lastMessage || '',
          lastTime: c.lastTime || '',
          avatarUrl: c.avatarUrl || undefined,
        };
      });
      setChats(newChats);
    },

    onUnreadCounts: (data: Record<string, number>) => {
      setUnreadCounts(data);
    },

    onChatCreated: (chat: any) => {
      setChats(prev => ({
        ...prev,
        [chat.id]: {
          id: chat.id,
          name: chat.name,
          type: chat.type,
          lastMessage: '',
          lastTime: '',
          avatarUrl: undefined,
        },
      }));
      setCurrentChatId(chat.id);
    },

    onChatHistory: (data: { chat_id: string; messages: Message[] }) => {
      if (data.chat_id === currentChatIdRef.current) {
        setMessages(data.messages);
        setIsLoadingHistory(false);
        socket?.emitChat('mark_read', { chat_id: currentChatIdRef.current });
      }
    },

    onChatHistoryMore: (data: any) => {
      if (data.chat_id && data.chat_id === currentChatIdRef.current) {
        setMessages(prev => [...data.messages, ...prev]);
        setHasMoreHistory(prev => ({ ...prev, [data.chat_id]: data.has_more }));
        setHistoryOffsets(prev => ({ ...prev, [data.chat_id]: data.offset + data.messages.length }));
      }
    },

    onNewMessage: (msg: Message) => {
      setChats(prev => {
        const chat = prev[msg.chat_id];
        if (chat) {
          const lastMessageText = msg.is_deleted ? 'Сообщение удалено' : msg.text;
          return {
            ...prev,
            [msg.chat_id]: {
              ...chat,
              lastMessage: lastMessageText,
              lastTime: msg.timestamp,
            },
          };
        }
        return prev;
      });

      if (msg.chat_id === currentChatIdRef.current) {
        setMessages(prev => [...prev, msg]);
        socket?.emitChat('mark_read', { chat_id: currentChatIdRef.current });
      } else {
        if (msg.user_id !== userRef.current?.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [msg.chat_id]: (prev[msg.chat_id] || 0) + 1,
          }));
        }
      }
    },

    onTyping: (data: { chat_id: string; username: string; typing: boolean }) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const currentSet = newMap.get(data.chat_id) || new Set();
        if (data.typing) {
          currentSet.add(data.username);
        } else {
          currentSet.delete(data.username);
        }
        newMap.set(data.chat_id, currentSet);
        return newMap;
      });
    },

    onMessageDeleted: (data: { message_id: number }) => {
      setMessages(prev =>
        prev.map(m => (m.id === data.message_id ? { ...m, is_deleted: true, text: '' } : m))
      );
    },

    onMessageEdited: (data: Message) => {
      setMessages(prev =>
        prev.map(m => (m.id === data.id ? { ...m, text: data.text, edited: true } : m))
      );
    },

    onUserOnline: (data: { username: string }) => {
      setOnlineStatuses(prev => ({ ...prev, [data.username]: true }));
    },

    onUserOffline: (data: { username: string; last_seen: string }) => {
      setOnlineStatuses(prev => ({ ...prev, [data.username]: false }));
      setLastSeen(prev => ({ ...prev, [data.username]: data.last_seen }));
    },

    onGroupCreated: (groupInfo: any) => {
      setChats(prev => ({
        ...prev,
        [groupInfo.id]: {
          id: groupInfo.id,
          name: groupInfo.name,
          type: 'group',
          lastMessage: '',
          lastTime: '',
          avatarUrl: undefined,
        },
      }));
      if (groupInfo.created_by === userRef.current?.id) {
        setCurrentChatId(groupInfo.id);
      } else {
        socket?.emitChat('join_chat', { chat_id: groupInfo.id });
      }
    },

    onGroupInfo: (info: GroupInfo) => {
      setGroupInfo(info);
      setChats(prev => ({
        ...prev,
        [info.id]: {
          ...prev[info.id],
          name: info.name,
        },
      }));
    },

    onGroupInfoUpdated: (data: any) => {
      if (currentChatIdRef.current === data.id) {
        setChats(prev => ({
          ...prev,
          [data.id]: { ...prev[data.id], name: data.name },
        }));
      }
    },

    onAddedToGroup: (data: { chat_id: string }) => {
      socket?.emitGroup('get_group_info', { chat_id: data.chat_id });
      socket?.emitChat('join_chat', { chat_id: data.chat_id });
    },

    onRemovedFromGroup: (data: { chat_id: string }) => {
      setChats(prev => {
        const newChats = { ...prev };
        delete newChats[data.chat_id];
        return newChats;
      });
      if (currentChatIdRef.current === data.chat_id) {
        setCurrentChatId(null);
      }
    },

    onLeftGroup: (data: { chat_id: string }) => {
      setChats(prev => {
        const newChats = { ...prev };
        delete newChats[data.chat_id];
        return newChats;
      });
      if (currentChatIdRef.current === data.chat_id) {
        setCurrentChatId(null);
      }
    },

    onDisconnect: (reason: string) => {
      console.warn('Socket disconnected:', reason);
      showNotification('Соединение потеряно, попытка восстановления...', true);
    },

    onReconnect: () => {
      showNotification('Соединение восстановлено', false);
      socket?.emitChat('get_chat_list', {});
      if (currentChatIdRef.current) {
        socket?.emitChat('join_chat', { chat_id: currentChatIdRef.current });
      }
    },

    onError: (data: any) => {
      console.error('Socket error:', data);
      showNotification(data.message || 'Ошибка соединения', true);
    },
  }).current;

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = new SocketManager(handlers);
    newSocket.connect();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, handlers]);

  useEffect(() => {
    Object.entries(chats).forEach(([chatId, chat]) => {
      if (chat.type === 'private' && !chat.avatarUrl) {
        const cached = avatarCache.current.get(chat.name);
        if (cached) {
          setChats(prev => ({
            ...prev,
            [chatId]: { ...prev[chatId], avatarUrl: cached },
          }));
          return;
        }
        usersAPI.getProfileByUsername(chat.name)
          .then(userData => {
            if (userData.avatar_url) {
              avatarCache.current.set(chat.name, userData.avatar_url);
              setChats(prev => ({
                ...prev,
                [chatId]: { ...prev[chatId], avatarUrl: userData.avatar_url },
              }));
            }
          })
          .catch(console.error);
      }
    });
  }, [chats]);

  const loadPartnerId = useCallback(async (chatId: string) => {
    const chat = chats[chatId];
    if (!chat || chat.type !== 'private') return;
    try {
      const userData = await usersAPI.getProfileByUsername(chat.name);
      setCurrentChatPartnerId(userData.id);
    } catch (err) {
      console.error(err);
    }
  }, [chats]);

  const sendMessage = useCallback((text: string) => {
    if (!currentChatId || !socket) return;
    socket.emitChat('new_message', { chat_id: currentChatId, text });
  }, [currentChatId, socket]);

  const switchChat = useCallback((chatId: string) => {
    if (!socket) return;
    if (currentChatId) {
      socket.emitChat('typing', { chat_id: currentChatId, typing: false });
    }
    setCurrentChatId(chatId);
    setIsLoadingHistory(true);
    setMessages([]);
    setHasMoreHistory(prev => ({ ...prev, [chatId]: false }));
    setHistoryOffsets(prev => ({ ...prev, [chatId]: 0 }));
    socket.emitChat('join_chat', { chat_id: chatId });

    const chat = chats[chatId];
    if (chat && chat.type === 'private') {
      loadPartnerId(chatId);
    }
  }, [socket, currentChatId, chats, loadPartnerId]);

  const loadMoreHistory = useCallback((chatId: string, offset: number) => {
    if (!socket) return;
    socket.emitChat('load_more_history', { chat_id: chatId, offset });
  }, [socket]);

  const loadChatAvatar = useCallback(async (chatId: string, username: string) => {
    if (avatarCache.current.has(username)) {
      const url = avatarCache.current.get(username)!;
      setChats(prev => ({
        ...prev,
        [chatId]: { ...prev[chatId], avatarUrl: url },
      }));
      return;
    }
    try {
      const userData = await usersAPI.getProfileByUsername(username);
      if (userData.avatar_url) {
        avatarCache.current.set(username, userData.avatar_url);
        setChats(prev => ({
          ...prev,
          [chatId]: { ...prev[chatId], avatarUrl: userData.avatar_url },
        }));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const createGroup = useCallback((name: string, description: string, memberIds: number[]) => {
    if (!socket) return;
    socket.emitGroup('create_group', { name, description, member_ids: memberIds });
  }, [socket]);

  const addUserToGroup = useCallback((chatId: string, userId: number) => {
    socket?.emitGroup('add_to_group', { chat_id: chatId, user_id: userId });
  }, [socket]);

  const removeUserFromGroup = useCallback((chatId: string, userId: number) => {
    socket?.emitGroup('remove_from_group', { chat_id: chatId, user_id: userId });
  }, [socket]);

  const leaveGroup = useCallback((chatId: string) => {
    if (window.confirm('Вы уверены, что хотите покинуть группу?')) {
      socket?.emitGroup('leave_group', { chat_id: chatId });
    }
  }, [socket]);

  const fetchGroupInfo = useCallback((chatId: string) => {
    socket?.emitGroup('get_group_info', { chat_id: chatId });
  }, [socket]);

  const deleteMessage = useCallback((messageId: number) => {
    if (!currentChatId) return;
    socket?.emitChat('delete_message', { chat_id: currentChatId, message_id: messageId });
  }, [currentChatId, socket]);

  const editMessage = useCallback((messageId: number, newText: string) => {
    if (!currentChatId) return;
    socket?.emitChat('edit_message', {
      chat_id: currentChatId,
      message_id: messageId,
      text: newText,
    });
  }, [currentChatId, socket]);

  const getOnlineStatus = useCallback((username: string): boolean => {
    return onlineStatuses[username] === true;
  }, [onlineStatuses]);

  const getLastSeen = useCallback((username: string): string | null => {
    return lastSeen[username] || null;
  }, [lastSeen]);

  const getTypingUsernames = useCallback((chatId: string): string[] => {
    const set = typingUsers.get(chatId);
    return set ? Array.from(set) : [];
  }, [typingUsers]);

  const value: ChatContextType = {
    chats,
    currentChatId,
    messages,
    unreadCounts,
    typingUsers,
    isLoadingHistory,
    currentChatPartnerId,
    groupInfo,
    hasMoreHistory,
    loadMoreHistory,
    historyOffsets,
    setCurrentChatId,
    sendMessage,
    switchChat,
    loadChatAvatar,
    createGroup,
    addUserToGroup,
    removeUserFromGroup,
    leaveGroup,
    fetchGroupInfo,
    deleteMessage,
    editMessage,
    socket,
    onlineStatuses,
    lastSeen,
    getOnlineStatus,
    getLastSeen,
    getTypingUsernames,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
