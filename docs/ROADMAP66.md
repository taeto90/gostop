# ROADMAP66 — 남은 작업 + 추가 개선 사항

**기준일**: 2026-05-17
**이전**: [`ROADMAP4.md`](./ROADMAP4.md) (상업 배포 전환) + [`ROADMAP5.md`](./ROADMAP5.md) (테스트 도구 강화)

> 이번 세션까지 완료된 핵심 기능: Go/Stop · 게임 로그(dev) · 결과 모달화 · 9월 끗 분류 fix · 점수판 카드 수 · 매칭 강조 · 게임 속도 2배 · 테스트모드 production hide. 본 문서는 **아직 안 한 항목 + 추가 발견 사항**만 추립니다.

---

## 1. 우선순위 요약

| 순위 | 항목 | 분류 | 출처 | 예상 |
|---|---|---|---|---|
| **P0** | 모바일 채팅 키보드 가림 fix | UX | ROADMAP5 §5 | 2h |
| **P0** | 봇 thinking vs 4-phase 시간 mismatch (큐 누적) | 안정성 | 이번 세션 | 3h |
| **P0** | AI go/stop 정책 개선 (현재 hand≥4 & goCount<2 단순) | 게임성 | 이번 세션 | 4h |
| **P0** | pendingShake/pendingBomb 모달 timeout (server 자동 발동과 race) | 안정성 | 이번 세션 | 2h |
| **P1** | 광팔이 모달 폴리시 | UX | ROADMAP4·5 | 3h |
| **P1** | 결과 화면 박/멍따 애니메이션 | 폴리시 | ROADMAP5 §7 | 3h |
| **P1** | preset 시나리오 정리 (drawTop 잠재 버그) | 도구 | 이번 세션 | 3h |
| **P1** | 게임 로그 자동 검증 alert (orderValid=false 시 console.warn) | 도구 | 이번 세션 | 2h |
| **P1** | LobbyMemberCard 모바일 DnD (dnd-kit 도입) | UX | ROADMAP4 §9 | 1d |
| **P2** | Sentry 에러 모니터링 | 인프라 | ROADMAP4·5 | 4h |
| **P2** | README.md 작성 | 문서 | ROADMAP5 §9 | 2h |
| **P2** | rate limiting (socket.io spam 방지) | 보안 | ROADMAP4 §3 | 4h |
| **P2** | 키보드 단축키 (1~7 손패 / Space 매칭 / G·S 고/스톱) | UX | ROADMAP4 Tier2 §20 | 4h |
| **P2** | 다국어 (i18n) 한국어 + 영어 | 확장 | ROADMAP4 Tier2 §17 | 1주 |
| **P2** | 카드 디자인 테마 (다크/라이트, 카드 뒷면 종류) | 폴리시 | ROADMAP4 Tier2 §18 | 1d |
| **P2** | AI 캐릭터성 (봇별 닉네임/말투) | 폴리시 | ROADMAP4 Tier2 §19 | 1d |
| **P2** | 모바일 화면 꺼짐 방지 (Wake Lock API) | UX | ROADMAP4 Tier2 §16 | 2h |
| **P2** | 알림 (Web Push) — 친구가 방 만들면 알림 | UX | ROADMAP4 Tier2 §15 | 1d |
| **P3** | 사용자 영구 식별 (익명 → users 테이블 + JWT) | 인프라 | ROADMAP4 Tier1 §2 | 1주 |
| **P3** | OAuth 로그인 (카카오 + Google) | 인프라 | ROADMAP4 Tier1 §3 / §4 | 1주 |
| **P3** | 본인인증 (성인 확인) | 법규 | ROADMAP4 Tier1 §9 | 3d |
| **P3** | 이용약관 / 개인정보처리방침 페이지 | 법규 | ROADMAP4 Tier1 §8 | 변호사 협업 |
| **P3** | 게임물관리위원회 등급분류 | 법규 | ROADMAP4 §1 | 2~4주 대기 |
| **P3** | 글로벌 통계 / 리더보드 | 확장 | ROADMAP4 Tier2 §12 | 1주 |
| **P3** | 친구 목록 / 즐겨찾기 | 확장 | ROADMAP4 Tier2 §13 | 1주 |
| **P3** | 게임 리플레이 저장 + 재생 | 확장 | ROADMAP4 Tier2 §14 | 1주 |
| **P4** | 음성 인식 "고/스톱" | 확장 | ROADMAP4 Tier3 §21 | 2d |
| **P4** | 스트리머 모드 (닉네임/방ID 가리기) | 확장 | ROADMAP4 Tier3 §22 | 1d |
| **P4** | 배경음악 (BGM 토글) | 폴리시 | ROADMAP4 Tier3 §23 | 1d |
| **P4** | 대결 모드 / 토너먼트 | 확장 | ROADMAP4 Tier3 §24 | 2주 |
| **P4** | 룰 변형 (지역별) | 확장 | ROADMAP4 Tier3 §25 | 1주 |

---

## 2. P0 — 즉시 처리 (안정성/UX)

### 2-1. 모바일 채팅 키보드 가림 (ROADMAP5 §5)
모바일에서 채팅 입력창에 포커스 시 키보드가 올라오면 입력창이 가려짐.

**Fix**: `visualViewport` API로 keyboard offset 측정 후 `ChatPanel`의 bottom padding 조절.

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

대상: `apps/web/src/components/ChatPanel.tsx`

### 2-2. 봇 thinking 시간 vs 4-phase 시간 mismatch
- 봇 `AI_TURN_DELAY_MS = 2.2s`, 클라 4-phase total ≈ 2초 (속도 2배 적용 후)
- 일반 모드에선 봇 delay > phase time → 큐 누적 X
- 단 testMode 0.5× 속도면 phase ≈ 8초, 봇은 2.2s → 큐 누적 가능
- AI turn 진입 시 `useMultiTurnSequence.pendingViewRef` 큐 길이를 server에 신호 보내 자체 throttle 또는 클라 phase 끝나면 ack 보내 봇 진행 트리거

**대안**: server가 broadcast 후 별도 ack 기다리지 말고 phase별 timing 무시. 단 시각효과 매끄러움은 클라 큐잉으로 보장.

대상: `apps/server/src/socket/aiTurn.ts`, `apps/web/src/hooks/useMultiTurnSequence.ts`

### 2-3. AI go/stop 정책 개선
현재 정책: `hand >= 4 && goCount < 2` → GO, 그 외 STOP. 너무 단순.

**개선안**:
- 점수 차 / 상대 박 가능성 / 손패 매칭 가능성 종합 평가
- 난이도(easy/medium/hard)별 다른 정책 — easy는 거의 STOP, hard는 박 노림
- 또는 server-side AI policy 함수 분리

대상: `apps/server/src/socket/turnFlow.ts` `autoDecideGoStopForAI`, `apps/server/src/socket/aiTurn.ts` reachedWin 분기

### 2-4. pendingShake/pendingBomb 모달 timeout
사용자가 흔들기/폭탄 모달 안 누르고 그대로 두면 turn timer 만료 → server가 자동 카드 발동 (다른 카드). 그러나 클라 모달은 그대로 열려있어 stale.

**Fix**: pendingShake/pendingBomb state에 timeout 추가 (예: 15초). 또는 view.turnUserId 변화 감지 시 자동 dismiss.

대상: `apps/web/src/features/room/GameView.tsx`

---

## 3. P1 — 폴리시 / 도구 강화

### 3-1. 광팔이 모달 폴리시 (ROADMAP4·5)
4~5명일 때 광팔이 흐름이 RoomLobbyModal 안에 묻혀있음. 자원/지정 흐름이 명확하지 않음.

**개선**:
- 광팔이 자원 시 큰 배지 또는 highlight
- 호스트 지정 시 toast + 대상자에게 confirm
- 광팔이가 상대 손패에서 광 사가는 거래 흐름 (rules-final.md §3, 친구 협의 룰)은 추후 별도

### 3-2. 결과 화면 박/멍따 애니메이션
ResultView에서 박/멍따 발생 시 정적 텍스트. 시각적 강조 필요.

**개선**:
- 박 발생 시 점수 ×2 / ×3 표시에 카드 회전 + 빨간 ring
- 멍따 발생 시 광 카드 추가 강조 + EventOverlay 'myungdda'
- `/result-demo` route에서 mock으로 검증

### 3-3. preset 시나리오 정리
이번 세션에 `nine-yeol-toggle`/`nine-yeol-opponent`의 `drawTop[1]=m09-pi` 잠재 버그 발견 (의도치 않은 뻑 발생).

**할 일**:
- 전체 preset 시나리오 검토 — drawTop 각 위치가 turn N에서 어떤 동작 일으키는지 검증
- 시나리오 별로 expected outcome 주석 추가
- preset 자동 테스트 (server에서 시뮬레이션 N턴 진행 후 final state 비교)

대상: `packages/shared/src/rules/presets.ts`

### 3-4. 게임 로그 자동 검증 alert
이번 세션에 server-side game log 시스템 도입 (dev only). 매 액션마다 `orderValid` / `cardCheck.duplicates` / `stealValid` 검증.

**개선**:
- `orderValid: false` 또는 `duplicates.length > 0` 시 server stdout에 `console.warn('[gameLog] INVARIANT VIOLATION:', ...)`
- 클라 broadcast에도 dev only flag로 알림 (toast.warning)

대상: `apps/server/src/socket/gameLog.ts`

### 3-5. LobbyMemberCard 모바일 DnD
현재 HTML5 native DnD는 모바일 touch 미지원 → 클릭 메뉴로 대체.

**개선**: `@dnd-kit/core` 도입 — pointer events 기반, touch/mouse 모두 지원.

대상: `apps/web/src/features/room/LobbyMemberCard.tsx`, `RoomLobbyModal.tsx`

---

## 4. P2 — 외부 공개 준비 / 보안

### 4-1. Sentry 에러 모니터링 (ROADMAP4·5)
- `@sentry/react` (web) + `@sentry/node` (server)
- ErrorBoundary fallback에 `Sentry.captureException`
- Socket error도 Sentry로
- env: `VITE_SENTRY_DSN`, `SENTRY_DSN`

### 4-2. README.md (ROADMAP5 §9)
GitHub repo 공개 시 필요. 현재 없음.
- 프로젝트 개요 (한국 화투 5인 화상)
- 데모 URL (Vercel)
- 기술 스택 / 명령어
- 라이선스 (친구용 MVP라 신중)

### 4-3. Rate limiting (ROADMAP4 Tier1 §10)
socket.io spam 방지. 예:
- 같은 user의 같은 event 연속 호출 → 100ms throttle
- chat:send는 1초당 5건 제한
- room:create는 1분당 5건

대상: `apps/server/src/socket/handlers.ts` middleware 또는 LRU cache

### 4-4. 키보드 단축키 (ROADMAP4 Tier2 §20)
- 1~9: 손패 N번째 카드 클릭 (2자릿수는 두 번 입력)
- Space: matchable 첫 번째 자동 매칭
- G / S: 고 / 스톱 모달에서 선택
- C: 채팅 열기

### 4-5. 다국어 i18n (ROADMAP4 Tier2 §17)
- `react-i18next` 또는 `react-intl`
- 한국어 (default) + 영어 (외국인 친구용)
- 룰 텍스트 / EventOverlay 라벨 / 결과 화면

### 4-6. 카드 디자인 테마 (ROADMAP4 Tier2 §18)
- 다크 / 라이트 모드
- 카드 뒷면 종류 (3~5가지)
- 설정 모달에서 토글

### 4-7. AI 캐릭터성 (ROADMAP4 Tier2 §19)
- 봇별 닉네임 / 성격 / 말투
- 채팅에 봇이 가끔 메시지 (난이도 hard일수록 풍부)
- 광박/멍박 발동 시 봇이 도발 메시지

### 4-8. 모바일 화면 꺼짐 방지 (ROADMAP4 Tier2 §16)
Wake Lock API로 게임 중 화면 꺼지지 않게.

```ts
const wakeLock = await navigator.wakeLock.request('screen');
// 게임 종료 시 wakeLock.release()
```

### 4-9. Web Push 알림 (ROADMAP4 Tier2 §15)
- 친구가 방 만들면 알림
- PWA 활용 — Service Worker + Push API
- 사용자 OAuth 가입 후 의미 있음 (P3 이후)

---

## 5. P3 — 상업화 필수 (DB / Auth / 법규)

### 5-1. 사용자 영구 식별 + OAuth (ROADMAP4 §4)
현재 익명 `sessionStore`. 상업화 시:
- DB `users` 테이블 + JWT 세션
- 카카오 OAuth 1순위 (한국 시장 + 본인인증 통합)
- Google OAuth 2순위 (외국인)
- 게스트 → OAuth 마이그레이션 (기존 history 보존)

### 5-2. 본인인증 (성인 확인) (ROADMAP4 §1)
- 카카오 인증 (성인 확인 받음)
- 18세 미만 가입 차단

### 5-3. 이용약관 / 개인정보처리방침 (ROADMAP4 §7-4)
- 변호사 자문
- 한국인터넷진흥원 KISA 표준 양식
- 가입 시 동의 체크

### 5-4. 게임물관리위원회 등급분류 (ROADMAP4 §1)
- 청소년이용불가 (18세 이상) 등급
- 신청 → 2~4주 대기
- 미신청 운영 불법

### 5-5. 글로벌 통계 / 리더보드 (ROADMAP4 Tier2 §12)
- 일/주/월 우승률, 광박/멍박 횟수
- DB `game_history` 집계 → 시간순 + user별

### 5-6. 친구 목록 / 즐겨찾기 (ROADMAP4 Tier2 §13)
- 같이 게임한 사용자 추가
- 친구가 방 만들면 알림

### 5-7. 게임 리플레이 (ROADMAP4 Tier2 §14)
- 액션 히스토리 DB 저장 + 재생
- 게임 종료 후 사용자가 재시청 가능

---

## 6. P4 — 선택 / 장기

### 6-1. 음성 인식 "고/스톱" (Web Speech API)
- 마이크 활성 상태에서 사용자 음성 "고"/"스톱" → 자동 emit
- 단 LiveKit 마이크 트랙 점유 충돌 검토 필요

### 6-2. 스트리머 모드
- 닉네임 / 방ID 가리기
- 손패 노출 옵션

### 6-3. 배경음악 (BGM)
- 차분한 한국 전통 BGM
- 설정 모달에서 ON/OFF + 볼륨

### 6-4. 대결 모드 / 토너먼트
- 점수 누적 라운드 (3판 2선 등)
- 토너먼트 브래킷

### 6-5. 룰 변형 (지역별)
- 전라도 / 경상도 룰 차이
- 호스트가 방 만들 때 룰 세트 선택

---

## 7. 이번 세션 발견 사항 (추적용)

| # | 항목 | 비고 |
|---|---|---|
| A | `nine-yeol-toggle`/`nine-yeol-opponent` preset `drawTop[1]=m09-pi` 잠재 버그 | 이번에 `nine-yeol-opponent`만 fix — toggle도 정리 권장 (§3-3) |
| B | server `endGameLog` 호출이 일부 흐름에서 누락 가능 (chongtong / 쇼당 등) | 검토 후 보강 |
| C | `useMultiTurnSequence` `pendingViewRef` 큐가 너무 깊어지면 메모리 issue | 모니터링 추가 |
| D | `/rule-test`, `/result-demo`, `/debug-game` 라우트 production에서도 접근 가능 | production guard 검토 |
| E | preset name이 RoomLobbyModal/Schemas/PresetId 3곳에 중복 | enum 단일 source 검토 |
| F | LiveKit token 1시간 만료 시 server-side timer 충돌 | ROADMAP4 §28에 명시. 미해결 |
| G | InMemoryRoomStore — server crash 시 진행 중 게임 손실 | P3 DB 도입으로 해결 예정 |
| H | RoomRules `addPoint` (흔들기 +N점) 코드 미적용 — UI만 | ROADMAP4 §26. low priority |
| I | `consecutiveAutoTurns` reset / accumulate 흐름 검증 부족 | 게임 로그로 확인 가능 |
| J | 9월 끗 모달이 stagedView race로 다시 안 뜨는 케이스? | 직전 fix로 해결됐지만 추가 모니터링 |

---

## 8. 작업 순서 추천

1. **P0 (1~2주)** — 모바일 채팅 / 봇 timing / AI go-stop / 모달 timeout — 안정성·UX 즉시
2. **P1 (1주)** — 광팔이 모달 / 결과 애니메이션 / preset 정리 / 게임 로그 alert / DnD — 폴리시
3. **P2 (2~3주)** — Sentry / README / Rate limiting / 단축키 / i18n / 카드 테마 / AI 캐릭터성 / Wake Lock — 외부 공개 준비
4. **P3 (4~8주 + 등급분류 2~4주)** — DB users / OAuth / 본인인증 / 약관 / 등급분류 — 상업화 필수 단계
5. **P4 (장기)** — 음성 인식 / 스트리머 모드 / BGM / 토너먼트 / 지역별 룰 — 선택 확장

**총 예상**: P0~P3까지 약 7~13주 + 등급분류 대기.

---

## 관련 문서

- [`ROADMAP5.md`](./ROADMAP5.md) — 테스트 도구 + 폴리시
- [`ROADMAP4.md`](./ROADMAP4.md) — 상업 배포 전환 + DB 도입 계획
- [`ROADMAP3.md`](./ROADMAP3.md) — 친구 MVP 완성
- [`rules-final.md`](./rules-final.md) — 룰 정의
- [`rules-todo.md`](./rules-todo.md) — 미구현 룰
- [`CLAUDE.md`](../CLAUDE.md) — 프로젝트 컨벤션 + 행동 지침
