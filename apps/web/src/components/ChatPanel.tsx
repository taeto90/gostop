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
  /** 헤더 우측 추가 버튼 (예: 이모지 피커) */
  headerExtra?: React.ReactNode;
}

/**
 * 채팅 본체 — 메시지 리스트 + 입력 필드. 모달 wrapper에서 분리해 inline 사용 가능.
 */
function ChatBody({
  active,
  onClose,
  className,
  inputExtra,
  headerExtra,
}: {
  /** unread 리셋 + 자동 스크롤 / Esc 핸들러 활성화 (visible 상태) */
  active: boolean;
  onClose?: () => void;
  className?: string;
  /** 입력란 옆 추가 버튼 */
  inputExtra?: React.ReactNode;
  /** 헤더 우측 추가 버튼 (예: 이모지 피커 — PC 우측 사이드바) */
  headerExtra?: React.ReactNode;
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
    // text-base line-height 24px × 3줄 + padding-y 8px*2 = 88px
    const max = 88;
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
      {/* 헤더 — 우측에 headerExtra(이모지 피커 등) + 닫기 */}
      <div className="flex items-center justify-between border-b border-felt-800/60 px-4 py-2">
        <span className="text-base font-bold text-felt-100">💬 채팅</span>
        <div className="flex items-center gap-1.5">
          {headerExtra}
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
                <span className="text-xs text-felt-400">{m.fromNickname}</span>
                <span
                  className={`mt-0.5 whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-base ${
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
          className="flex-1 resize-none rounded border border-felt-700 bg-felt-950 px-3 py-2 text-base text-felt-100 placeholder-felt-500 focus:border-amber-400 focus:outline-none"
          style={{
            maxHeight: '88px',
            lineHeight: '24px',
            overflowY: 'auto',
          }}
        />
        {inputExtra && <div className="self-end">{inputExtra}</div>}
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="self-end rounded bg-amber-500 px-4 py-2 text-base font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
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
export function ChatPanel({ open, onClose, headerExtra }: ChatPanelProps) {
  const [vvHeight, setVvHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !window.visualViewport) return;
    function onResize() {
      const vv = window.visualViewport!;
      setVvHeight(vv.height);
    }
    onResize();
    window.visualViewport.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, [open]);

  const maxH = vvHeight ? `${vvHeight - 24}px` : '600px';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={MODAL_SCALE_INITIAL}
            animate={MODAL_SCALE_ANIMATE}
            exit={MODAL_SCALE_EXIT}
            transition={MODAL_SPRING}
            className="w-full max-w-md rounded-2xl border-2 border-amber-400/40 bg-felt-900 shadow-2xl"
            style={{ maxHeight: maxH }}
            onClick={(e) => e.stopPropagation()}
          >
            <ChatBody active={open} onClose={onClose} className="h-full" headerExtra={headerExtra} />
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
export function ChatInlinePanel({
  className,
  inputExtra,
  headerExtra,
}: {
  className?: string;
  inputExtra?: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <ChatBody active className={className} inputExtra={inputExtra} headerExtra={headerExtra} />
  );
}
