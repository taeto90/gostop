import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import type { RoomView } from '@gostop/shared';
import { useGameHistoryStore } from '../../stores/gameHistoryStore.ts';
import { useRoomStore } from '../../stores/roomStore.ts';
import { emitWithAck } from '../../lib/socket.ts';
import { playSound } from '../../lib/sound.ts';
import { useElementSize } from '../../hooks/useElementSize.ts';
import { isCompactWidth, RESULT_CARD_WIDTH } from '../../lib/layoutConstants.ts';
import { buildRankedPlayers } from './result/helpers.ts';
import { Badge, CollectedGroups, FlagBadge } from './result/Badges.tsx';
import { toast } from '../../stores/toastStore.ts';

interface ResultViewProps {
  view: RoomView;
  /** 솔로 모드용 — actor별 고 카운트 (외부 주입) */
  goCounts?: Record<string, number>;
  /**
   * 호스트가 "🎮 게임으로" 클릭 시 호출. RoomScreen이 room:return-to-lobby
   * emit → phase='waiting' broadcast → RoomLobbyModal 다시 표시.
   */
  onStartNextRound?: () => void;
  /**
   * 멀티 흐름 — 비호스트가 "닫기" 클릭 시 호출. 정의되면 RoomScreen이
   * 본인 endedSnapshot만 dismiss. 정의 안 되어 있으면 버튼 숨김.
   */
  onDismiss?: () => void;
}

export function ResultView({
  view,
  goCounts,
  onStartNextRound,
  onDismiss,
}: ResultViewProps) {
  const navigate = useNavigate();
  const clear = useRoomStore((s) => s.clear);
  const [rootRef, { width: rootW }] = useElementSize<HTMLDivElement>();
  const isCompact = isCompactWidth(rootW);
  const cardW = isCompact ? RESULT_CARD_WIDTH.mobile : RESULT_CARD_WIDTH.pc;

  const ranked = buildRankedPlayers(view, goCounts);

  const top = ranked[0];
  const winners = top
    ? ranked.filter((r) => r.final.finalTotal === top.final.finalTotal)
    : [];
  const isDraw = winners.length > 1;
  const amWinner = winners.some((w) => w.userId === view.myUserId);

  useEffect(() => {
    playSound('game-end');
  }, []);

  // 게임 종료 시 히스토리에 저장 — 1회만 (StrictMode 대응 ref guard)
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const me = ranked.find((r) => r.userId === view.myUserId);
    if (!me) return; // 관전자는 본인 결과 없음 — 저장 안 함
    useGameHistoryStore.getState().pushEntry({
      mode: view.roomId === 'SOLO' ? 'solo' : 'multi',
      myUserId: view.myUserId,
      myFinalScore: me.final.finalTotal,
      amWinner,
      players: ranked.map((r) => ({
        userId: r.userId,
        nickname: r.nickname,
        emojiAvatar: r.emojiAvatar,
        finalScore: r.final.finalTotal,
        isWinner: winners.some((w) => w.userId === r.userId),
      })),
      flags: {
        chongtong: me.final.flags.chongtong || undefined,
        ppeoksCausedWin: me.final.flags.ppeoksCausedWin || undefined,
        pibak: me.final.flags.pibak || undefined,
        gwangbak: me.final.flags.gwangbak || undefined,
        myungbak: me.final.flags.myungbak || undefined,
        myungttadak: me.final.flags.myungttadak || undefined,
        gobak: me.final.flags.gobak || undefined,
        nagariMultiplier:
          (me.final.flags.nagariMultiplier ?? 1) > 1
            ? me.final.flags.nagariMultiplier
            : undefined,
        goCount: me.final.flags.goCount > 0 ? me.final.flags.goCount : undefined,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHost = view.hostUserId === view.myUserId;

  async function leaveRoom() {
    await emitWithAck('room:leave');
    clear();
    navigate('/');
  }

  function nextRound() {
    onStartNextRound?.();
  }

  /** 테스트 모드 한정 — 같은 시나리오로 즉시 재시작 (호스트). 로비 거치지 않음. */
  async function testRestart() {
    const r = await emitWithAck('game:test-restart');
    if (!r.ok) toast.error(r.error);
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-3 text-felt-50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="my-auto flex w-full max-w-3xl flex-col rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-4 shadow-2xl"
      >
        {/* 헤더 */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          className="mb-3 text-center"
        >
          <div className="text-sm font-semibold text-felt-200">🏁 게임 종료</div>
          <div className="text-3xl font-extrabold text-amber-300">
            {isDraw
              ? '🤝 무승부!'
              : amWinner
                ? '🏆 우승!'
                : `${top?.emojiAvatar} ${top?.nickname} 우승`}
          </div>
        </motion.div>

        {/* 우승자 박스 */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
          className="mb-4 rounded-xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/15 to-amber-600/5 p-4 text-center shadow-[0_0_24px_rgba(251,191,36,0.25)]"
        >
          <div className="flex items-center justify-center gap-3">
            {winners.map((w) => (
              <div key={w.userId} className="flex flex-col items-center">
                <div className="text-5xl">{w.emojiAvatar}</div>
                <div className="mt-1 text-base font-bold">{w.nickname}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-3xl font-black text-amber-300">
            {top?.final.finalTotal}점
            {top && top.final.multiplier > 1 && (
              <span className="ml-2 text-sm font-bold text-amber-400">
                ({top.final.baseTotal} × {top.final.multiplier})
              </span>
            )}
          </div>
          {top && (
            <div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[11px]">
              {top.final.flags.chongtong && (
                <FlagBadge color="amber">👑 총통</FlagBadge>
              )}
              {top.final.flags.pibak && <FlagBadge color="rose">피박 ×2</FlagBadge>}
              {top.final.flags.gwangbak && <FlagBadge color="amber">광박 ×2</FlagBadge>}
              {top.final.flags.myungbak && <FlagBadge color="sky">멍박 ×2</FlagBadge>}
              {top.final.flags.myungttadak && (
                <FlagBadge color="sky">멍따 ×2</FlagBadge>
              )}
              {top.final.flags.goCount >= 3 && (
                <FlagBadge color="rose">
                  {top.final.flags.goCount}고 ×{Math.pow(2, top.final.flags.goCount - 2)}
                </FlagBadge>
              )}
              {top.final.flags.gobak && <FlagBadge color="rose">고박 ×2</FlagBadge>}
              {(top.final.flags.nagariMultiplier ?? 1) > 1 && (
                <FlagBadge color="amber">
                  나가리 ×{top.final.flags.nagariMultiplier}
                </FlagBadge>
              )}
            </div>
          )}
        </motion.div>

        {/* 순위 — 모바일: 1 col, PC: 2 col */}
        <div
          className={`grid flex-1 gap-2 overflow-y-auto pb-3 ${
            isCompact ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {ranked.map((r, idx) => (
            <motion.div
              key={r.userId}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + idx * 0.08 }}
              className={`rounded-lg border p-3 ${
                idx === 0
                  ? 'border-amber-500/60 bg-amber-500/10'
                  : 'border-felt-900/60 bg-felt-900/40'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-bold text-felt-300">#{idx + 1}</span>
                <span className="text-2xl">{r.emojiAvatar}</span>
                <span className="flex-1 truncate font-semibold">{r.nickname}</span>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-amber-300">
                    {r.final.finalTotal}점
                  </span>
                  {r.final.multiplier > 1 && (
                    <div className="text-[9px] text-amber-400/80">
                      {r.final.baseTotal} × {r.final.multiplier}
                    </div>
                  )}
                </div>
              </div>

              {/* 박/특수 flag — 각 player별 */}
              {(r.final.flags.chongtong ||
                r.final.flags.pibak ||
                r.final.flags.gwangbak ||
                r.final.flags.myungbak ||
                r.final.flags.myungttadak ||
                r.final.flags.gobak ||
                (r.final.flags.nagariMultiplier ?? 1) > 1 ||
                r.final.flags.goCount >= 3) && (
                <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                  {r.final.flags.chongtong && (
                    <Badge color="amber">👑 총통</Badge>
                  )}
                  {r.final.flags.ppeoksCausedWin && (
                    <Badge color="rose">🚫 3뻑 자동승리</Badge>
                  )}
                  {r.final.flags.pibak && <Badge color="rose">피박 ×2</Badge>}
                  {r.final.flags.gwangbak && <Badge color="amber">광박 ×2</Badge>}
                  {r.final.flags.myungbak && <Badge color="sky">멍박 ×2</Badge>}
                  {r.final.flags.myungttadak && <Badge color="sky">멍따 ×2</Badge>}
                  {r.final.flags.goCount >= 3 && (
                    <Badge color="rose">
                      {r.final.flags.goCount}고 ×{Math.pow(2, r.final.flags.goCount - 2)}
                    </Badge>
                  )}
                  {r.final.flags.gobak && <Badge color="rose">고박 ×2</Badge>}
                  {(r.final.flags.nagariMultiplier ?? 1) > 1 && (
                    <Badge color="amber">
                      나가리 ×{r.final.flags.nagariMultiplier}
                    </Badge>
                  )}
                </div>
              )}

              {/* 점수 분해 뱃지 */}
              <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                {r.score.gwang > 0 && (
                  <Badge color="amber">광 {r.score.gwang}</Badge>
                )}
                {r.score.yeol > 0 && <Badge color="sky">끗 {r.score.yeol}</Badge>}
                {r.score.godori > 0 && (
                  <Badge color="sky">고도리 +{r.score.godori}</Badge>
                )}
                {r.score.ddi > 0 && <Badge color="rose">띠 {r.score.ddi}</Badge>}
                {r.score.dan > 0 && <Badge color="rose">단 +{r.score.dan}</Badge>}
                {r.score.pi > 0 && <Badge color="stone">피 {r.score.pi}</Badge>}
              </div>

              {/* 딴패 시각화 — 종류별 그룹 (광/끗/띠/피), 같은 종류 카드는 -space-x stack */}
              {r.collected.length > 0 && (
                <CollectedGroups collected={r.collected} cardW={cardW} />
              )}
            </motion.div>
          ))}
        </div>

        {/* 액션 버튼 — 호스트는 "🎮 게임으로" / 비호스트는 onDismiss 있으면 "닫기" */}
        {/* testMode 한정: 호스트에게 "🔁 같은 시나리오 다시" 버튼 — 로비 거치지 않고 즉시 재시작 */}
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={leaveRoom}
            className="rounded bg-slate-700 px-6 py-2 font-semibold hover:bg-slate-600"
          >
            🚪 로비로
          </button>
          {!isHost && onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded bg-amber-500 px-6 py-2 font-bold text-slate-950 shadow-lg hover:bg-amber-400"
            >
              🎮 게임으로
            </button>
          )}
          {isHost && view.testMode && (
            <button
              onClick={() => void testRestart()}
              className="rounded bg-rose-500 px-6 py-2 font-bold text-white shadow-lg hover:bg-rose-400"
            >
              🔁 같은 시나리오 다시
            </button>
          )}
          {isHost && (
            <button
              onClick={nextRound}
              className="rounded bg-amber-500 px-6 py-2 font-bold text-slate-950 shadow-lg hover:bg-amber-400"
            >
              🎮 게임으로
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
