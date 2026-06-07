import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMaybeRoomContext } from '@livekit/components-react';
import type { RoomView } from '@gostop/shared';
import { VIDEO_SIDEBAR_MAX_TILES } from '../../lib/layoutConstants.ts';
import { PlaceholderTile } from './_shared/PlaceholderTile.tsx';
import { isPlaceholder, type MemberLike } from './_shared/types.ts';
import { useVideoMembers } from './_shared/useVideoMembers.ts';
import { useVideoTileRenderer } from './_shared/useVideoTileRenderer.tsx';

type RenderTile = (m: MemberLike) => React.ReactNode;

interface MediaTilesPanelProps {
  view: RoomView;
}

/**
 * PC 우측 통합 사이드바의 화상/음성 타일 섹션 (2026-06 시니어 친화 개편).
 *
 * - 2열 그리드. RightSidebar 안에 배치 — 폭은 부모가 결정.
 * - voiceOnly: 카메라 트랙이 없어 VideoTile이 FallbackAvatar 표시 +
 *   `useIsSpeaking` 기반 amber 하이라이트 그대로 동작 → 말하는 사람 표시.
 * - 타일 클릭 → 가운데 확대 (PCExpandedModal).
 */
export function MediaTilesPanel({ view }: MediaTilesPanelProps) {
  const room = useMaybeRoomContext();
  const voiceOnly = view.rules?.mediaMode === 'voice-only';
  if (!room) {
    return <TilesShell view={view} renderTile={undefined} connecting voiceOnly={voiceOnly} />;
  }
  return <ConnectedTiles view={view} voiceOnly={voiceOnly} />;
}

function ConnectedTiles({ view, voiceOnly }: MediaTilesPanelProps & { voiceOnly: boolean }) {
  const renderTile = useVideoTileRenderer(view);
  return <TilesShell view={view} renderTile={renderTile} voiceOnly={voiceOnly} />;
}

function TilesShell({
  view,
  renderTile,
  connecting,
  voiceOnly,
}: {
  view: RoomView;
  renderTile?: RenderTile;
  connecting?: boolean;
  voiceOnly?: boolean;
}) {
  const allTiles = useVideoMembers(view, VIDEO_SIDEBAR_MAX_TILES);
  const realCount = allTiles.filter((m) => !isPlaceholder(m.userId)).length;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ESC로 확대 닫기
  useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedId]);

  const expandedMember = expandedId
    ? allTiles.find((m) => m.userId === expandedId) ?? null
    : null;

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-base font-bold text-felt-100">
          {voiceOnly ? '🎙️ 음성채팅' : '🎥 화상채팅'}{' '}
          <span className="text-felt-400">({realCount}명)</span>
        </span>
        {connecting && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
            연결 중...
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {allTiles.map((member) => (
          <button
            key={member.userId}
            onClick={() => setExpandedId(member.userId)}
            className="aspect-video w-full cursor-pointer overflow-hidden rounded-lg transition hover:scale-[1.02]"
            title={`${member.nickname} 확대`}
          >
            <RenderedTile member={member} renderTile={renderTile} />
          </button>
        ))}
      </div>

      <PCExpandedModal
        member={expandedMember}
        renderTile={renderTile}
        onClose={() => setExpandedId(null)}
      />
    </section>
  );
}

/** 타일 클릭 시 화면 가운데 띄우는 큰 비디오 모달. */
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
