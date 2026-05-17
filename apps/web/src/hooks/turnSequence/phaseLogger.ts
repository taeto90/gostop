/**
 * 4-phase 진행 로그 — 항상 출력 (testMode 무관).
 *
 * sequence 시작 시점 기준 경과 시간 (ms) 표시. sleep duration이 배속에 맞게
 * 적용됐는지 timestamp 차이로 검증 가능.
 *
 * 형식:
 *   [+ 1200ms] [turnSeq=N 🟢본인=alice] ▶ Phase 1-A 시작 (peak 0.6s)
 *   [+ 2400ms] [turnSeq=N 🟢본인=alice] ✓ Phase 1-A 완료
 */

let seqStartTime = 0;

export function startPhaseLog(): void {
  seqStartTime = Date.now();
}

export function plog(_tag: string, _msg: string): void {
  // phase 진행 로그 비활성화 (콘솔 가독성). 호출자는 그대로 유지 — 향후 toggle로 재활성화 가능.
}

export function makePhaseTag(
  turnSeq: number,
  isMyTurn: boolean,
  nickname: string,
): string {
  return `turnSeq=${turnSeq} ${isMyTurn ? '🟢본인' : '🔵상대'}=${nickname}`;
}
