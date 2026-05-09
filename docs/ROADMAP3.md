# GoStop 로드맵 v3 (다음 세션 시작 가이드)

**최종 갱신**: 2026-05-05
**이전**: [`ROADMAP2.md`](./ROADMAP2.md) (2026-05-03 기준 — 참고용으로만 보존)

---

## 🚀 다음 세션 시작 시 첫 작업 (사용자 지시 사항)

순서대로:
1. **리팩토링 검토** — 최근 추가 코드(B.5 히스토리 / B.6 PWA / 첫뻑 / 룰 테스트 페이지)에서 중복/응집도 낮은 부분 정리
2. **rules-todo.md 남은 작업** — 폭탄 2턴 skip / 9월 열끗 변환 / 쇼당 / 조커
3. **Playwright 테스트** — 모든 기능 모바일/PC 검증

---

## 📊 현재 상태 (2026-05-05 기준)

### ✅ 완료된 주요 기능

#### 룰 엔진 (rules-final.md 기준 95%+ 구현)
- 분배 (2인 10/8/20, 3인 7/6/21)
- 시작 점수 (2인 7점, 3인 3점) + 호스트 룰 override
- 점수 계산 (광/끗/띠/피/고도리/홍단·청단·초단/쌍피)
- 박 (피박 0장 면제 / 광박 / 멍박 / 멍따 / 고박)
- 고 배수 (1고+1, 2고+2, 3고+ ×2 누적)
- 흔들기 / 폭탄 (자동 발동) / 총통 (즉시 7점)
- 특수 매칭 (뻑 / 자뻑 owner 추적 / 따닥 정확 분류 / 쪽 / 싹쓸이 / 마지막 턴 예외)
- 3뻑 자동 승리 (즉시 3점)
- 나가리 (다음 판 ×2 누적)
- 첫뻑 시각효과 (⭐ 첫뻑!)

#### 핵심 시스템
- **5인 화상채팅** (LiveKit Cloud + 16:9 5등분 비율 사이드바 + 모바일 풀스크린 모달)
- **광팔이 시스템** (자원자 → 호스트 지정 → 마지막 입장자 자동, 4명+에서 활성)
- **방장 권한 시스템** (room:kick / room:transfer-host / game:next-round / room:update-rules)
- **방 룰 설정 모달** (`RoomRules` 타입 — winScore / allowMyungttadak 등)
- **1인 자동 AI 모드** (1명일 때 AI 봇 2명 자동 합류, 서버측 AI 턴 자동 진행)
- **텍스트 채팅** (chat:send/received, optimistic update, unread 카운트)
- **도움말 모달** (화투 룰 가이드)
- **게임 히스토리** (localStorage 50판 + 친구별 통계 + 우승률)
- **PWA** (vite-plugin-pwa, manifest, service worker)
- **시간 제한** (30/40/50/60/90초 + 카운트다운 + 자동 카드 플레이)
- **EventOverlay** (13가지 시각효과: 뻑/첫뻑/자뻑/따닥/쪽/싹쓸이/폭탄/흔들기/총통/고/스톱/박/멍따/나가리)
- **설정 모달** (음소거 / 볼륨 / 카메라 / 마이크)
- **룰 테스트 페이지** (`/rule-test`, 16개 preset 시나리오)

#### 아키텍처
- 모노레포 (pnpm workspace): `apps/web` (Vite + React 19), `apps/server` (Fastify + Socket.io), `packages/shared` (룰 엔진)
- 서버: 광팔이 / AI 봇 / 룰 통합 모두 적용
- 멀티/솔로 모두 동일 룰 엔진 (서버 권위)

### 📊 코드 통계
- shared 테스트: **98개 통과** ✓
- 패키지 typecheck: **3개 모두 OK** ✓
- 핵심 파일:
  - `packages/shared/src/rules/game.ts` (executeTurn — 폭탄 분기 포함)
  - `packages/shared/src/scoring/multipliers.ts` (calculateFinalScore)
  - `apps/server/src/socket/{handlers,gameLogic,aiTurn,broadcast}.ts`
  - `apps/web/src/features/{room,solo,livekit,rule-test}`

---

## 🔥 다음 세션 작업 1 — 리팩토링

### 검토 대상
최근 큰 작업들 (B.5/B.6/룰 테스트) 코드 응집도 / 중복 검토:

#### A. ResultView.tsx 분리
현재 1 파일에:
- 점수 계산 (`buildRankedPlayers` / `decideWinnerUserId`) — 이미 helper로 분리됨
- 히스토리 저장 useEffect (50줄) — 길어짐
- 결과 화면 UI (top 박스 / 순위 grid)
- CollectedGroups / Badge / FlagBadge 같은 작은 컴포넌트들

**리팩토링 제안**:
- `ResultView.helpers.ts` — buildRankedPlayers / decideWinnerUserId / saveToHistory
- `ResultView.UI.tsx` — Badge / FlagBadge / CollectedGroups
- `ResultView.tsx` — main 컴포넌트만

#### B. RuleTestPage.tsx 분리
현재 한 파일에 모든 panel:
- ResultPanel / SpecialsList / ScoreBreakdownPanel / FlagsList
- presets.ts는 이미 분리됨

**제안**:
- `rule-test/ResultPanel.tsx` — ResultPanel + SpecialsList + ScoreBreakdownPanel + FlagsList
- `RuleTestPage.tsx` — preset 선택 + result panel mount

#### C. lib/sound.ts 사운드 매핑 정리
현재 `SOUND_FILES` Record에 일반 사운드만. EventOverlay 이벤트별 사운드 매핑 미적용.

**제안**:
- `EVENT_SOUND_MAP: Record<GameEvent, SoundName>` — 이벤트 → 사운드 매핑
- EventOverlay 트리거 시 자동 사운드 재생
- 미설정 이벤트는 silent

#### D. shared 내 helper 정리
- `applySpecialsToState` (SoloPlay) — 비슷한 로직이 server에도 인라인. 공유 helper로 추출 가능

#### E. Lobby.tsx 정리
- 우상단 버튼 그룹 (📊/❓) — `LobbyHeaderButtons` 컴포넌트
- 디버그 도구 링크 (🧪 룰 테스트 / 🎴 결과 데모) — `DevTools` 컴포넌트

---

## 🔥 다음 세션 작업 2 — rules-todo.md 남은 룰

자세한 사항: [`rules-todo.md`](./rules-todo.md)

### 우선순위
1. **9월 열끗 ↔ 쌍피 변환** (Tier 2, 1일)
   - UI: 점수판 9월 열끗 카드 클릭 → "끗 / 쌍피" 토글
   - `calculateScore`에 `nineYeolAsSsangPi: boolean` 옵션 인자 추가
   - 봉인 상태 추적 (스톱 선언 후 변경 X)

2. **폭탄 후 2턴 skip-hand** (Tier 1, 1일)
   - `Player.bombSkipTurns: number` 필드 추가 (default 0)
   - 폭탄 발동 시 += 2
   - 본인 턴 시작 시 `bombSkipTurns > 0`이면 자동 더미 뒤집기 + decrement
   - server `game:action` 분기 + SoloPlay turnSequence 분기 + UI 표시

3. **쇼당** (Tier 3, 1~2일)
   - 상대 둘 다 점수 직전 + 본인 카드가 둘 다 영향 → "쇼당" 선언
   - 감지 로직 + UI 모달 + nagari 처리

4. **조커 카드** (Tier 3, 1일)
   - DECK에 조커 1~3장 추가 (옵션)
   - `RoomRules.jokerCount: 0 | 1 | 2 | 3`
   - 조커는 쌍피로 사용 (카드 inline kind 변경)

---

## 🔥 다음 세션 작업 3 — Playwright 테스트

### 검증 시나리오

#### 모바일 (932×430)
- [ ] 로비 + 도움말 / 전적 모달 잘림 없음
- [ ] 방 만들기 → 대기실 → [⚙️ 룰] / [💬 채팅] / [👑 방장 위임] / [🚪 강퇴] 동작
- [ ] WaitingRoom 광팔이 안내 + 자원/지정 토글
- [ ] 1인 시작 → AI와 게임 진행 (AI 턴 자동)
- [ ] GameView ⚙️/🎥/💬/😀 우측 토글 모두 표시
- [ ] 시간 제한 카운트다운 표시
- [ ] 흔들기 모달 → 적용 후 닫힘 (이번 fix 검증)
- [ ] GoStop 모달 / TargetPicker 모달 잘림 없음
- [ ] 화상 모달 1~5명 layout (FitTile)
- [ ] EventOverlay 13가지 이벤트 (룰 테스트 페이지로 검증)
- [ ] ResultView 모든 flag 표시
- [ ] 다음 판 버튼 (호스트 한정)

#### PC (1280×720)
- [ ] OpponentSlot row + 화상 사이드바 (16:9 × 5)
- [ ] PCExpandedModal (사이드바 카드 클릭)
- [ ] 게임판 / 점수판 / 손패 비율
- [ ] WaitingRoom 3-column grid

#### 채팅 멀티 검증 (사용자 직접 — 두 브라우저)
- 첫 브라우저 메시지가 본인에게 보임 (이번 fix 검증)
- unread 카운트 표시
- 양방향 broadcast

#### 광팔이 검증 (4~5명 동시 입장 시뮬레이션)
- 자원 / 지정 / 자동 우선순위
- 광팔이 spectator로 이동
- 다음 판에 spectator → player 복귀

---

## 🆕 추가 추천 기능 (사용자 명시 X — 가치 우선순위)

### Tier 1 — 즉각적 사용성 향상

#### R.1 ⭐ 사운드 매핑 확장 (0.5일)
- 13개 EventOverlay 이벤트별 사운드 매핑
- `lib/sound.ts`에 `EVENT_SOUND_MAP` 추가
- 사용자가 후속에서 사운드 파일 추가 시 자동 재생

#### R.2 ⭐ 글로벌 ErrorBoundary + Toast (0.5일)
- React ErrorBoundary로 unhandled error 캐치
- toast 라이브러리 또는 자체 구현 (zustand)
- 알림 통합: 에러 / 성공 / info

#### R.3 ⭐ AFK / 일시정지 (B.12) (1~2일)
- 플레이어가 30초 응답 없으면 AFK 표시
- 5분+ AFK면 자동 spectator 또는 kick (호스트 결정)
- 호스트 [⏸️ 일시정지] 버튼

### Tier 2 — 완성도 / 친구 사용성

#### R.4 카드 디자인 / 테마 (B.8 변형) (1~2일)
- 다크/라이트 모드 토글
- 카드 뒷면 디자인 2~3종 (사용자가 추가)
- 설정 모달에서 선택

#### R.5 AI 캐릭터성 (B.14) (1~2일) — 사용자 제외 요청했지만 가치 높음
- AI 봇별 닉네임/아바타/성격 (초급=김초보, 중급=김중수, 고급=박고수)
- 게임 중 AI 자동 채팅 ("오 좋은 패네", "광박이다 ㅋㅋ")
- 결과 화면 AI 표정 변화

#### R.6 빠른 진행 모드 (B.16) (0.5일)
- "데모 모드": 손패 5장 / 더미 짧음 / 1판 30초 안에
- "빠른 진행": animationTiming 50% 추가 단축

#### R.7 결과 공유 / 스크린샷 (B.7) (1일)
- ResultView [📷 캡처] 버튼
- `html2canvas` / `dom-to-image`로 결과 화면 캡처
- 다운로드 또는 클립보드 복사

### Tier 3 — 인프라 / 운영

#### R.8 ⭐⭐ 배포 (A.4) (1일)
- **Vercel** (web) + **Railway** (server)
- 환경변수 (LiveKit 키) 설정
- CORS / WebSocket 도메인 화이트리스트
- 도메인 (선택)
- 친구들이 외부에서 접속 가능 → **MVP 진짜 시작**

#### R.9 GitHub Actions CI (0.5일)
- PR 시 typecheck + test 자동 실행
- main 브랜치 push 시 자동 배포 (Vercel/Railway 연동)

#### R.10 에러 모니터링 (Sentry) (0.5일)
- 운영 환경에서 unhandled error 추적
- LiveKit 연결 실패 / Socket 끊김 등 추적

#### R.11 키보드 단축키 (B.10) (0.5일)
- 1~7: 손패 N번째 카드 선택
- Space: 매칭 가능한 첫 카드
- G/S: 고/스톱 결정
- ESC: 모달 닫기 (이미 적용)

### Tier 4 — 큰 작업 / 옵션

#### R.12 다국어 (B.9) (2일)
- 한/영 전환 (외국인 친구)
- `react-i18next` 또는 자체 messages 파일

#### R.13 Custom 룰 테스트 모드 (1일)
- 룰 테스트 페이지 확장
- 손패/바닥 카드 직접 선택 (preset 외)
- 더미 카드 순서 직접 결정

#### R.14 음성 인식 "고/스톱" (B.13) (2~3일)
- Web Speech API
- 한국어 음성 인식 (정확도 튜닝 필요)

#### R.15 리플레이 시스템 (Phase 5 Tier 3) (3~5일)
- `room.game.history`에 모든 액션 저장
- 결과 화면 [▶ 리플레이] 버튼
- 단계별 카드 비행 재생

---

## 📁 주요 파일 빠른 참조

### 룰 엔진 (`packages/shared/src/`)
- `types/rules.ts` — RoomRules + defaultRoomRules
- `types/room.ts` — Room (stuckOwners / nagariMultiplier / chongtongUserId / rules)
- `types/views.ts` — RoomView (서버 → 클라)
- `rules/game.ts` — executeTurn (폭탄 분기 / 따닥 우선 / 자뻑 owner)
- `rules/matching.ts` — playCard / detectChongtong / canBomb
- `scoring/basic.ts` — calculateScore / canDeclareGoStop (winScore override)
- `scoring/multipliers.ts` — calculateFinalScore (instant-win helper)
- `messages.ts` — Socket.io ClientToServer / ServerToClient 이벤트

### 서버 (`apps/server/src/socket/`)
- `handlers.ts` — 모든 socket.on 라우팅
- `gameLogic.ts` — distributeGwangPali / startGameInRoom / fillWithAIBotsIfNeeded / removeAIBots / stealPiFromOpponents / reconvertSpectatorsToPlayers
- `aiTurn.ts` — progressAITurnIfAny (AI 봇 자동 턴)
- `broadcast.ts` — broadcastRoomState / userRoom / gameRoom / IO 타입
- `views.ts` — buildRoomView (서버 → 클라 시점 변환)
- `schemas.ts` — zod 스키마

### 클라 (`apps/web/src/`)
- `App.tsx` — 라우트 + EventOverlay
- `features/lobby/Lobby.tsx` — 로비 + 도움말/전적/룰테스트 진입
- `features/room/`
  - `RoomScreen.tsx` — view.phase 분기 + LiveKitGameRoom wrap
  - `WaitingRoom.tsx` — 대기실 + 광팔이 / 룰 / 강퇴 / 위임
  - `GameView.tsx` — 게임 화면 grid + 시간 제한 + 토글들
  - `ResultView.tsx` — 결과 + 히스토리 저장 + 다음 판
  - `RoomRulesModal.tsx` — 룰 설정 모달
- `features/solo/SoloPlay.tsx` — 솔로 모드 (4-phase 시퀀스)
- `features/livekit/` — LiveKit (사이드바 / 모바일 모달 / VideoTile)
- `features/rule-test/` — 룰 테스트 페이지 (preset)
- `components/` — EventOverlay / SettingsModal / HelpModal / HistoryModal / ChatPanel / Card
- `stores/` — sessionStore / roomStore / chatStore / gameHistoryStore / eventOverlayStore / devTestStore
- `hooks/` — useRoomSocket / useTurnTimer / useElementSize / useRoomSocket
- `lib/` — sound / socket / livekit / animationTiming / layoutConstants

---

## 🔧 자주 쓰는 명령어

```bash
# dev (web + server)
pnpm dev                              # 둘 다
pnpm dev:web                          # Vite (5173)
pnpm dev:server                       # Fastify (4000)

# typecheck (변경 후 항상)
pnpm --filter @gostop/web typecheck
pnpm --filter @gostop/server typecheck
pnpm --filter @gostop/shared typecheck

# 룰 엔진 테스트
pnpm --filter @gostop/shared test
pnpm --filter @gostop/shared exec vitest run src/rules/matching.test.ts

# build / clean
pnpm build
pnpm clean
```

---

## 🐛 알려진 이슈 / 단순화 사항

1. **`reconvertSpectatorsToPlayers`** — 다음 판 시작 시 모든 spectator를 player로 복귀. 의도적 spectator(관전자로 입장한 사람)와 광팔이 spectator 구분 X
2. **AI 턴 timing** — 1.5초 고정. 사용자 설정 가능하면 좋음
3. **광팔이 stuck owner** — 광팔이는 player가 아니라 stuck 발생 X (현재 OK)
4. **`SettingsModal` AnimatePresence 안에 `HelpModal`** — 중첩 motion.div 충돌 가능성. AnimatePresence 외부로 빼는 게 안전 (다음 리팩토링 시)
5. **`addPoint` 흔들기 / `bombStealCount` / `allowGukJoon` / `autoStopOnWin`** — `RoomRules`에 정의돼 있지만 코드 미적용 (UI만)

---

## 📚 관련 문서

- [`rules-final.md`](./rules-final.md) — 확정 룰 정의
- [`rules-todo.md`](./rules-todo.md) — 미구현 룰 list
- [`ROADMAP2.md`](./ROADMAP2.md) — 이전 로드맵 (참고용)
- [`apps/web/docs/layout-sizing.md`](../apps/web/docs/layout-sizing.md) — 카드 사이즈 결정 원리

---

## ✨ 한 줄 요약

> **GoStop은 친구용 MVP 게임으로 룰 95% + 화상채팅 + 1인 AI + 채팅 + 도움말 + 전적이 완성된 상태이며, 남은 작업은 리팩토링 / 옵션 룰 / Playwright 검증 / (선택)배포 단계입니다.**
