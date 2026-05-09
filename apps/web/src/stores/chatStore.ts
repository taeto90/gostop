import { create } from 'zustand';

export interface ChatMessage {
  /** 메시지 고유 id (timestamp + random) */
  id: string;
  fromUserId: string;
  fromNickname: string;
  fromEmoji: string;
  text: string;
  timestamp: number;
  /** 본인이 보낸 메시지인지 (UI 우측 정렬용) */
  mine: boolean;
}

const MAX_MESSAGES = 50;

interface ChatState {
  messages: ChatMessage[];
  /** 새 메시지 도착 시 사용자가 채팅 모달을 안 보고 있을 때 알림 카운트 */
  unreadCount: number;
  pushMessage: (msg: Omit<ChatMessage, 'id'>) => void;
  resetUnread: () => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,
  pushMessage: (msg) => {
    const id = `${msg.timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      messages: [...state.messages, { ...msg, id }].slice(-MAX_MESSAGES),
      // 본인 메시지는 unread로 카운트하지 않음
      unreadCount: msg.mine ? state.unreadCount : state.unreadCount + 1,
    }));
  },
  resetUnread: () => set({ unreadCount: 0 }),
  clear: () => set({ messages: [], unreadCount: 0 }),
}));
