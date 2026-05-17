import { useEffect, useState } from 'react';
import type { RoomView } from '@gostop/shared';

/** 호스트 "🎮 게임으로" 클릭 후 비호스트 ResultView 자동 닫힘까지 (ms) */
const RESULT_AUTO_DISMISS_MS = 5000;

const PLAYING_PHASES: ReadonlyArray<RoomView['phase']> = [
  'playing',
  'dealing',
  'go-stop-decision',
];

export interface EndedSnapshot {
  /** 게임 종료 화면을 띄울 view snapshot. null이면 ResultView 표시 X */
  snapshot: RoomView | null;
  /** 비호스트가 명시적으로 닫기 누른 상태. true면 같은 ended phase에서 자동 재표시 X */
  dismissed: boolean;
  /** phase=ended 진입 직후 [대기하기 / 통계보기] 선택 대기 중 */
  awaitingChoice: boolean;
  /** 호스트가 다음 판 시작 등으로 즉시 dismiss할 때 사용 */
  setSnapshot: (next: RoomView | null) => void;
  /** 비호스트가 닫기 버튼 누를 때 — snapshot=null + dismissed=true */
  dismissByUser: () => void;
  /** "결과 다시 보기" — dismissed flag 해제 + snapshot 다시 띄움 */
  unDismiss: () => void;
  /** [통계보기] 선택 — awaitingChoice 해제 + snapshot 저장 */
  showResult: () => void;
  /** [대기하기] 선택 — awaitingChoice만 해제 (return-to-lobby는 호출자가 처리) */
  skipResult: () => void;
}

/**
 * 게임 종료 화면(ResultView) 표시 라이프사이클 관리.
 *
 * 흐름:
 * - phase 'ended' 진입 → awaitingChoice=true (ChoiceModal 표시)
 * - 사용자 [통계보기] 클릭 → showResult() → snapshot 저장 → ResultView
 * - 호스트 [대기하기] 클릭 → room:return-to-lobby + skipResult()
 * - 호스트 "🎮 게임으로" (ResultView 안) → setSnapshot(null) 즉시 dismiss
 * - server가 phase='playing' broadcast → 비호스트 5초 카운트다운 후 자동 dismiss
 * - 비호스트 "🎮 게임으로" (닫기) 클릭 → dismissByUser
 * - phase가 'ended' 외로 가면 flag 리셋 (다음 판 종료 시 정상 표시)
 */
export function useEndedSnapshot(view: RoomView | null): EndedSnapshot {
  const [snapshot, setSnapshot] = useState<RoomView | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [awaitingChoice, setAwaitingChoice] = useState(false);

  // phase 'ended' 진입 시 ChoiceModal 표시 (snapshot은 사용자 선택 후 저장)
  useEffect(() => {
    if (view?.phase === 'ended' && !dismissed && !snapshot) {
      setAwaitingChoice(true);
    }
    if (view?.phase && view.phase !== 'ended') {
      setDismissed(false);
      setAwaitingChoice(false);
    }
  }, [view?.phase, dismissed, snapshot]);

  // 호스트가 다음 판 시작하면 비호스트 5초 후 자동 dismiss
  useEffect(() => {
    if (!snapshot) return;
    const phase = view?.phase;
    if (phase && PLAYING_PHASES.includes(phase)) {
      const t = setTimeout(() => setSnapshot(null), RESULT_AUTO_DISMISS_MS);
      return () => clearTimeout(t);
    }
  }, [view?.phase, snapshot]);

  return {
    snapshot,
    dismissed,
    awaitingChoice,
    setSnapshot,
    dismissByUser: () => {
      setSnapshot(null);
      setDismissed(true);
    },
    unDismiss: () => {
      setDismissed(false);
      if (view?.phase === 'ended') setSnapshot(view);
    },
    showResult: () => {
      setAwaitingChoice(false);
      if (view?.phase === 'ended') setSnapshot(view);
    },
    skipResult: () => {
      setAwaitingChoice(false);
    },
  };
}
