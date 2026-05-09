import type { RoomView, Card as CardType } from '@gostop/shared';
import { calculateFinalScore, calculateScore } from '@gostop/shared';

/** Solo 모드 userId → actor key 매핑 */
export function mapToActor(userId: string, myUserId: string): string {
  if (userId === myUserId) return 'me';
  if (userId === 'ai-bot-1') return 'ai1';
  if (userId === 'ai-bot-2') return 'ai2';
  return userId;
}

/**
 * 승자 결정 — 우선순위: 총통 > 3뻑 자동승리 > 점수 1위(임계값 이상).
 * 임계값 미만은 winner 없음 (나가리 또는 진행 중).
 */
export function decideWinnerUserId(view: RoomView): string | null {
  if (view.chongtongUserId) return view.chongtongUserId;
  const threePpeokWinner = view.players.find(
    (p) => (p.flags?.ppeoksCaused ?? 0) >= 3,
  );
  if (threePpeokWinner) return threePpeokWinner.userId;
  const threshold = view.rules?.winScore ?? (view.players.length === 2 ? 7 : 3);
  const baseScores = view.players.map((p) => ({
    userId: p.userId,
    total: calculateScore(p.collected, {
      nineYeolAsSsangPi: p.flags?.nineYeolAsSsangPi ?? false,
    }).total,
  }));
  const maxBase = Math.max(0, ...baseScores.map((s) => s.total));
  if (maxBase < threshold) return null;
  return baseScores.find((s) => s.total === maxBase)?.userId ?? null;
}

export interface RankedPlayer {
  userId: string;
  nickname: string;
  emojiAvatar: string;
  collected: readonly CardType[];
  score: ReturnType<typeof calculateScore>;
  final: ReturnType<typeof calculateFinalScore>;
}

/**
 * 모든 player의 최종 점수(박/배수/고박/총통/3뻑 적용) 계산 후 점수 내림차순 정렬.
 */
export function buildRankedPlayers(
  view: RoomView,
  goCounts?: Record<string, number>,
): RankedPlayer[] {
  const winnerUserId = decideWinnerUserId(view);
  const threePpeokWinner = view.players.find(
    (p) => (p.flags?.ppeoksCaused ?? 0) >= 3,
  );

  return [...view.players]
    .map((p) => {
      const opponents = view.players
        .filter((o) => o.userId !== p.userId)
        .map((o) => o.collected);
      const goCount =
        goCounts?.[mapToActor(p.userId, view.myUserId)] ?? p.goCount ?? 0;
      const gobak =
        goCount > 0 && winnerUserId !== null && winnerUserId !== p.userId;
      const nineYeolAsSsangPi = p.flags?.nineYeolAsSsangPi ?? false;
      const allowGukJoon = view.rules?.allowGukJoon ?? true;
      const final = calculateFinalScore(p.collected, opponents, {
        goCount,
        shookCount: p.flags?.shookMonths?.length ?? 0,
        bombCount: p.flags?.bombs ?? 0,
        gobak,
        nagariMultiplier: view.nagariMultiplier ?? 1,
        chongtong: view.chongtongUserId === p.userId,
        ppeoksCausedWin: threePpeokWinner?.userId === p.userId,
        allowMyungttadak: view.rules?.allowMyungttadak ?? true,
        shakeBonusType: view.rules?.shakeBonusType ?? 'multiplier',
        nineYeolAsSsangPi,
        allowGukJoon,
      });
      return {
        userId: p.userId,
        nickname: p.nickname,
        emojiAvatar: p.emojiAvatar,
        collected: p.collected,
        score: calculateScore(p.collected, { nineYeolAsSsangPi, allowGukJoon }),
        final,
      };
    })
    .sort((a, b) => b.final.finalTotal - a.final.finalTotal);
}
