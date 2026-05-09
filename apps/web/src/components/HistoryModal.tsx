import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  aggregatePlayerStats,
  useGameHistoryStore,
} from '../stores/gameHistoryStore.ts';

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * 정의되어 있으면 푸터에 "🏠 로비로" 버튼 노출. ResultView처럼 방에 있을 때만 의미가 있어
   * 호출자가 leave 처리(emit room:leave + 방 store clear + navigate)를 직접 수행.
   */
  onGoToLobby?: () => void;
}

/**
 * 게임 전적 모달 — localStorage에 저장된 최근 50판 히스토리 + 친구별 통계.
 *
 * 두 탭: "최근 게임" / "친구별 통계"
 */
export function HistoryModal({ open, onClose, onGoToLobby }: HistoryModalProps) {
  const entries = useGameHistoryStore((s) => s.entries);
  const clear = useGameHistoryStore((s) => s.clear);
  const [tab, setTab] = useState<'recent' | 'players'>('recent');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const stats = aggregatePlayerStats(entries);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 10 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-felt-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 + 탭 */}
            <div className="border-b border-felt-800/60 px-5 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-bold text-felt-100">
                  📊 게임 전적 <span className="text-xs font-normal text-felt-400">(최근 {entries.length}판)</span>
                </span>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-1">
                <TabButton active={tab === 'recent'} onClick={() => setTab('recent')}>
                  📜 최근 게임
                </TabButton>
                <TabButton active={tab === 'players'} onClick={() => setTab('players')}>
                  👥 친구별 통계
                </TabButton>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {entries.length === 0 ? (
                <div className="m-auto py-12 text-center text-sm text-felt-400">
                  아직 게임 기록이 없습니다.
                </div>
              ) : (
                <>
                  <MyStatsBanner entries={entries} />
                  {tab === 'recent' ? (
                    <RecentGames />
                  ) : (
                    <PlayerStatsList stats={stats} />
                  )}
                </>
              )}
            </div>

            {/* 푸터 */}
            {(entries.length > 0 || onGoToLobby) && (
              <div className="flex items-center justify-between border-t border-felt-800/60 px-4 py-2">
                {onGoToLobby ? (
                  <button
                    onClick={onGoToLobby}
                    className="rounded bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    🏠 로비로
                  </button>
                ) : (
                  <span />
                )}
                {entries.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('전적을 모두 초기화할까요?')) clear();
                    }}
                    className="text-xs text-felt-500 hover:text-rose-300"
                  >
                    🗑 전적 초기화
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-xs font-bold transition ${
        active
          ? 'bg-amber-500/30 text-amber-200'
          : 'bg-felt-950/40 text-felt-400 hover:bg-felt-800/60'
      }`}
    >
      {children}
    </button>
  );
}

function MyStatsBanner({ entries }: { entries: ReturnType<typeof useGameHistoryStore.getState>['entries'] }) {
  const total = entries.length;
  const wins = entries.filter((e) => e.amWinner).length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalScore = entries.reduce((acc, e) => acc + e.myFinalScore, 0);
  const avgScore = total > 0 ? Math.round(totalScore / total) : 0;
  const bestScore = entries.reduce((acc, e) => Math.max(acc, e.myFinalScore), 0);
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label="전적" value={`${wins}승 / ${total}판`} accent />
      <StatTile label="승률" value={`${winRate}%`} accent={winRate >= 50} />
      <StatTile label="평균 점수" value={`${avgScore}점`} />
      <StatTile label="최고 점수" value={`${bestScore}점`} />
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        accent
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-felt-800/60 bg-felt-900/40'
      }`}
    >
      <div className="text-[10px] font-bold text-felt-400">{label}</div>
      <div className={`mt-0.5 text-base font-bold ${accent ? 'text-amber-200' : 'text-felt-100'}`}>
        {value}
      </div>
    </div>
  );
}

function RecentGames() {
  const entries = useGameHistoryStore((s) => s.entries);
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className={`rounded-lg border p-3 ${
            e.amWinner
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-felt-800/60 bg-felt-900/40'
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-felt-300">
              {e.amWinner ? '🏆 우승' : '💔 패배'}
              <span className="ml-1 font-bold text-felt-100">{e.myFinalScore}점</span>
            </span>
            <span className="text-felt-500">{formatTime(e.timestamp)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {e.players.map((p) => (
              <span
                key={p.userId}
                className={`rounded border px-1.5 py-0.5 ${
                  p.isWinner
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                    : 'border-felt-800 bg-felt-950/40 text-felt-300'
                }`}
              >
                {p.emojiAvatar} {p.nickname} {p.finalScore}점
              </span>
            ))}
          </div>
          {hasFlags(e.flags) && (
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
              {e.flags.chongtong && <FlagBadge>👑 총통</FlagBadge>}
              {e.flags.ppeoksCausedWin && <FlagBadge>🚫 3뻑</FlagBadge>}
              {e.flags.pibak && <FlagBadge>피박</FlagBadge>}
              {e.flags.gwangbak && <FlagBadge>광박</FlagBadge>}
              {e.flags.myungbak && <FlagBadge>멍박</FlagBadge>}
              {e.flags.myungttadak && <FlagBadge>멍따</FlagBadge>}
              {e.flags.gobak && <FlagBadge>고박</FlagBadge>}
              {(e.flags.goCount ?? 0) >= 3 && (
                <FlagBadge>{e.flags.goCount}고</FlagBadge>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlayerStatsList({
  stats,
}: {
  stats: ReturnType<typeof aggregatePlayerStats>;
}) {
  return (
    <div className="space-y-2">
      {stats.map((s, idx) => {
        const winRate = s.rounds > 0 ? Math.round((s.wins / s.rounds) * 100) : 0;
        const avgScore = s.rounds > 0 ? Math.round(s.totalScore / s.rounds) : 0;
        return (
          <div
            key={s.userId}
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              idx === 0
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-felt-800/60 bg-felt-900/40'
            }`}
          >
            <span className="text-3xl">{s.emojiAvatar}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold text-felt-100">
                  {s.nickname}
                </span>
                {idx === 0 && (
                  <span className="text-[10px] text-amber-300">👑 1위</span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-felt-300">
                {s.wins}승 / {s.rounds}판 ·{' '}
                <span className="font-bold text-amber-300">{winRate}%</span> · 평균{' '}
                {avgScore}점 · 최고 {s.bestScore}점
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FlagBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-200">
      {children}
    </span>
  );
}

function hasFlags(flags: {
  chongtong?: boolean;
  pibak?: boolean;
  gwangbak?: boolean;
  myungbak?: boolean;
  myungttadak?: boolean;
  gobak?: boolean;
  ppeoksCausedWin?: boolean;
  goCount?: number;
}): boolean {
  return Boolean(
    flags.chongtong ||
      flags.pibak ||
      flags.gwangbak ||
      flags.myungbak ||
      flags.myungttadak ||
      flags.gobak ||
      flags.ppeoksCausedWin ||
      (flags.goCount ?? 0) >= 3,
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
