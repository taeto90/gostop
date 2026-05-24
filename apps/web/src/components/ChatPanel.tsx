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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // text 변화 시 textarea 높이 자동 조절 (최대 3줄)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    // text-sm line-height ≈ 20px × 3줄 + padding-y 8px*2 = 76px
    const max = 76;
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
  }, [text]);

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

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 단독 = 전송, Shift+Enter = 줄바꿈 (textarea default)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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

      {/* 메시지 list — min-h-0 필수 (flex-col에서 자식이 줄어들기 허용) */}
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
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
                  className={`mt-0.5 whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-sm ${
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

      {/* 입력 — textarea (Shift+Enter = 줄바꿈 / Enter = 전송, 최대 3줄 자동 확장).
          flex-shrink-0로 부모가 항상 textarea 크기 보장 (밀려 잘리지 않게) */}
      <div className="flex flex-shrink-0 gap-2 border-t border-felt-800/60 p-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="메시지 입력..."
          maxLength={500}
          rows={1}
          className="flex-1 resize-none rounded border border-felt-700 bg-felt-950 px-3 py-2 text-sm text-felt-100 placeholder-felt-500 focus:border-amber-400 focus:outline-none"
          style={{
            maxHeight: '76px',
            lineHeight: '20px',
            overflowY: 'auto',
          }}
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="self-end rounded bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
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

/** PC 사이드 패널 — width 드래그 리사이즈 + localStorage 저장 */
const CHAT_WIDTH_KEY = 'gostop:chat-panel-width';
const CHAT_WIDTH_MIN = 240;
const CHAT_WIDTH_MAX = 600;
const CHAT_WIDTH_DEFAULT = 320;

export function loadChatPanelWidth(): number {
  try {
    const raw = localStorage.getItem(CHAT_WIDTH_KEY);
    if (!raw) return CHAT_WIDTH_DEFAULT;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return CHAT_WIDTH_DEFAULT;
    return Math.max(CHAT_WIDTH_MIN, Math.min(CHAT_WIDTH_MAX, n));
  } catch {
    return CHAT_WIDTH_DEFAULT;
  }
}

function saveChatPanelWidth(w: number) {
  try {
    localStorage.setItem(CHAT_WIDTH_KEY, String(w));
  } catch {
    // localStorage 사용 불가 (private mode 등) — 무시
  }
}

/**
 * PC 게임 화면 우측 채팅 사이드 패널.
 * - grid column으로 inline 배치 (화상 사이드바 왼쪽)
 * - 왼쪽 가장자리 드래그로 width 리사이즈 (240~600px) + localStorage 저장
 * - 닫기 버튼으로 onClose 호출
 */
export function ChatSidePanel({
  width,
  onWidthChange,
  onClose,
}: {
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
}) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(width);
  const latestWRef = useRef(width);
  latestWRef.current = width;

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      // 좌측 핸들 드래그 — 왼쪽으로 끌면 width 증가
      const delta = startXRef.current - e.clientX;
      const next = Math.max(
        CHAT_WIDTH_MIN,
        Math.min(CHAT_WIDTH_MAX, startWRef.current + delta),
      );
      onWidthChange(next);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // 드래그 종료 시점의 최신 width 저장 (start 시점이 아님)
      saveChatPanelWidth(latestWRef.current);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onWidthChange]);

  function onHandleDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-lg border border-felt-700/60 bg-felt-900/90 shadow-lg backdrop-blur-sm"
      style={{ width: `${width}px` }}
    >
      {/* 좌측 드래그 핸들 */}
      <div
        onMouseDown={onHandleDown}
        className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-amber-500/40"
        title="드래그하여 너비 조절"
        aria-label="채팅창 너비 조절"
      />
      <ChatBody active onClose={onClose} className="h-full" />
    </div>
  );
}
