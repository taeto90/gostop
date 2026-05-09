import { create } from 'zustand';

/**
 * 게임 중 발생하는 특수 이벤트.
 *
 * 룰 엔진의 turn 결과(`specials`) + 게임 종료 점수 계산(`flags`)에서 트리거됨.
 * EventOverlay 컴포넌트가 store를 구독해 화면 가운데 큰 텍스트로 표시.
 */
export type GameEvent =
  | 'ppeok' // 뻑 (싸기)
  | 'first-ppeok' // 첫뻑 (round 0 첫 턴에 발생한 뻑) — 보너스 표시
  | 'ja-ppeok' // 자뻑 (본인이 싼 뻑 회수)
  | 'ttadak' // 따닥
  | 'jjok' // 쪽
  | 'sweep' // 싹쓸이
  | 'bomb' // 폭탄
  | 'shake' // 흔들기
  | 'chongtong' // 총통 (시작 시 같은 월 4장)
  | 'go' // 고
  | 'stop' // 스톱
  | 'bak' // 박 (피박/광박/멍박 발동)
  | 'myungttadak' // 멍따 (끗 7장)
  | 'nagari' // 나가리 (무승부)
  | 'shodang'; // 쇼당 (본인 턴 무효 선언)

interface EventOverlayState {
  /** 현재 표시 중인 이벤트. null이면 표시 X */
  current: GameEvent | null;
  /** 이벤트 발화 — 기존 이벤트는 즉시 교체됨 */
  trigger: (event: GameEvent) => void;
  /** 표시 종료 (auto-hide timer가 호출) */
  clear: () => void;
}

export const useEventOverlayStore = create<EventOverlayState>((set) => ({
  current: null,
  trigger: (event) => set({ current: event }),
  clear: () => set({ current: null }),
}));
