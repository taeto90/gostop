import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMaybeRoomContext } from '@livekit/components-react';
import type { RoomView } from '@gostop/shared';
import { DevFillToggle } from './_shared/DevFillToggle.tsx';
import { FitTile } from './_shared/FitTile.tsx';
import { MediaToggleButtons } from './_shared/MediaToggleButtons.tsx';
import { PlaceholderTile } from './_shared/PlaceholderTile.tsx';
import { isPlaceholder, type MemberLike } from './_shared/types.ts';
import { useVideoMembers } from './_shared/useVideoMembers.ts';
import { useVideoTileRenderer } from './_shared/useVideoTileRenderer.tsx';

type RenderTile = (m: MemberLike) => React.ReactNode;

interface VideoMobileModalProps {
  view: RoomView;
  open: boolean;
  onClose: () => void;
}

/**
 * 모바일 풀스크린 화상 모달.
 *
 * - 인원수별 동적 레이아웃 (한 화면, 슬라이드 X):
 *     1: 풀화면, 2: 1행 2열, 3: 위 2 + 아래 1 가운데
 *     4: 2x2, 5: 본인 좌측 1/4 + 4명 2x2
 * - 헤더: 카메라/마이크 토글 + 닫기
 * - 카드 클릭 → 풀스크린 expansion (↩으로 복귀)
 */
export function VideoMobileModal(props: VideoMobileModalProps) {
  const room = useMaybeRoomContext();
  if (!room) return <ModalShell {...props} renderTile={undefined} connecting />;
  return <ConnectedMobileModal {...props} />;
}

function ConnectedMobileModal(props: VideoMobileModalProps) {
  const renderTile = useVideoTileRenderer(props.view);
  return <ModalShell {...props} renderTile={renderTile} />;
}

interface ModalShellProps extends VideoMobileModalProps {
  renderTile?: RenderTile;
  connecting?: boolean;
}

function ModalShell({
  view,
  open,
  onClose,
  renderTile,
  connecting,
}: ModalShellProps) {
  const allTiles = useVideoMembers(view);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const voiceOnly = view.rules?.mediaMode === 'voice-only';

  // ESC: 확대 중이면 그리드로, 아니면 모달 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (expandedId) setExpandedId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, expandedId]);

  // 모달 닫힐 때 확대 상태도 리셋
  useEffect(() => {
    if (!open) setExpandedId(null);
  }, [open]);

  function tileFor(member: MemberLike): React.ReactNode {
    if (renderTile && !isPlaceholder(member.userId)) return renderTile(member);
    return <PlaceholderTile avatar={member.emojiAvatar} name={member.nickname} />;
  }

  function clickableTileFor(member: MemberLike): React.ReactNode {
    return (
      <button
        onClick={() => setExpandedId(member.userId)}
        className="block h-full w-full cursor-pointer"
        title={`${member.nickname} 확대`}
      >
        {tileFor(member)}
      </button>
    );
  }

  const expandedMember = expandedId
    ? allTiles.find((m) => m.userId === expandedId) ?? null
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="m-2 flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-felt-900 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Header
              count={allTiles.length}
              connecting={connecting}
              voiceOnly={voiceOnly}
              onClose={onClose}
              expanded={!!expandedMember}
              onCloseExpanded={() => setExpandedId(null)}
            />

            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-1">
              {expandedMember ? (
                <ExpandedView tile={tileFor(expandedMember)} />
              ) : (
                <LayoutGrid
                  members={allTiles}
                  myUserId={view.myUserId}
                  clickableTile={clickableTileFor}
                />
              )}
            </div>

            {import.meta.env.DEV && <DevFillToggle />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({
  count,
  connecting,
  voiceOnly,
  onClose,
  expanded,
  onCloseExpanded,
}: {
  count: number;
  connecting?: boolean;
  voiceOnly?: boolean;
  onClose: () => void;
  expanded: boolean;
  onCloseExpanded: () => void;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2 px-1">
      <span className="truncate text-xs font-bold text-felt-200">
        {voiceOnly ? '🎙️ 음성채팅' : '🎥 화상채팅'} ({count}명){connecting && ' · 연결 중'}
      </span>
      <div className="flex items-center gap-1">
        <MediaToggleButtons variant="compact" voiceOnly={voiceOnly} />
        {expanded && (
          <button
            onClick={onCloseExpanded}
            className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-base text-felt-300 hover:bg-felt-800"
            title="그리드로 돌아가기"
            aria-label="그리드로 돌아가기"
          >
            ↩
          </button>
        )}
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
          title="닫기"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function LayoutGrid({
  members,
  myUserId,
  clickableTile,
}: {
  members: MemberLike[];
  myUserId: string;
  clickableTile: RenderTile;
}) {
  const count = members.length;
  if (count === 0) return <div className="text-xs text-felt-400">참여자 없음</div>;
  if (count === 1) return <FitTile>{clickableTile(members[0]!)}</FitTile>;

  if (count === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-2">
        {members.map((m) => (
          <FitCell key={m.userId}>{clickableTile(m)}</FitCell>
        ))}
      </div>
    );
  }

  if (count === 3) {
    // 2x2 grid 사이즈 동일 + 2행은 col-span-2 가운데 1명
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
        {members.slice(0, 2).map((m) => (
          <FitCell key={m.userId}>{clickableTile(m)}</FitCell>
        ))}
        <div className="col-span-2 flex min-h-0 justify-center gap-2">
          <div className="min-h-0" style={{ width: 'calc(50% - 0.25rem)' }}>
            <FitTile>{clickableTile(members[2]!)}</FitTile>
          </div>
        </div>
      </div>
    );
  }

  if (count === 4) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
        {members.map((m) => (
          <FitCell key={m.userId}>{clickableTile(m)}</FitCell>
        ))}
      </div>
    );
  }

  // 5명 — 본인 좌측 1/4 + 나머지 4명 우측 2x2
  const me = members.find((m) => m.userId === myUserId) ?? members[0]!;
  const others = members.filter((m) => m.userId !== me.userId);
  return (
    <div className="flex h-full w-full gap-2">
      <div className="w-1/4 min-h-0 min-w-0">
        <FitTile>{clickableTile(me)}</FitTile>
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        {others.slice(0, 4).map((m) => (
          <FitCell key={m.userId}>{clickableTile(m)}</FitCell>
        ))}
      </div>
    </div>
  );
}

/** grid cell wrapper — min size 0 + FitTile. layout 함수들의 반복 줄임. */
function FitCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 min-w-0">
      <FitTile>{children}</FitTile>
    </div>
  );
}

function ExpandedView({ tile }: { tile: React.ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="flex h-full w-full items-center justify-center"
    >
      <div className="aspect-video max-h-full max-w-full">{tile}</div>
    </motion.div>
  );
}
