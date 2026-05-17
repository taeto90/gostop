import type { PlayerStateView, RoomView } from '@gostop/shared';
import { calculateScore, canDeclareGoStop } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { TurnIndicator } from '../../../components/TurnIndicator.tsx';
import { computeMultiplier, multiplierBreakdown } from '../../../lib/multiplierUtils.ts';

interface CompactHeaderProps {
  view: RoomView;
  myPlayer: PlayerStateView | undefined;
  isMyTurn: boolean;
  onLeave: () => void | Promise<void>;
  onOpenSettings?: () => void;
  /** AFK 감지된 userId */
  afkUserId?: string | null;
  /** 현재 turn 카운트다운 — 모든 player turn에 표시 */
  remainingSec?: number | null;
}

/**
 * 작은 화면용 컴팩트 헤더 - 상대 + 내 점수 inline.
 * Sidebar 대신 사용.
 */
export function CompactHeader({
  view,
  myPlayer,
  isMyTurn,
  onLeave,
  onOpenSettings,
  afkUserId,
  remainingSec = null,
}: CompactHeaderProps) {
  const others = view.players.filter((p) => p.userId !== view.myUserId);
  const allowGukJoon = view.rules?.allowGukJoon ?? true;
  const myScore = myPlayer
    ? calculateScore(myPlayer.collected, {
        nineYeolAsSsangPi: myPlayer.flags?.nineYeolAsSsangPi ?? false,
        allowGukJoon,
      })
    : null;
  // 2인 게임은 7점, 3인은 3점부터 났음. 호스트 룰에서 winScore override 가능
  const canStop = myScore
    ? canDeclareGoStop(myScore, view.players.length, view.rules?.winScore)
    : false;

  return (
    <header className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-felt-900/60 bg-felt-900/40 px-2 py-1.5 text-xs">
      {/* 상대 정보 */}
      {others.map((p) => {
        const isThisTurn = view.turnUserId === p.userId;
        return (
          <OpponentBadge
            key={p.userId}
            player={p}
            isCurrentTurn={isThisTurn}
            allowGukJoon={allowGukJoon}
            isAfk={afkUserId === p.userId}
            remainingSec={isThisTurn ? remainingSec : null}
          />
        );
      })}

      <div className="mx-1 h-6 w-px bg-felt-700/60" />

      {/* 내 정보 (점수 분해 inline) */}
      {myPlayer ? (
        <div className="flex flex-1 items-center gap-1.5">
          <span className="text-lg">{myPlayer.emojiAvatar}</span>
          <span className="font-semibold text-felt-50">{myPlayer.nickname}</span>
          {myPlayer.flags?.shookMonths?.map((m) => (
            <span
              key={m}
              title={`${m}월 흔들기 — 점수 ×2`}
              className="rounded bg-amber-500/30 px-1 text-[10px] font-bold text-amber-100"
            >
              💪{m}월
            </span>
          ))}
          {myPlayer.flags?.bombs && myPlayer.flags.bombs > 0 ? (
            <span
              title={`폭탄 ${myPlayer.flags.bombs}개 — 점수 ×2`}
              className="rounded bg-rose-500/30 px-1 text-[10px] font-bold text-rose-100"
            >
              💣{myPlayer.flags.bombs}
            </span>
          ) : null}
          <TurnIndicator isCurrent={isMyTurn} goCount={myPlayer.goCount} />
          {myScore && (
            <>
              <span
                className={`ml-1 inline-flex items-baseline font-bold ${canStop ? 'text-amber-300' : 'text-felt-100'}`}
              >
                <AnimatedNumber value={myScore.total} />
                <span className="ml-0.5 text-[10px]">점</span>
              </span>
              {(() => {
                const m = computeMultiplier(myPlayer);
                return m > 1 ? (
                  <span
                    title={multiplierBreakdown(myPlayer)}
                    className="ml-1 rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-100"
                  >
                    ×{m}
                  </span>
                ) : null;
              })()}
              <ScoreBadge label="광" value={myScore.gwang} color="amber" />
              <ScoreBadge label="끗" value={myScore.yeol + myScore.godori} color="sky" />
              <ScoreBadge label="띠" value={myScore.ddi + myScore.dan} color="rose" />
              <ScoreBadge label="피" value={myScore.pi} color="stone" />
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 text-felt-300">👁️ 관전 중</div>
      )}

      {/* 설정 */}
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="flex h-6 w-6 items-center justify-center rounded border border-felt-700/60 bg-felt-950/60 text-felt-200 hover:bg-felt-800"
          title="설정"
          aria-label="설정"
        >
          ⚙️
        </button>
      )}

      {/* 나가기 */}
      <button
        onClick={onLeave}
        className="flex h-6 w-6 items-center justify-center rounded bg-rose-500/80 text-white hover:bg-rose-500"
        title="나가기"
      >
        🚪
      </button>
    </header>
  );
}

function OpponentBadge({
  player,
  isCurrentTurn,
  allowGukJoon = true,
  isAfk = false,
  remainingSec = null,
}: {
  player: PlayerStateView;
  isCurrentTurn: boolean;
  allowGukJoon?: boolean;
  isAfk?: boolean;
  remainingSec?: number | null;
}) {
  const score = calculateScore(player.collected, {
    nineYeolAsSsangPi: player.flags?.nineYeolAsSsangPi ?? false,
    allowGukJoon,
  });
  return (
    <div
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
        isCurrentTurn ? 'bg-amber-500/15 ring-1 ring-amber-400/60' : 'bg-felt-950/50'
      } ${!player.connected ? 'opacity-40' : ''}`}
    >
      <span className="text-base">{player.emojiAvatar}</span>
      <span className="max-w-[60px] truncate text-felt-100">{player.nickname}</span>
      {isAfk && <span title="응답 없음">💤</span>}
      <TurnIndicator isCurrent={isCurrentTurn} goCount={player.goCount} />
      {remainingSec !== null && (
        <span
          className={`rounded px-1 text-[10px] font-bold ${
            remainingSec <= 5 ? 'bg-rose-500/40 text-rose-200 animate-pulse' : 'bg-felt-950/60 text-felt-200'
          }`}
        >
          ⏱{remainingSec}
        </span>
      )}
      <span className="ml-0.5 inline-flex items-baseline rounded bg-amber-500/25 px-1 font-bold text-amber-200">
        <AnimatedNumber value={score.total} />
        <span className="ml-0.5 text-[9px]">점</span>
      </span>
    </div>
  );
}

function ScoreBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'amber' | 'sky' | 'rose' | 'stone';
}) {
  const colors = {
    amber: 'bg-amber-500/20 text-amber-200',
    sky: 'bg-sky-500/20 text-sky-200',
    rose: 'bg-rose-500/20 text-rose-200',
    stone: 'bg-stone-500/20 text-stone-200',
  };
  return (
    <span
      className={`inline-flex items-baseline rounded px-1 py-0.5 text-[10px] font-bold ${colors[color]}`}
      title={label}
    >
      {label}
      <AnimatedNumber value={value} className="ml-0.5" />
    </span>
  );
}
