# ROADMAP5 — 상업화 준비 + 테스트 도구 강화

**기준일**: 2026-05-10
**상태**: 친구 MVP 완성 + Vercel/Railway/Supabase 배포 완료. 이제 상업화 향상 + 테스트 도구 + 폴리시 단계.

이전: [`ROADMAP4.md`](./ROADMAP4.md) — 배포 인프라 + UX 폴리시 + 애니메이션 보정까지

---

## 1. 우선순위 요약

| 순위 | 항목 | 분류 | 예상 |
|---|---|---|---|
| **P0** | 게임 시작 시점 분배 검증 (바닥 4-5장 화면 이슈) | 버그 | 1h |
| **P0** | 테스트 모드 v2 (속도 슬라이더 + preset 시나리오) | 도구 | 1d |
| **P1** | 흔들기 시각 표시 배지 | 폴리시 | 2h |
| **P1** | 모바일 채팅 키보드 가림 fix (visualViewport) | 버그 | 2h |
| **P1** | 광팔이 모달 폴리시 | 폴리시 | 3h |
| **P1** | 결과 화면 박/멍따 애니메이션 검토 | 폴리시 | 3h |
| **P2** | Sentry 에러 모니터링 | 인프라 | 4h |
| **P2** | README.md 작성 | 문서 | 2h |
| **P3** | 상업화 단계 Auth 도입 (Supabase Auth) | 인프라 | 1주 |

---

## 2. P0 — 게임 시작 분배 검증

**증상**: 2인 게임 시작 시 화면 가운데 카드 4-5장만 보임. 정통 룰은 2인 시 바닥 8장.

**의심 지점**:
1. `packages/shared/src/rules/game.ts` `dealNewGame` — 2인 시 FIELD_SIZE 8장 정확한지
2. `apps/web/src/features/room/game-ui/CenterField.tsx` — 6각형 + 코너 layout이 8장 모두 렌더링하는지
3. PC layout에서 좌측 점수판 + 우측 video sidebar 사이 공간이 좁아 코너 카드가 viewport 밖으로 잘리는지

**검증 방법**:
- testMode OFF로 2인 게임 시작 → `mcp__playwright__browser_evaluate`로 `document.querySelectorAll('[data-card-id]')` 카운트
- 8장 모두 DOM에 있고 화면에만 안 보이면 layout 문제
- 8장이 안 들어오면 분배 로직 문제

**Fix 후보**:
- layout 문제: CenterField의 6각형 좌표를 viewport width 기반으로 scale
- 분배 문제: dealNewGame `FIELD_SIZE` 검토

---

## 3. P0 — 테스트 모드 v2 (사용자 요청 4번)

현재 `testMode` (손패 1장 + 바닥 1장)은 흐름 확인용이라 이펙트 검증이 거의 안 됨. 업그레이드:

### 3-1. 4-Phase 속도 조절

대기실에서 테스트 모드 ON 시 속도 배수 슬라이더 노출:
- 0.5× / 1× / 2× / 4× / 8× / 16×
- 16×면 거의 즉시, 0.5×면 매우 천천히 (애니메이션 디테일 검토용)

**구현 위치**:
- `apps/web/src/lib/animationTiming.ts` — `ANIMATION_SPEED_MULTIPLIER` 변수 (default 1.0). 모든 duration export를 함수화 (`getHandPeakDuration()` 등)
- `apps/web/src/stores/devTestStore.ts` — Zustand store (현재 배수 + setMultiplier)
- `apps/web/src/features/room/RoomLobbyModal.tsx` `TestModeToggle` 옆에 슬라이더 UI

또는 더 간단히: `localStorage`에 배수 저장 + window key로 토글. 무거운 UI 작업 회피.

### 3-2. Preset 시나리오 (이펙트별 패 세팅)

테스트 모드 ON + Preset 선택 시 server `dealNewGame`이 정상 분배 대신 **고정 카드 배치**.

**Preset 목록** (`docs/rules-final.md` 기준):

| Preset | 손패 (player 1) | 바닥 | 더미 top | 검증할 이펙트 |
|---|---|---|---|---|
| `default` | 정상 분배 | 정상 | 정상 | 기본 게임 |
| `jjok` | 1월 광 | (비어 있음) | 1월 | 쪽 — 손패와 더미 같은 월, 바닥 매칭 X |
| `ddak` | 3월 띠 | 3월 띠 + 3월 피 (2장) | 3월 광 | 따닥 — 바닥 2장 + 더미 매칭 |
| `ppeok` | 5월 끗 | 5월 띠 (1장) | 5월 광 | 뻑 (설사) — 바닥 1 + 손패 1 + 더미 같은 월 |
| `self-ppeok` | 7월 광 | 7월 광 + 7월 띠 + 7월 피 (stuck 3장) | (random) | 자뻑 회수 — 본인이 만든 뻑 회수 |
| `chongtong` | 같은 월 3장 (예: 9월 4장 중 3장) | (비어 있음) | (random) | 총통 |
| `ssaktsseuli` | 9월 광 | 9월 띠 (1장 only) | 9월 끗 | 싹쓸이 (마지막 턴 빈 바닥) |
| `bomb` | 같은 월 3장 (폭탄 발동 가능) | 같은 월 1장 | 같은 월 | 폭탄 |
| `shake` | 같은 월 3장 | 다른 월 | (random) | 흔들기 (자동 발동) |
| `nagari` | (특수 분배 — 한 사람이 3뻑) | (random) | (random) | 나가리 (3뻑 종료) |
| `myungdda` | 광 1장 (상대가 광박 + 멍따 가능) | 11월/12월 광 깔림 | (random) | 멍따 |
| `gukjoon` | 동일 월 4장 (국준 이론) | (비어 있음) | (random) | 국준 옵션 검증 |

### 3-3. 구현 가이드

**Server side** — `packages/shared/src/rules/game.ts`에 `dealNewGameWithPreset(playerIds, preset, options)` 함수 추가:

```ts
export type DealPreset =
  | 'default'
  | 'jjok' | 'ddak' | 'ppeok' | 'self-ppeok'
  | 'chongtong' | 'ssaktsseuli' | 'bomb' | 'shake'
  | 'nagari' | 'myungdda' | 'gukjoon';

export interface DealOptions {
  testMode?: boolean;
  preset?: DealPreset; // testMode일 때만 의미 있음
  jokerCount?: number;
}
```

각 preset마다 명시적으로 `Card[]` 배열 만들어서 hand/field/draw에 분배. 나머지 카드는 셔플해서 더미 뒤에 배치.

**Type 추가** — `packages/shared/src/types/views.ts`:
- `RoomView.testPreset?: DealPreset` (관전자/디버그용)

**Socket schema** — `apps/server/src/socket/schemas.ts`:
- `GameStartSchema`에 `testPreset: z.enum([...]).optional()` 추가

**Client UI** — `apps/web/src/features/room/RoomLobbyModal.tsx`:
- testMode ON일 때 preset 드롭다운 노출 (위 12개)
- "게임 시작" 시 `game:start { testMode: true, testPreset: 'jjok' }`

### 3-4. 사용자 확정 사항 (2026-05-10)

1. **Preset 패 고정 범위**: 본인 손패 + 본인 바닥 + 본인 더미 + 본인 딴패 모두 세팅. 게임 로직은 손대지 않음 (분배 단계만 변경 → 이펙트 발동 검증)
2. **속도 배수 적용 범위**: 모든 duration 적용. `animationTiming.ts` 전체 + dealing stagger + EventOverlay 2.2초 + AI thinking pause `AI_TURN_DELAY_MS` 모두 `÷multiplier`
3. **Preset 카드 부족 케이스**: 48장 deck에서 명시 카드를 먼저 빼고 나머지 셔플. 분배 로직 (`dealWithPreset`) 새로 작성
4. **딴패 사전 세팅**: 피박/광박/멍박은 게임 시작 시 이미 collected에 카드 추가된 상태. 트리거 즉시 검증 가능
5. **상대 봇 손패**: 멍따/광박/피박처럼 상대 상태가 영향을 주는 시나리오는 봇 손패도 세팅. 그 외는 본인만

### 3-5. Preset 시나리오 (확정 12+5)

본인 손패 / 바닥 / 딴패 / 더미 top + 봇 상태 모두 명시. **트리거 카드만 클릭하면 이펙트 검증 가능**.

| Preset | 본인 손패 | 본인 바닥 | 본인 딴패 | 더미 top | 봇 상태 | 트리거 |
|---|---|---|---|---|---|---|
| `jjok` | 1월 광 | (비어 있음) | — | 1월 띠 | — | 1월 광 클릭 → 쪽 |
| `ddak` | 3월 띠 | 3월 광 + 3월 피 | — | 3월 피2 | — | 3월 띠 클릭 → 따닥 |
| `ppeok` | 5월 끗 | 5월 띠 | — | 5월 광 | — | 5월 끗 클릭 → 뻑 |
| `self-ppeok` | 7월 광 | 7월 광 + 7월 띠 + 7월 피 (stuck) | — | 7월 피 | — | 7월 광 클릭 → 자뻑 회수 |
| `chongtong` | 9월 광 + 9월 끗 + 9월 띠 + 9월 피 | (random) | — | (random) | — | 즉시 게임 시작 시 종료 |
| `ssaktsseuli` | 9월 광 (마지막 1장) | 9월 띠 (1장 only) | (이미 다른 모두 collected) | 9월 끗 | — | 마지막 턴 비우기 |
| `bomb` | 6월 광 + 6월 끗 + 6월 띠 | 6월 피 | — | (random) | — | 폭탄 발동 옵션 노출 |
| `shake` | 8월 광 + 8월 끗 + 8월 띠 | (random) | — | (random) | — | 시작 시 자동 흔들기 |
| `nagari` | 11월 광 (3뻑 직전 셋업) | 11월 광 + 11월 끗 + 11월 띠 + 11월 피 (3뻑 stuck 2회) | — | 11월 끗 | — | 3뻑 → 나가리 |
| `myungdda` | 12월 광 | 12월 띠 + 12월 피 | — | 12월 광 | 봇 광 0장 | 12월 광 클릭 → 따닥 + 멍따 |
| `gukjoon` | 4월 광 + 4월 끗 + 4월 띠 + 4월 피 (4장 동월) | (비어 있음) | — | (random) | — | 분배 시 국준 옵션 검증 |
| **`pi-pak`** | (정상 분배) | (정상) | **피 12장 collected** | (random) | 봇 피 6장 collected | 본인 7점 도달 시 봇 피박 |
| **`gwang-pak`** | 광 4장 | (random) | 광 4장 collected (5점 가능) | (random) | 봇 광 0 | 본인 5점 → 봇 광박 |
| **`myung-pak`** | 끗 6장 셋업 | (random) | 끗 5장 collected (3점 가능) | (random) | 봇 끗 0 | 본인 3점 → 봇 멍박 |
| `last-turn-sweep` | (마지막 턴 셋업) | (1장만) | (대부분 collected) | (마지막 더미) | — | 마지막 턴 빈 바닥 |
| `joker-flip` | (jokerCount=1) | (random) | — | 조커 | — | 조커 발동 |

---

## 4. P1 — 흔들기 시각 표시 배지

서버 gameLogic이 `Player.flags.shookMonths`를 자동 세팅 (rules-final.md §4 흔들기 자동 발동). 클라가 이를 시각적으로 표시:

- OpponentSlot: 닉네임 옆 `💪 9월` 같은 배지
- 본인: MyHand 위쪽에 흔들기 indicator
- 점수 계산 시 1× → 2× 배수 표시

**구현 위치**:
- `apps/web/src/features/room/game-ui/OpponentSlot.tsx` — `flags.shookMonths` 표시
- `apps/web/src/features/room/game-ui/MyHand.tsx` — 본인 흔들기 indicator

---

## 5. P1 — 모바일 채팅 키보드 가림 fix

모바일에서 채팅 입력 시 키보드 올라오면 채팅 입력창이 가려짐.

**Fix**: `visualViewport` API 사용:

```ts
useEffect(() => {
  if (!window.visualViewport) return;
  function adjust() {
    const vv = window.visualViewport!;
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
  }
  window.visualViewport.addEventListener('resize', adjust);
  return () => window.visualViewport?.removeEventListener('resize', adjust);
}, []);
```

`ChatPanel`에 `bottom: var(--keyboard-offset, 0px)` 또는 `padding-bottom: var(--keyboard-offset)` 적용.

---

## 6. P1 — 광팔이 모달 폴리시

현재 광팔이 흐름:
1. 4~5명일 때 자원자 모집 → 호스트 지정 → 마지막 입장자 자동
2. 광팔이는 spectator로 (`isGwangPali=true`) 한 판 관전
3. 다음 판에 자동으로 player 복귀

**개선 후보**:
- 광팔이 자원/지정 흐름이 RoomLobbyModal 안에 묻혀있음 — 별도 모달 또는 highlight 필요
- 광팔이가 상대 손패에서 광 사가는 건 아직 미구현 (rules-final.md §3 광팔이 거래 — friend 협의 룰)

---

## 7. P1 — 결과 화면 박/멍따 애니메이션

`ResultView`에서 박/멍따 발생 시 정적 텍스트로만 표시. 시각적 강조 필요.

**개선 후보**:
- 박 발생 시 점수 ×2 / ×3 표시 시 카드 회전 + 빨간 ring
- 멍따 발생 시 광 카드 추가 강조
- `/result-demo` route에서 mock으로 검증

---

## 8. P2 — Sentry 에러 모니터링

상업화 전 production 에러 추적 필수.

**구현**:
- `@sentry/react` (web) + `@sentry/node` (server)
- VITE_SENTRY_DSN, SENTRY_DSN 환경 변수
- ErrorBoundary fallback에 Sentry.captureException 연결
- Socket 에러도 Sentry로

---

## 9. P2 — README.md 작성

GitHub 공개 시 필요. 현재 없음.

**포함**:
- 프로젝트 개요 (한국 화투 5인 화상)
- 데모 URL (Vercel)
- 기술 스택
- 개발 환경 (pnpm 10+, Node 22+)
- 명령어 (CLAUDE.md에서 발췌)
- 라이선스 — 친구용 MVP라 공개 라이선스 신중히

---

## 10. P3 — 상업화 단계 Auth

현재는 sessionStore에 익명 닉네임 + emoji + userId(uuid). 상업화 시:
- Supabase Auth (이메일/Google OAuth)
- 친구 목록 / 게임 통계 사용자 단위 영구 저장
- Anonymous → Authenticated 마이그레이션 (기존 history 보존)

**하지만 친구 MVP 단계로 충분하다면 보류**. 사용자가 "최종적으로 상업적으로도"라고 했으므로 향후 단계.

---

## 11. 회귀 위험 / 알려진 한계

- **3-2 Preset 분배 로직** — `dealNewGame`은 셔플된 deck에서 순차 분배. preset 적용 시 deck 자체를 미리 sort해야 함 → 함수 파라미터 흐름 변경 필요
- **3-1 속도 배수가 server timer와 mismatch** — server-side turn timer는 항상 30~90초 (변경 X). 클라 애니메이션만 빨라짐. 자동 발동 시 서버는 자동 카드 발동 후 broadcast → 클라가 빠른 속도로 재생. 정상 흐름.
- **테스트 모드 production 노출 위험** — 사용자에게 노출되지 않도록 `import.meta.env.DEV` gate 또는 호스트 내부 키 입력 방식. 추후 완전 제거가 목표

---

## 12. 작업 순서 추천

1. **P0 게임 시작 화면 분석** (1h) — 바로 검증
2. **P0 테스트 모드 v2** (1d) — 이후 모든 검증의 기반
3. **P1 흔들기 배지 + 결과 화면 폴리시** (5h) — 사용성 향상
4. **P1 모바일 채팅 + 광팔이 모달** (5h)
5. **P2 Sentry + README** (6h) — 외부 공유 준비
6. **P3 Auth** — 별도 sprint

---

---

## 13. 완료 (2026-05-12 세션)

### 13-1. 작업 1 — 정통 룰 보강
- ✅ **§0-4 reshuffle**: 바닥 4장 동월 시 자동 재분배 (`dealNewGame` + `hasFieldAllSameMonth`). 최대 10회 시도 + 테스트 추가 (115→116)
- ✅ **흔들기 모달 연결**: server 자동 적용을 AI 봇에만, 사람은 `ShakeBombModal` + `game:apply-shake-bomb` 이벤트로 선언 (정통 룰)
- ✅ **흔들기 시각 배지**: 💪N월 (OpponentSlot/CompactHeader) + `useShakeBombFireTrigger`로 EventOverlay 'shake' 발화. 본인 모달 응답 전엔 발화 보류
- ✅ **누적 배수 표시**: 게임 중 ×N (흔들기·폭탄·고). 본인은 CenterField 좌하단 큰 폰트 (`text-5xl`), 상대는 OpponentSlot 점수 옆

### 13-2. 작업 2 — 테스트 모드 v2 (preset 시나리오)
- ✅ `dealWithPreset` 함수 — 명시 카드 위치 고정 + 나머지 셔플
- ✅ **30개 preset** 정의 (`packages/shared/src/rules/presets.ts`) — §1-6 매칭 케이스 / §1-1 광 점수 / §1-3 띠 / §1-2 끗 / §1-5 9월 변환 / §2 박 / §4 흔들기/폭탄/총통 / §5 고/스톱 / §6 특수
- ✅ **속도 배수 시스템** (`animationTiming.setSpeedMultiplier` + `applySpeed`) — 모든 phase duration + dealing stagger + EventOverlay + AI thinking 적용. devTestStore localStorage 영속
- ✅ **테스트 모드 UI**: RoomLobbyModal의 TestModeToggle / PresetSelect / AnimationSpeedSelect
- ✅ **빠른 재시작**: `game:test-restart` (같은 시나리오) + `game:set-test-preset` (다른 시나리오 즉시 전환)
- ✅ **트리거 카드 강조**: 손패에 빨간 pulse ring (Card.tsx의 `highlight: 'trigger'`)
- ✅ **상단 토글 버튼**: testMode 한정 — 시나리오 컨트롤 3개 + 로비/설정 2개 일괄 hide/show

### 13-3. 인프라
- ✅ `room.gameInstanceId` 추가 — 매 `startGameInRoom`마다 +1. 클라가 새 게임 인스턴스 식별 (turnSeq=0 reset만으로 부족)
- ✅ broadcast 큐잉 — `useMultiTurnSequence`가 sequence 진행 중 새 view를 `pendingViewRef`에 저장. 끝나면 자동 처리 → 빠른 연속 broadcast 화면 점프 X
- ✅ 4-phase 콘솔 로그 (testMode 한정) — phase별 출력으로 검증
- ✅ `window.__view` 디버그 노출 — DevTools 콘솔에서 flags 직접 검사
- ✅ `apps/web/src/lib/multiplierUtils.ts` — `computeMultiplier`/`multiplierBreakdown` 공통 helper (CompactHeader/OpponentSlot/GameView 중복 제거)
- ✅ `m11-pi-2.svg` ↔ `m11-ssangpi.svg` SVG swap (정통 빨간 하단 = 쌍피 디자인)

### 13-4. 알려진 한계
- preset 시나리오 17 → 30개로 확장됐지만 일부는 셔플 의존 (멍따 봇 광 0 보장 X 등)
- 4-phase 큐잉으로 sequence 재생은 정확하지만 봇 thinking 시간(`AI_TURN_DELAY_MS=2.2s`)이 클라 phase(~3.8s)보다 짧아 큐가 누적될 수 있음 (속도 배수 16×에선 큐 거의 비어짐)
- ROADMAP5 §3-5 P0/P1 항목은 작업 1·2로 모두 처리됨. 남은 우선순위는 P1 흔들기 시각 / 모바일 채팅 키보드 / 광팔이 모달 / 결과 화면 폴리시

---

## 관련 문서

- [`ROADMAP4.md`](./ROADMAP4.md) — 배포 + UX 폴리시 + 애니메이션 보정 (직전)
- [`ROADMAP3.md`](./ROADMAP3.md) — 친구 MVP 완성 시점
- [`rules-final.md`](./rules-final.md) — 룰 정의 (Preset 시나리오 설계 기준)
- [`rules-todo.md`](./rules-todo.md) — 미구현 룰
