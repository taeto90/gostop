import { useEffect, useState } from 'react';
import type { RoomView } from '@gostop/shared';
import { ChatInlinePanel } from '../../../components/ChatPanel.tsx';
import { EmojiPickerButton } from '../../../components/EmojiReactions.tsx';
import {
  SIDEBAR_COLLAPSED_WIDTH_PC,
  SIDEBAR_WIDTH_PC,
} from '../../../lib/layoutConstants.ts';
import { useChatStore } from '../../../stores/chatStore.ts';

const OPEN_PREF_KEY = 'gostop:right-sidebar-open';

function loadOpenPref(): boolean {
  try {
    return localStorage.getItem(OPEN_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

function saveOpenPref(open: boolean) {
  try {
    localStorage.setItem(OPEN_PREF_KEY, open ? '1' : '0');
  } catch {
    // private mode 등 — 무시
  }
}

interface RightSidebarProps {
  view: RoomView;
  /** 화상/음성 타일 섹션 — RoomScreen이 LiveKit context 안에서 <MediaTilesPanel/> 전달 */
  mediaTiles?: React.ReactNode;
}

/**
 * PC 우측 통합 사이드바 (2026-06 시니어 친화 개편).
 *
 * [화상/음성 타일] → [참여자 목록] → [채팅 (flex-1)] 세로 스택.
 * 우상단 ▶ 토글로 전체 접기 (36px 바) / ◀ 펴기 — localStorage 저장.
 */
export function RightSidebar({ view, mediaTiles }: RightSidebarProps) {
  const [open, setOpen] = useState(loadOpenPref);
  const unread = useChatStore((s) => s.unreadCount);

  useEffect(() => {
    saveOpenPref(open);
  }, [open]);

  if (!open) {
    return (
      <aside
        className="relative flex h-full flex-col items-center gap-3 rounded-lg border border-felt-900/60 bg-felt-900/40 pt-9"
        style={{ width: SIDEBAR_COLLAPSED_WIDTH_PC }}
      >
        <button
          onClick={() => setOpen(true)}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/60 text-xs text-felt-200 hover:bg-black/80"
          title="사이드바 펼치기"
          aria-label="사이드바 펼치기"
        >
          ◀
        </button>
        <span className="text-base">{view.rules?.mediaMode === 'voice-only' ? '🎙️' : '🎥'}</span>
        <span className="text-base">👥</span>
        <span className="relative text-base">
          💬
          {unread > 0 && (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-felt-800/70 bg-gradient-to-b from-felt-900/80 to-felt-950/80 p-2 pt-8"
      style={{ width: SIDEBAR_WIDTH_PC }}
    >
      <button
        onClick={() => setOpen(false)}
        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/60 text-xs text-felt-200 hover:bg-black/80"
        title="사이드바 접기"
        aria-label="사이드바 접기"
      >
        ▶
      </button>

      {/* ① 화상/음성 타일 */}
      {mediaTiles}

      {/* ② 참여자 목록 */}
      <ParticipantList view={view} />

      {/* ③ 채팅 — 남은 공간 전체 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-felt-800/60 bg-felt-950/40">
        <ChatInlinePanel
          className="h-full"
          headerExtra={<EmojiPickerButton direction="down" />}
        />
      </div>
    </aside>
  );
}

function ParticipantList({ view }: { view: RoomView }) {
  return (
    <section className="flex max-h-[30%] flex-col gap-1.5 overflow-y-auto rounded-lg border border-felt-800/60 bg-felt-950/50 p-2">
      <span className="px-1 text-base font-bold text-felt-100">
        👥 참여자 <span className="text-felt-400">({view.players.length + view.spectators.length}명)</span>
      </span>
      {view.players.map((p) => (
        <div key={p.userId} className="flex items-center gap-2 px-1">
          <span
            className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
              p.connected ? 'bg-emerald-400' : 'bg-felt-600'
            }`}
          />
          <span className="text-lg leading-none">{p.emojiAvatar}</span>
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-felt-100">
            {p.nickname}
            {p.userId === view.hostUserId && (
              <span className="ml-1" title="방장">
                👑
              </span>
            )}
            {p.userId === view.myUserId && (
              <span className="ml-1 text-sm text-felt-400">(나)</span>
            )}
          </span>
          <span className="flex-shrink-0 rounded bg-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-100">
            플레이어
          </span>
        </div>
      ))}
      {view.spectators.map((s) => (
        <div key={s.userId} className="flex items-center gap-2 px-1 opacity-80">
          <span
            className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
              s.connected ? 'bg-emerald-400' : 'bg-felt-600'
            }`}
          />
          <span className="text-lg leading-none">{s.emojiAvatar}</span>
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-felt-200">
            {s.nickname}
            {s.userId === view.hostUserId && (
              <span className="ml-1" title="방장">
                👑
              </span>
            )}
            {s.userId === view.myUserId && (
              <span className="ml-1 text-sm text-felt-400">(나)</span>
            )}
          </span>
          <span className="flex-shrink-0 rounded bg-felt-700/60 px-2 py-0.5 text-xs font-bold text-felt-200">
            관전자
          </span>
        </div>
      ))}
    </section>
  );
}
