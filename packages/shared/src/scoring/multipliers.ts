import type { Card } from '../types/card.ts';
import type { ScoreBreakdown } from './basic.ts';
import { calculateScore } from './basic.ts';

export interface MultiplierFlags {
  /** 피박 — 본인 피 점수 ≥ 1점 + 상대 피 1~5장 (0장은 면제) */
  pibak: boolean;
  /** 광박 — 본인 광 ≥ 3장 + 상대 광 0장 */
  gwangbak: boolean;
  /** 멍박 — 본인 끗 ≥ 5장 + 상대 끗 0장 (×2) */
  myungbak: boolean;
  /** 멍따 (멍텅구리 따블) — 본인 끗 ≥ 7장 (상대 무관) (×2). 멍박과 별개로 누적 */
  myungttadak: boolean;
  /** 고 횟수 (1=+1점, 2=+2점, 3=+3점 ×2, 4=+4점 ×4, 5=+5점 ×8 ...) */
  goCount: number;
  /** 흔들기 적용 횟수 (각 ×2 누적) */
  shookCount: number;
  /** 폭탄 적용 횟수 (각 ×2 누적) */
  bombCount: number;
  /** 고박 (독박) — 고 부른 사람이 진 경우. ×2 패널티 (호출자가 외부에서 결정) */
  gobak?: boolean;
  /** 나가리 누적 배수 — 직전 판이 나가리였으면 2, 2판 연속이면 4 (외부에서 결정) */
  nagariMultiplier?: number;
  /** 총통 — 시작 시 같은 월 4장 (즉시 승리, 통상 7점). 표시용 flag */
  chongtong?: boolean;
  /** 3뻑 자동 승리 — 한 player가 뻑 3번 누적 → 즉시 3점 승리 (rules-final.md 옵션) */
  ppeoksCausedWin?: boolean;
  /** 멍따 (끗 7장 ×2) 인정 여부 — 호스트 룰. default true */
  allowMyungttadak?: boolean;
}

export interface FinalScore {
  base: ScoreBreakdown;
  flags: MultiplierFlags;
  /** 박/배수 적용 전 base.total (고 보너스 미포함) */
  baseTotal: number;
  /** 고 보너스 점수 적용 후 (배수 적용 전): base.total + goCount */
  bonusedTotal: number;
  /** 모든 배수 적용 후 최종 점수 */
  finalTotal: number;
  /** 적용된 배수 (디스플레이용) */
  multiplier: number;
}

function piValue(cards: readonly Card[]): number {
  return cards
    .filter((c) => c.kind === 'pi')
    .reduce((sum, c) => sum + (c.isSsangPi ? 2 : 1), 0);
}

/** 모든 박/배수 flag가 false/0인 기본 객체 — 즉시 승리 케이스에서 base로 사용. */
function zeroFlags(): MultiplierFlags {
  return {
    pibak: false,
    gwangbak: false,
    myungbak: false,
    myungttadak: false,
    goCount: 0,
    shookCount: 0,
    bombCount: 0,
    gobak: false,
    nagariMultiplier: 1,
    chongtong: false,
    ppeoksCausedWin: false,
  };
}

/** 즉시 승리 결과 (총통 7점 / 3뻑 3점). 다른 모든 룰 무시. */
function instantWinResult(
  base: ScoreBreakdown,
  points: number,
  flagOverrides: Partial<MultiplierFlags>,
): FinalScore {
  return {
    base,
    flags: { ...zeroFlags(), ...flagOverrides },
    baseTotal: base.total,
    bonusedTotal: points,
    finalTotal: points,
    multiplier: 1,
  };
}

function gwangCount(cards: readonly Card[]): number {
  return cards.filter((c) => c.kind === 'gwang').length;
}

function yeolCount(cards: readonly Card[]): number {
  return cards.filter((c) => c.kind === 'yeol').length;
}

/**
 * 박/고/멍따/흔들기/폭탄 배수 적용한 최종 점수 (rules-final.md).
 *
 * 박 (각 ×2, 누적 곱):
 *   - 피박: 본인 피 점수 ≥ 1점 + 상대 피 1~5장 (0장 면제)
 *   - 광박: 본인 광 ≥ 3장 + 상대 광 0장
 *   - 멍박: 본인 끗 ≥ 5장 + 상대 끗 0장
 *   - 멍따: 본인 끗 ≥ 7장 (상대 무관)
 *
 * 고 보너스 + 배수:
 *   1고 +1점,  2고 +2점,  3고 +3점 ×2,  4고 +4점 ×4,  5고 +5점 ×8 ...
 *   (3고부터 ×2 누적: multiplier = 2^(goCount-2))
 *
 * 흔들기 / 폭탄: 각 ×2 누적.
 *
 * 최종 점수 = (base.total + goCount) × 모든 배수 곱
 */
export function calculateFinalScore(
  myCollected: readonly Card[],
  opponentsCollected: readonly (readonly Card[])[],
  flags: Pick<MultiplierFlags, 'goCount' | 'shookCount' | 'bombCount'> &
    Pick<
      Partial<MultiplierFlags>,
      | 'gobak'
      | 'nagariMultiplier'
      | 'chongtong'
      | 'ppeoksCausedWin'
      | 'allowMyungttadak'
    > & {
      /** 본인 9월 열끗을 쌍피로 변환 (rules-final.md §1-5) */
      nineYeolAsSsangPi?: boolean;
      /**
       * 흔들기/폭탄 점수 처리 방식:
       *   'multiplier' (default): 각 ×2 누적 (표준)
       *   'addPoint': 보너스 점수 +N (변형 — multiplier 효과 X)
       */
      shakeBonusType?: 'multiplier' | 'addPoint';
      /**
       * 국준(9월 쌍피, m09-ssangpi) 인정 여부.
       * false면 일반 피 1장 가치로 카운트 (default true).
       */
      allowGukJoon?: boolean;
    },
): FinalScore {
  const base = calculateScore(myCollected, {
    nineYeolAsSsangPi: flags.nineYeolAsSsangPi,
    allowGukJoon: flags.allowGukJoon,
  });

  // 즉시 승리 케이스 (다른 모든 룰 무시)
  if (flags.chongtong) return instantWinResult(base, 7, { chongtong: true });
  if (flags.ppeoksCausedWin) return instantWinResult(base, 3, { ppeoksCausedWin: true });

  // 9월 열끗 쌍피 변환 시 본인 피/끗 통계 조정 (박 판정에 사용)
  const has9Yeol =
    flags.nineYeolAsSsangPi && myCollected.some((c) => c.id === 'm09-yeol');
  const myPi = piValue(myCollected) + (has9Yeol ? 2 : 0);
  const myGwang = gwangCount(myCollected);
  const myYeol = yeolCount(myCollected) - (has9Yeol ? 1 : 0);

  // 상대 통계 (모든 상대 중 최저)
  const opponentMinPi = opponentsCollected.length
    ? Math.min(...opponentsCollected.map(piValue))
    : Number.POSITIVE_INFINITY;
  const opponentHasNoGwang = opponentsCollected.some((c) => gwangCount(c) === 0);
  const opponentHasNoYeol = opponentsCollected.some((c) => yeolCount(c) === 0);

  // 박 판정
  // 피박 — 피 점수가 났음(피 가치 10 이상) + 상대 피 1~5장 (0장은 면제)
  const pibak = myPi >= 10 && opponentMinPi >= 1 && opponentMinPi <= 5;
  const gwangbak = myGwang >= 3 && opponentHasNoGwang;
  // 멍박 — 끗 점수가 났음(5장 이상) + 상대 0장
  const myungbak = myYeol >= 5 && opponentHasNoYeol;
  // 멍따 — 끗 7장 이상 (상대 무관). 멍박과 별개 — 둘 다 만족 시 ×4
  // 호스트 룰에서 비활성화 가능 (allowMyungttadak === false)
  const myungttadakEnabled = flags.allowMyungttadak ?? true;
  const myungttadak = myungttadakEnabled && myYeol >= 7;

  // 배수 누적 곱
  let multiplier = 1;
  if (pibak) multiplier *= 2;
  if (gwangbak) multiplier *= 2;
  if (myungbak) multiplier *= 2;
  if (myungttadak) multiplier *= 2;

  // 고 배수: 3고부터 ×2 누적 (1고/2고는 보너스 점수만)
  if (flags.goCount >= 3) {
    multiplier *= Math.pow(2, flags.goCount - 2);
  }

  // 흔들기/폭탄 — 'multiplier'면 각 ×2 누적, 'addPoint'면 점수 보너스로 변환 (변형 룰)
  const shakeMode = flags.shakeBonusType ?? 'multiplier';
  let shakeAddPoints = 0;
  if (shakeMode === 'multiplier') {
    multiplier *= Math.pow(2, flags.shookCount);
    multiplier *= Math.pow(2, flags.bombCount);
  } else {
    // 'addPoint' — 흔들기/폭탄당 +1점씩 (multiplier 효과 X)
    shakeAddPoints = flags.shookCount + flags.bombCount;
  }

  // 고박 (독박) — 고 부른 사람이 진 경우 ×2 패널티 (호출자가 결정)
  if (flags.gobak) multiplier *= 2;

  // 나가리 누적 — 직전 판이 무승부였으면 ×2, 2판 연속이면 ×4
  const nagariMultiplier = flags.nagariMultiplier ?? 1;
  multiplier *= nagariMultiplier;

  // 고 보너스 점수: 1고 +1, 2고 +2, ...
  const bonusedTotal = base.total + flags.goCount + shakeAddPoints;
  const finalTotal = bonusedTotal * multiplier;

  return {
    base,
    flags: {
      pibak,
      gwangbak,
      myungbak,
      myungttadak,
      goCount: flags.goCount,
      shookCount: flags.shookCount,
      bombCount: flags.bombCount,
      gobak: flags.gobak ?? false,
      nagariMultiplier,
      chongtong: flags.chongtong ?? false,
    },
    baseTotal: base.total,
    bonusedTotal,
    finalTotal,
    multiplier,
  };
}
