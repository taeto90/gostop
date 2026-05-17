/**
 * 테스트 모드 v2 — preset 시나리오로 카드 미리 세팅.
 *
 * 게임 로직은 손대지 않음. 분배 단계만 변경 → 정상 게임 흐름으로
 * 각 이펙트가 의도대로 발동하는지 검증.
 *
 * 명시되지 않은 카드는 정상 셔플 분배 (확률적으로 다른 매칭 발생 가능).
 * 같은 월 카드 4장 모두 명시한 시나리오는 봇 손패/바닥에 그 월이 들어가지 않음 보장.
 */

export type PresetId =
  // 기본
  | 'default'
  // §1-6 매칭 케이스
  | 'jjok'
  | 'case2-just-eat'
  | 'ppeok'
  | 'case4-pick-modal'
  | 'case4-double'
  | 'ddak'
  | 'self-ppeok'
  // §1-1 광 점수
  | 'gwang-3'
  | 'gwang-3-bisam'
  | 'gwang-4'
  | 'gwang-5'
  // §1-3 띠 점수
  | 'hongdan'
  | 'cheongdan'
  | 'chodan'
  // §1-2 끗 보너스
  | 'godori'
  // §1-5 9월 열끗 변환
  | 'nine-yeol-toggle'
  // 3개 모달 모두 발화 — 손패+더미 매칭 모달 + 국준 모달
  | 'three-modals'
  // §2 박
  | 'pi-pak'
  | 'gwang-pak'
  | 'myung-pak'
  // §4 흔들기/폭탄/총통
  | 'shake'
  | 'bomb'
  | 'chongtong'
  | 'gukjoon'
  // §5 고/스톱
  | 'go-stop'
  | 'gobak'
  // §6 특수
  | 'ssaktsseuli'
  | 'nagari'
  | 'myungdda'
  | 'last-turn-sweep'
  | 'joker-flip';

/**
 * Preset 카드 명시 — 모두 optional. 명시된 곳에만 카드 고정.
 *
 * - `myHand` / `myCollected`: 본인 (호스트, players[0])
 * - `botHand` / `botCollected`: 봇 (players[1])
 * - `field`: 바닥
 * - `drawTop`: 더미 top부터 순서대로 (drawTop[0]이 첫 뽑힘)
 */
export interface PresetSetup {
  myHand?: readonly string[];
  myCollected?: readonly string[];
  botHand?: readonly string[];
  botCollected?: readonly string[];
  field?: readonly string[];
  drawTop?: readonly string[];
}

export const PRESETS: Record<PresetId, PresetSetup> = {
  default: {},

  // ===========================================================================
  // §1-6 매칭 케이스 (rules-final.md Case 1~6)
  // ===========================================================================
  // Case 1 쪽: 바닥 0 + 손 1 + 더미 같은 월. 1월 4장 모두 명시.
  jjok: {
    myHand: ['m01-gwang'],
    drawTop: ['m01-ddi', 'm01-pi-1', 'm01-pi-2'],
  },
  // Case 2 그냥 먹기: 바닥 1 + 손 1 + 더미 다른 월. 2월 4장 모두 명시.
  'case2-just-eat': {
    myHand: ['m02-yeol'],
    field: ['m02-pi-1'],
    drawTop: ['m12-yeol', 'm02-ddi', 'm02-pi-2'],
  },
  // Case 3 뻑(설사): 바닥 1 + 손 1 + 더미 같은 월. 5월 4장 모두 명시 (5월은 광 없음).
  ppeok: {
    myHand: ['m05-yeol'],
    field: ['m05-ddi'],
    drawTop: ['m05-pi-1', 'm05-pi-2'],
  },
  // Case 4 선택 모달: 바닥 2 (종류 다름) + 손 1. 4월 4장 모두 명시.
  'case4-pick-modal': {
    myHand: ['m04-yeol'],
    field: ['m04-ddi', 'm04-pi-1'],
    drawTop: ['m11-pi-1', 'm04-pi-2'],
  },
  // Case 4 × 2: 한 턴에 손패+더미 선택 모달 둘 다. 1·2월 각 4장 모두 명시.
  'case4-double': {
    myHand: ['m01-gwang'],
    field: ['m01-ddi', 'm01-pi-1', 'm02-ddi', 'm02-pi-1'],
    drawTop: ['m02-yeol', 'm01-pi-2', 'm02-pi-2'],
  },
  // Case 5 따닥: 바닥 2 + 손 1 + 더미 같은 월. 3월 4장 모두 명시.
  ddak: {
    myHand: ['m03-ddi'],
    field: ['m03-gwang', 'm03-pi-1'],
    drawTop: ['m03-pi-2'],
  },
  // Case 6 자뻑 회수: 7월 4장 모두 명시 (7월은 광 없음).
  // 손패 m07-yeol → 바닥 m07-ddi 매칭 → 더미 m07-pi-2 같은 월 → 뻑 발생 (stuck 3장)
  // 다음 본인 turn에 m07-pi-1으로 회수 가능 (자뻑 회수 검증)
  'self-ppeok': {
    myHand: ['m07-yeol', 'm07-pi-1'],
    field: ['m07-ddi'],
    drawTop: ['m07-pi-2'],
  },

  // ===========================================================================
  // §1-1 광 점수 — collected에 광 카드 미리 추가
  // ===========================================================================
  'gwang-3': {
    myCollected: ['m01-gwang', 'm03-gwang', 'm08-gwang'], // 비광 X → 3점
  },
  'gwang-3-bisam': {
    myCollected: ['m01-gwang', 'm03-gwang', 'm12-gwang'], // 비삼광 → 2점
  },
  'gwang-4': {
    myCollected: ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang'], // 4점
  },
  'gwang-5': {
    myCollected: ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang'], // 15점 + 광박
  },

  // ===========================================================================
  // §1-3 띠 점수 — 같은 종류 띠 collected (+3점 단 보너스)
  // ===========================================================================
  hongdan: { myCollected: ['m01-ddi', 'm02-ddi', 'm03-ddi'] },
  cheongdan: { myCollected: ['m06-ddi', 'm09-ddi', 'm10-ddi'] },
  chodan: { myCollected: ['m04-ddi', 'm05-ddi', 'm07-ddi'] },

  // ===========================================================================
  // §1-2 끗 보너스 — 고도리 (1·4·8월 새 3장 +5점)
  // ===========================================================================
  godori: { myCollected: ['m02-yeol', 'm04-yeol', 'm08-yeol'] },

  // ===========================================================================
  // §1-5 9월 열끗 ↔ 쌍피 변환 (국준 획득 시 끗/쌍피 선택 모달 검증)
  // Case 2 매칭: 손패 m09-yeol + 바닥 m09-ddi → 둘 다 본인 collected (모달 발동)
  // 더미 top은 **다른 월**이어야 — 같은 9월이면 뻑(Case 3)이 되어 m09-yeol이 stuck됨.
  // 9월 4장 중 ssangpi/pi는 drawTop 뒤쪽에 두어 봇 손패/바닥에 들어가지 않게.
  // ===========================================================================
  'nine-yeol-toggle': {
    myHand: ['m09-yeol'],
    field: ['m09-ddi'],
    drawTop: ['m01-pi-1', 'm09-pi', 'm09-ssangpi'],
  },

  // ===========================================================================
  // 3개 모달 모두 발화 (한 턴 안에 손패 매칭 모달 + 더미 매칭 모달 + 국준 모달).
  //
  // 시나리오:
  //   손패 m01-gwang 클릭
  //   → 바닥 m01-ddi + m01-pi-1 (종류 다름) → 손패 매칭 모달
  //   → 사용자 선택 후 손패+선택 카드 본인 collected
  //   → 더미 m09-ddi 뒤집힘 → 바닥 m09-yeol + m09-ssangpi (종류 다름) → 더미 매칭 모달
  //   → m09-yeol 선택해야 국준 모달 발화 (m09-ssangpi 선택 시 국준 모달 X)
  //
  // 1월 4장, 9월 4장 모두 명시 — 봇 손패/바닥에 다른 1·9월 안 들어감.
  // ===========================================================================
  'three-modals': {
    myHand: ['m01-gwang'],
    field: ['m01-ddi', 'm01-pi-1', 'm09-yeol', 'm09-ssangpi'],
    drawTop: ['m09-ddi', 'm01-pi-2', 'm09-pi'],
  },

  // ===========================================================================
  // §2 박 (피박/광박/멍박)
  // ===========================================================================
  'pi-pak': {
    myCollected: [
      'm01-pi-1', 'm01-pi-2',
      'm02-pi-1', 'm02-pi-2',
      'm03-pi-1', 'm03-pi-2',
      'm04-pi-1', 'm04-pi-2',
      'm05-pi-1', 'm05-pi-2',
      'm07-pi-1', 'm07-pi-2',
    ],
    botCollected: ['m08-pi-1', 'm08-pi-2', 'm10-pi-1', 'm10-pi-2'],
  },
  'gwang-pak': {
    myCollected: ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang'],
  },
  'myung-pak': {
    myCollected: ['m02-yeol', 'm04-yeol', 'm06-yeol', 'm07-yeol', 'm08-yeol'],
  },

  // ===========================================================================
  // §4 흔들기 / 폭탄 / 총통
  // ===========================================================================
  // 흔들기: 시작 시 손패 같은 월 3장 → 모달. 8월 4장 모두 명시.
  shake: {
    myHand: ['m08-gwang', 'm08-yeol', 'm08-pi-1'],
    drawTop: ['m08-pi-2'],
  },
  // 폭탄: 같은 월 3장 손패 + 바닥 1장 (rules-final.md §6)
  bomb: {
    myHand: ['m06-yeol', 'm06-ddi', 'm06-pi-1'],
    field: ['m06-pi-2'],
  },
  // 총통: 시작 시 손패 같은 월 4장 → 즉시 승리
  chongtong: {
    myHand: ['m09-yeol', 'm09-ddi', 'm09-ssangpi', 'm09-pi'],
  },
  // 국준: 9월 4장 동월 (옵션 룰 검증)
  gukjoon: {
    myHand: ['m09-yeol', 'm09-ddi', 'm09-ssangpi', 'm09-pi'],
  },

  // ===========================================================================
  // §5 고/스톱
  // ===========================================================================
  // 고/스톱: 본인 collected 미리 채워서 점수 도달 가능 상태
  'go-stop': {
    myCollected: ['m01-gwang', 'm03-gwang', 'm08-gwang'],
    myHand: ['m07-yeol'],
    field: ['m07-pi-1'],
    drawTop: ['m11-gwang'],
  },
  // 고박: 4광 도달 → 고 누적 검증
  gobak: {
    myCollected: ['m01-gwang', 'm03-gwang', 'm08-gwang'],
    myHand: ['m11-gwang'],
    field: ['m11-pi-1'],
    drawTop: ['m11-pi-2'],
  },

  // ===========================================================================
  // §6 특수
  // ===========================================================================
  // 싹쓸이: 마지막 턴 빈 바닥 (분배 후 거의 끝난 상태 — 빠른 검증용)
  ssaktsseuli: {
    myHand: ['m10-yeol'],
    field: ['m10-ddi'],
    drawTop: ['m10-pi-1', 'm10-pi-2'],
  },
  // 나가리 (3뻑): stuck 2개 만들어둔 상태에서 마지막 뻑 트리거 — ppeok 반복 권장
  nagari: {
    myHand: ['m11-gwang', 'm11-pi-1'],
    field: ['m11-pi-2'],
    drawTop: ['m11-ssangpi'],
  },
  // 멍따: 12월 광 매칭. 12월 4장 모두 명시 (봇 광 0은 셔플로 보장 X — 시연용)
  myungdda: {
    myHand: ['m12-yeol'],
    field: ['m12-ddi', 'm12-ssangpi'],
    drawTop: ['m12-gwang'],
  },
  // 마지막 턴 싹쓸이 — ssaktsseuli와 유사
  'last-turn-sweep': {
    myHand: ['m10-yeol'],
    field: ['m10-ddi'],
    drawTop: ['m10-pi-1'],
  },
  // 조커: jokerCount=1 RoomRules에서 직접 설정 + 정상 분배
  'joker-flip': {},
};
