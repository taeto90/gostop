import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { emitWithAck } from '../lib/socket.ts';
import {
  MODAL_SCALE_ANIMATE,
  MODAL_SCALE_EXIT,
  MODAL_SCALE_INITIAL,
  MODAL_SPRING,
} from '../lib/animationTiming.ts';
import { useChatStore } from '../stores/chatStore.ts';
import { useSessionStore } from '../stores/sessionStore.ts';
import { toast } from '../stores/toastStore.ts';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 채팅 본체 — 메시지 리스트 + 입력 필드. 모달 wrapper에서 분리해 inline 사용 가능.
 */
function ChatBody({
  active,
  onClose,
  className,
}: {
  /** unread 리셋 + 자동 스크롤 / Esc 핸들러 활성화 (visible 상태) */
  active: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const messages = useChatStore((s) => s.messages);
  const resetUnread = useChatStore((s) => s.resetUnread);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // active 시 unread 리셋
  useEffect(() => {
    if (active) resetUnread();
  }, [active, resetUnread]);

  // 새 메시지 도착 시 list 끝으로 스크롤
  useEffect(() => {
    if (!active) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, active]);

  // ESC로 닫기 (모달 모드에서만)
  useEffect(() => {
    if (!active || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const r = await emitWithAck('chat:send', { text: trimmed });
    setBusy(false);
    if (r.ok) {
      // Optimistic update — server는 본인 제외 broadcast이므로 직접 push
      const profile = useSessionStore.getState().profile;
      if (profile) {
        useChatStore.getState().pushMessage({
          fromUserId: profile.userId,
          fromNickname: profile.nickname,
          fromEmoji: profile.emojiAvatar,
          text: trimmed,
          timestamp: Date.now(),
          mine: true,
        });
      }
      setText('');
    } else {
      toast.error(r.error);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className={`flex flex-col overflow-hidden ${className ?? ''}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-felt-800/60 px-4 py-2.5">
        <span className="text-sm font-bold text-felt-100">💬 채팅</span>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* 메시지 list */}
      <div
        ref={listRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <div className="m-auto text-center text-xs text-felt-400">
            아직 메시지가 없습니다.
            <br />첫 메시지를 보내보세요!
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.mine ? 'flex-row-reverse' : ''}`}
            >
              <span className="flex-shrink-0 text-2xl">{m.fromEmoji}</span>
              <div
                className={`flex max-w-[75%] flex-col ${
                  m.mine ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] text-felt-400">{m.fromNickname}</span>
                <span
                  className={`mt-0.5 rounded-lg px-3 py-1.5 text-sm ${
                    m.mine
                      ? 'bg-amber-500/30 text-amber-100'
                      : 'bg-felt-800/80 text-felt-100'
                  }`}
                >
                  {m.text}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 입력 */}
      <div className="flex gap-2 border-t border-felt-800/60 p-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="메시지 입력..."
          maxLength={200}
          className="flex-1 rounded border border-felt-700 bg-felt-950 px-3 py-2 text-sm text-felt-100 placeholder-felt-500 focus:border-amber-400 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}

/**
 * 텍스트 채팅 모달 — 풀스크린 (모바일) / 우측 모달 (PC).
 *
 * - `useChatStore`에서 메시지 list 구독
 * - 본인 메시지는 우측 정렬 (amber), 다른 사람은 좌측 (slate)
 * - ESC / 오버레이 클릭으로 닫기
 * - 모달 열릴 때 unreadCount 리셋
 */
export function ChatPanel({ open, onClose }: ChatPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={MODAL_SCALE_INITIAL}
            animate={MODAL_SCALE_ANIMATE}
            exit={MODAL_SCALE_EXIT}
            transition={MODAL_SPRING}
            className="h-full max-h-[600px] w-full max-w-md rounded-2xl border-2 border-amber-400/40 bg-felt-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatBody active={open} onClose={onClose} className="h-full" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 인라인 채팅 패널 — RoomLobbyModal 우측에 항상 펼친 상태로 사용.
 * 헤더 닫기 버튼 X, ESC 비활성. unread 카운트는 active=true로 자동 리셋.
 */
export function ChatInlinePanel({ className }: { className?: string }) {
  return <ChatBody active className={className} />;
}
