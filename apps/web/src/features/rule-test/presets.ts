import {
  createBombCard,
  createJokerCard,
  getCardById,
  type Card,
} from '@gostop/shared';

const c = (id: string): Card => {
  const card = getCardById(id);
  if (!card) throw new Error(`Card ${id} not found`);
  return card;
};

export interface RuleTestPreset {
  id: string;
  label: string;
  description: string;
  /** executeTurn에 전달할 손패 */
  hand: Card[];
  /** 바닥 */
  field: Card[];
  /** 더미 (첫 카드가 뒤집힘) */
  deck: Card[];
  /** 시작 시 본인 collected (박/멍따 검증용) */
  collected: Card[];
  /** 클릭할 카드 — 손패에 있어야 함 */
  cardToPlay: string;
  /** 마지막 턴 여부 */
  isLastTurn?: boolean;
  /** stuck owner (자뻑 검증용) */
  stuckOwners?: Record<number, string>;
  /**
   * true면 executeTurn 호출 X — 박/멍따/고박/총통 같은 결과 시점 시나리오용.
   * `evaluateAsFinal: true`로 calculateFinalScore 호출
   */
  skipExecute?: boolean;
  evaluateAsFinal?: boolean;
  /** finalScore 계산용 — 상대 collected (박 발동 검증용) */
  opponents?: Card[][];
  goCount?: number;
  shookCount?: number;
  bombCount?: number;
  gobak?: boolean;
  chongtong?: boolean;
  ppeoksCausedWin?: boolean;
  nagariMultiplier?: number;
  allowMyungttadak?: boolean;
}

/** 기본 더미 — 매칭 안 되는 카드 한 장 (placed 처리됨) */
const PLAIN_DECK = [c('m11-pi-1'), c('m04-pi-1')];

export const PRESETS: RuleTestPreset[] = [
  {
    id: 'normal',
    label: '🟢 일반 매칭',
    description: '바닥 1장 + 손패 1장 매칭 → 둘 다 가져감',
    hand: [c('m01-pi-1')],
    field: [c('m01-pi-2')],
    deck: PLAIN_DECK,
    collected: [],
    cardToPlay: 'm01-pi-1',
  },
  {
    id: 'ppeok',
    label: '🚫 뻑',
    description: '바닥 같은 월 2장 + 손패 1장 = 3장 stuck',
    hand: [c('m05-pi-1')],
    field: [c('m05-yeol'), c('m05-ddi')],
    deck: PLAIN_DECK,
    collected: [],
    cardToPlay: 'm05-pi-1',
  },
  {
    id: 'ja-ppeok',
    label: '💥 자뻑 회수',
    description: '이전 본인이 싼 5월 뻑 (3장 stuck)을 손패 1장으로 회수',
    hand: [c('m05-pi-2')],
    // 바닥에 5월 3장 stuck (이미 뻑 발생 상태)
    field: [c('m05-yeol'), c('m05-ddi'), c('m05-pi-1')],
    deck: PLAIN_DECK,
    collected: [],
    cardToPlay: 'm05-pi-2',
    stuckOwners: { 5: 'me' },
  },
  {
    id: 'ttadak',
    label: '✨ 따닥',
    description: '바닥 5월 2장 + 손패 5월 + 더미 5월 = 4장 한 번에',
    hand: [c('m05-pi-1')],
    field: [c('m05-yeol'), c('m05-ddi')],
    deck: [c('m05-pi-2'), c('m11-pi-1')],
    collected: [],
    cardToPlay: 'm05-pi-1',
  },
  {
    id: 'jjok',
    label: '💋 쪽',
    description: '손패 placed (매칭 X) + 더미 같은 월 → 둘 다 가져감',
    hand: [c('m05-pi-1')],
    field: [c('m07-pi-1'), c('m08-pi-1')], // 5월 X
    deck: [c('m05-yeol'), c('m11-pi-1')],
    collected: [],
    cardToPlay: 'm05-pi-1',
  },
  {
    id: 'sweep',
    label: '🧹 싹쓸이',
    description: '매칭 후 바닥 0장 → 피 1장 추가',
    hand: [c('m05-pi-1')],
    field: [c('m05-yeol')], // 1장만
    deck: [c('m11-pi-1'), c('m04-pi-1')], // 더미는 다른 월
    collected: [],
    cardToPlay: 'm05-pi-1',
  },
  {
    id: 'bomb',
    label: '💣 폭탄',
    description: '손패 같은 월 3장 + 바닥 1장 → 4장 한 번에 (자동 발동)',
    hand: [c('m05-yeol'), c('m05-ddi'), c('m05-pi-1')],
    field: [c('m05-pi-2')],
    deck: PLAIN_DECK,
    collected: [],
    cardToPlay: 'm05-yeol',
  },
  (() => {
    // 폭탄 보너스 카드 사용 시나리오 — 폭탄 발동 후 손패에 추가된 폭탄 카드를 클릭
    const bomb = createBombCard();
    return {
      id: 'bomb-bonus-card',
      label: '💣 폭탄 보너스 카드',
      description:
        '폭탄 발동 후 손패에 추가된 보너스 카드 클릭 → 손패에서 제거 + 더미만 1장 뒤집기',
      hand: [c('m01-pi-1'), bomb],
      field: [c('m07-pi-1')],
      deck: [c('m07-pi-2'), c('m04-pi-1')],
      collected: [],
      cardToPlay: bomb.id,
    };
  })(),
  (() => {
    // 조커 카드 사용 시나리오
    const joker = createJokerCard();
    return {
      id: 'joker',
      label: '🃏 조커 카드',
      description:
        '조커 클릭 시 collected에 쌍피 가치로 추가 + 더미 1장 뒤집기',
      hand: [c('m01-pi-1'), joker],
      field: [c('m07-pi-1')],
      deck: [c('m07-pi-2'), c('m04-pi-1')],
      collected: [],
      cardToPlay: joker.id,
    };
  })(),
  {
    id: 'last-turn-sweep',
    label: '⏱ 마지막 턴 싹쓸이 예외',
    description: '마지막 턴 싹쓸이는 피 빼앗기 X (관례)',
    hand: [c('m05-pi-1')],
    field: [c('m05-yeol')],
    deck: [],
    collected: [],
    cardToPlay: 'm05-pi-1',
    isLastTurn: true,
  },
  // ===== 결과 시점 시나리오 (calculateFinalScore) =====
  {
    id: 'chongtong',
    label: '👑 총통',
    description: '시작 시 손패 같은 월 4장 → 즉시 7점 승리',
    hand: [],
    field: [],
    deck: [],
    collected: [c('m05-yeol'), c('m05-ddi'), c('m05-pi-1'), c('m05-pi-2')],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    chongtong: true,
  },
  {
    id: 'pibak',
    label: '💢 피박',
    description: '본인 피 10장+ AND 상대 피 1~5장 → ×2',
    hand: [],
    field: [],
    deck: [],
    collected: [
      c('m01-pi-1'), c('m01-pi-2'),
      c('m02-pi-1'), c('m02-pi-2'),
      c('m03-pi-1'), c('m03-pi-2'),
      c('m04-pi-1'), c('m04-pi-2'),
      c('m05-pi-1'), c('m05-pi-2'),
    ],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    opponents: [[c('m06-pi-1'), c('m06-pi-2'), c('m07-pi-1'), c('m07-pi-2'), c('m08-pi-1')]],
  },
  {
    id: 'gwangbak',
    label: '💢 광박',
    description: '본인 광 3장 + 상대 광 0장 → ×2',
    hand: [],
    field: [],
    deck: [],
    collected: [c('m01-gwang'), c('m03-gwang'), c('m08-gwang')],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    opponents: [[c('m02-pi-1')]],
  },
  {
    id: 'myungttadak',
    label: '🐦 멍따 (끗 7장)',
    description: '끗 7장 → ×2 (상대 무관)',
    hand: [],
    field: [],
    deck: [],
    collected: [
      c('m02-yeol'),
      c('m04-yeol'),
      c('m05-yeol'),
      c('m06-yeol'),
      c('m07-yeol'),
      c('m09-yeol'),
      c('m10-yeol'),
    ],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    opponents: [[c('m08-yeol')]],
  },
  {
    id: 'go-3',
    label: '🔥 3고',
    description: '3고 = 점수 +3 + ×2 누적',
    hand: [],
    field: [],
    deck: [],
    collected: [c('m01-gwang'), c('m03-gwang'), c('m08-gwang')], // 3광 = 3점
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    opponents: [[c('m02-pi-1'), c('m02-pi-2')]], // 광 0 → 광박
    goCount: 3,
  },
  {
    id: 'gobak',
    label: '🚫 고박',
    description: '본인이 고 부르고 졌을 때 ×2 패널티',
    hand: [],
    field: [],
    deck: [],
    collected: [c('m01-gwang'), c('m03-gwang'), c('m08-gwang')],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    opponents: [[c('m02-pi-1')]],
    goCount: 1,
    gobak: true,
  },
  {
    id: 'three-ppeok',
    label: '🚫 3뻑 자동승리',
    description: '뻑 3번 누적 → 즉시 3점 승리',
    hand: [],
    field: [],
    deck: [],
    collected: [],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    ppeoksCausedWin: true,
  },
  {
    id: 'nagari',
    label: '🤝 나가리 누적 ×4',
    description: '직전 2판 연속 나가리 → 다음 판 ×4',
    hand: [],
    field: [],
    deck: [],
    collected: [c('m01-gwang'), c('m03-gwang'), c('m08-gwang')],
    cardToPlay: '',
    skipExecute: true,
    evaluateAsFinal: true,
    opponents: [[c('m02-pi-1')]],
    nagariMultiplier: 4,
  },
];
