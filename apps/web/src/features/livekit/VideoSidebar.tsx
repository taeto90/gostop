import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMaybeRoomContext } from '@livekit/components-react';
import type { RoomView } from '@gostop/shared';
import { useElementSize } from '../../hooks/useElementSize.ts';
import { loadSidebarOpenPref, saveSidebarOpenPref } from '../../lib/livekit.ts';
import {
  SIDEBAR_TOGGLE_TOP_GAP,
  VIDEO_SIDEBAR_COLLAPSED_WIDTH,
  VIDEO_SIDEBAR_FALLBACK_WIDTH,
  VIDEO_SIDEBAR_HORIZONTAL_PADDING,
  VIDEO_SIDEBAR_MAX_TILES,
  VIDEO_SIDEBAR_VERTICAL_PADDING_RATIO,
  VIDEO_TILE_ASPECT_RATIO,
  VIDEO_TILE_GAP_RATIO,
  VIDEO_TILE_HEIGHT_RATIO,
} from '../../lib/layoutConstants.ts';
import { PlaceholderTile } from './_shared/PlaceholderTile.tsx';
import { isPlaceholder, type MemberLike } from './_shared/types.ts';
import { useVideoMembers } from './_shared/useVideoMembers.ts';
import { useVideoTileRenderer } from './_shared/useVideoTileRenderer.tsx';

type RenderTile = (m: MemberLike) => React.ReactNode;

interface VideoSidebarProps {
  view: RoomView;
}

/**
 * PC 우측 화상 사이드바.
 *
 * 사이즈 비율 (`layoutConstants.ts`):
 *   카드 5개 × 17% + 사이 갭 4개 × 2% + 위/아래 패딩 2 × 3.5% = 100%
 *   카드 width = height × 16/9. 사이드바 width = 카드 width + 좌우 패딩.
 *
 * Grid의 `auto` 컬럼이 사이드바 width 변경에 자동 적응.
 *
 * - LiveKit context 없으면: placeholder만 (연결 중 안내)
 * - context 있으면: 실제 비디오 + placeholder
 * - voice-only 모드: 카메라 트랙이 없으니 자연스럽게 FallbackAvatar만 노출. 헤더 배지로 "🎙️ 음성" 명시
 */
export function VideoSidebar({ view }: VideoSidebarProps) {
  const room = useMaybeRoomContext();
  const voiceOnly = view.rules?.mediaMode === 'voice-only';
  if (!room) return <SidebarShell view={view} renderTile={undefined} connecting voiceOnly={voiceOnly} />;
  return <ConnectedSidebar view={view} voiceOnly={voiceOnly} />;
}

function ConnectedSidebar({ view, voiceOnly }: VideoSidebarProps & { voiceOnly: boolean }) {
  const renderTile = useVideoTileRenderer(view);
  return <SidebarShell view={view} renderTile={renderTile} voiceOnly={voiceOnly} />;
}

interface SidebarShellProps {
  view: RoomView;
  renderTile?: RenderTile;
  connecting?: boolean;
  voiceOnly?: boolean;
}

function SidebarShell({ view, renderTile, connecting, voiceOnly }: SidebarShellProps) {
  const [open, setOpen] = useState(loadSidebarOpenPref);
  const [sidebarRef, { height: sidebarH }] = useElementSize<HTMLDivElement>();
  const allTiles = useVideoMembers(view, VIDEO_SIDEBAR_MAX_TILES);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    saveSidebarOpenPref(open);
  }, [open]);

  // ESC로 확대 닫기
  useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedId]);

  if (!open) {
    return <CollapsedSidebar onExpand={() => setOpen(true)} voiceOnly={voiceOnly} />;
  }

  // 비율 기반 사이즈 — 사이드바 height에서 도출
  const tileH = sidebarH * VIDEO_TILE_HEIGHT_RATIO;
  const tileW = tileH * VIDEO_TILE_ASPECT_RATIO;
  const gap = sidebarH * VIDEO_TILE_GAP_RATIO;
  const verticalPadding = sidebarH * VIDEO_SIDEBAR_VERTICAL_PADDING_RATIO;
  const sidebarWidth =
    sidebarH > 0
      ? Math.round(tileW + 2 * VIDEO_SIDEBAR_HORIZONTAL_PADDING)
      : VIDEO_SIDEBAR_FALLBACK_WIDTH;

  const expandedMember = expandedId
    ? allTiles.find((m) => m.userId === expandedId) ?? null
    : null;

  return (
    <aside
      ref={sidebarRef}
      className="relative flex h-full flex-col items-center rounded-lg border border-felt-900/60 bg-felt-900/40"
      style={{
        width: sidebarWidth,
        // 토글 버튼 + 일관된 top 여유공간 — 접힌/펼친 상태 둘 다 동일 (32px)
        paddingTop: SIDEBAR_TOGGLE_TOP_GAP,
        paddingBottom: verticalPadding,
        paddingLeft: VIDEO_SIDEBAR_HORIZONTAL_PADDING,
        paddingRight: VIDEO_SIDEBAR_HORIZONTAL_PADDING,
      }}
    >
      <button
        onClick={() => setOpen(false)}
        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[10px] text-felt-200 hover:bg-black/80"
        title="접기"
        aria-label="화상채팅 접기"
      >
        ▶
      </button>
      {voiceOnly && (
        <div
          className="absolute left-1 top-1 z-10 rounded bg-sky-500/30 px-1.5 py-0.5 text-[9px] font-bold text-sky-100"
          title="음성 전용 모드"
        >
          🎙️ 음성
        </div>
      )}

      <div
        className="flex w-full flex-col items-center"
        style={{ gap: `${gap}px` }}
      >
        {allTiles.map((member) => (
          <button
            key={member.userId}
            onClick={() => setExpandedId(member.userId)}
            className="flex-shrink-0 cursor-pointer transition hover:scale-[1.02]"
            style={{
              width: tileW > 0 ? tileW : '100%',
              height: tileH > 0 ? tileH : undefined,
            }}
            title={`${member.nickname} 확대`}
          >
            <RenderedTile member={member} renderTile={renderTile} />
          </button>
        ))}
      </div>

      {connecting && (
        <div className="absolute bottom-1 left-1 right-1 rounded bg-amber-500/20 px-1 py-0.5 text-center text-[9px] text-amber-200">
          연결 중...
        </div>
      )}

      <PCExpandedModal
        member={expandedMember}
        renderTile={renderTile}
        onClose={() => setExpandedId(null)}
      />
    </aside>
  );
}

function CollapsedSidebar({
  onExpand,
  voiceOnly,
}: {
  onExpand: () => void;
  voiceOnly?: boolean;
}) {
  return (
    <aside
      className="relative flex h-full flex-col items-center rounded-lg border border-felt-900/60 bg-felt-900/40"
      style={{
        width: VIDEO_SIDEBAR_COLLAPSED_WIDTH,
        // 펼친 상태와 동일한 top 여유 — 토글 시 layout이 위/아래로 흔들리지 않음
        paddingTop: SIDEBAR_TOGGLE_TOP_GAP,
        paddingBottom: 8,
      }}
    >
      {/* 토글 버튼 — 펼친 상태와 동일하게 우상단 고정 위치 */}
      <button
        onClick={onExpand}
        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[10px] text-felt-200 hover:bg-black/80"
        title={voiceOnly ? '음성채팅 펼치기' : '화상채팅 펼치기'}
        aria-label={voiceOnly ? '음성채팅 펼치기' : '화상채팅 펼치기'}
      >
        ◀
      </button>
      <div className="[writing-mode:vertical-rl] text-[10px] text-felt-400">
        {voiceOnly ? '🎙️ 음성' : '🎥 화상'}
      </div>
    </aside>
  );
}

/** PC 사이드바 카드 클릭 시 화면 가운데 띄우는 큰 비디오 모달. */
function PCExpandedModal({
  member,
  renderTile,
  onClose,
}: {
  member: MemberLike | null;
  renderTile?: RenderTile;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {member && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="relative aspect-video w-[80vw] max-w-4xl overflow-hidden rounded-2xl border-2 border-amber-400/40 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <RenderedTile member={member} renderTile={renderTile} />
            <button
              onClick={onClose}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-lg text-white hover:bg-black/90"
              title="닫기 (ESC)"
              aria-label="닫기"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** placeholder 멤버 또는 renderTile이 없으면 PlaceholderTile, 아니면 renderTile 호출. */
function RenderedTile({
  member,
  renderTile,
}: {
  member: MemberLike;
  renderTile?: RenderTile;
}) {
  if (!renderTile || isPlaceholder(member.userId)) {
    return <PlaceholderTile avatar={member.emojiAvatar} name={member.nickname} />;
  }
  return <>{renderTile(member)}</>;
}
