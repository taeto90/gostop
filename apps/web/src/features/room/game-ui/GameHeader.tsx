import type { RoomView } from '@gostop/shared';

interface GameHeaderProps {
  view: RoomView;
  isHost: boolean;
  onLeave: () => void | Promise<void>;
  onOpenSettings: () => void;
  onOpenRules: () => void;
}

/**
 * PC 게임 화면 상단 헤더 (2026-06 시니어 친화 개편).
 *
 * [🎴 GoStop · 방 #ID · 👥 N명] [목표 N점 · 배수 ×N] [방 설정 | 나가기 | ⚙️]
 *
 * ※ 방 이름/환산점수/라운드는 시스템 미구현 — 추후 추가 시 가운데 슬롯에 확장.
 * 모바일은 CompactHeader 사용 (이 컴포넌트는 PC 전용).
 */
export function GameHeader({
  view,
  isHost,
  onLeave,
  onOpenSettings,
  onOpenRules,
}: GameHeaderProps) {
  const memberCount = view.players.length + (view.spectators?.length ?? 0);
  const winScore = view.rules?.winScore ?? 7;
  const nagari = view.nagariMultiplier ?? 1;

  return (
    <header className="flex h-16 items-center gap-4 rounded-xl border border-felt-800/70 bg-gradient-to-b from-felt-900 to-felt-950 px-4 shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
      {/* 좌측 — 로고 + 방 정보 */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="whitespace-nowrap text-3xl font-black italic text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.45)]">
          🎴 GoStop
        </span>
        <span className="hidden whitespace-nowrap rounded-full border border-felt-700/60 bg-felt-950/70 px-3.5 py-1.5 text-base font-bold text-felt-100 lg:inline">
          방 #{view.roomId}
        </span>
        <span className="whitespace-nowrap rounded-full border border-felt-700/60 bg-felt-950/70 px-3.5 py-1.5 text-base font-bold text-felt-100">
          👥 {memberCount}명
        </span>
      </div>

      {/* 가운데 — 게임 정보 (크게, 시니어 가독성) */}
      <div className="flex flex-1 items-center justify-center gap-8">
        <span className="whitespace-nowrap text-xl font-bold text-felt-100">
          목표점수 <span className="text-2xl font-black text-amber-300">{winScore}점</span>
        </span>
        {nagari > 1 && (
          <span
            className="whitespace-nowrap text-xl font-bold text-felt-100"
            title="나가리/쇼당 누적 배수 — 이번 판 점수에 곱해짐"
          >
            현재 배수{' '}
            <span className="text-3xl font-black text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.5)]">
              ×{nagari}
            </span>
          </span>
        )}
      </div>

      {/* 우측 — 액션 버튼 (크게) */}
      <div className="flex items-center gap-2">
        {isHost && (
          <button
            onClick={onOpenRules}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 text-base font-bold text-amber-200 transition hover:bg-amber-500/25"
            title="방 룰 설정 (호스트)"
          >
            ⚖️ 방 설정
          </button>
        )}
        <button
          onClick={() => void onLeave()}
          className="flex h-11 items-center gap-1.5 rounded-lg border border-rose-600/50 bg-rose-900/50 px-4 text-base font-bold text-rose-100 transition hover:bg-rose-800/70"
          title="로비로 나가기"
        >
          🚪 나가기
        </button>
        <button
          onClick={onOpenSettings}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-felt-700/60 bg-felt-950/70 text-2xl transition hover:bg-felt-800"
          aria-label="설정"
          title="설정"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
