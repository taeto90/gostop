# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

한국 화투(고스톱) 5인 화상채팅 게임. 친구용 MVP — 베팅·실제 화폐·회원가입은 추가하지 않음 (legal).
공유 룰 엔진을 클라이언트와 서버가 모두 import해서 동일한 게임 로직을 보장.

## 명령어

```bash
# 의존성 설치 (pnpm 10+, Node 22+ 필요)
pnpm install

# dev (web + server 동시) — 보통 사용자가 이미 띄워둔 상태로 작업 시작함
pnpm dev
pnpm dev:web      # Vite, port 5173
pnpm dev:server   # tsx watch, port 4000

# 타입체크 — 변경 후 항상 실행
pnpm --filter @gostop/web typecheck      # 가장 자주 사용
pnpm --filter @gostop/server typecheck
pnpm --filter @gostop/shared typecheck

# 룰 엔진 테스트 (vitest, web에는 테스트 없음)
pnpm --filter @gostop/shared test                                          # 전체 (114개)
pnpm --filter @gostop/shared exec vitest run src/rules/matching.test.ts    # 단일 파일

pnpm build
pnpm clean
```

`lint` 스크립트는 root에 정의되어 있으나 sub-package에 실제 스크립트 없음 (ESLint 미설정).

## 라우트

- `/` — 로비 (`features/lobby/Lobby.tsx`) — 프로필 카드 + 방 만들기 카드 + 이전 방 복귀 카드 + 방 목록 (5초 폴링) + 비밀방 모달
- `/room/:id` — 게임 (`features/room/RoomScreen.tsx`) — 1인이면 server가 AI 봇 1명 자동 합류 (1:1 맞고)
- `/result-demo` — 결과 화면 디자인 검토용 (mock 데이터)
- `/rule-test` — 룰 검증 페이지 (18개 preset 시나리오)

## 아키텍처

### 모노레포 (pnpm workspace)

```
apps/web        Vite 7 + React 19 + Tailwind v4 (클라이언트, PWA)
apps/server     Fastify 5 + Socket.io 4 + Zod (서버)
packages/shared 룰 엔진 + 타입 (클라/서버 공유)
```

### 공유 룰 엔진 (`packages/shared`)

클라이언트와 서버가 **동일한 룰을** 사용하도록 강제하는 핵심. `src/index.ts`에서 export:

- `cards/` — `DECK` (48장), `createShuffledDeck`, `getCardById`, `createBombCard`, `createJokerCard`, `awardBombBonusCards`
- `rules/` — `executeTurn`, `simulateOrNeedsSelection` (사용자 선택 필요 검사 + executeTurn 통합), `simulateFieldAfterHand`, `findMatches`, `hasDifferentMatchKinds`, `dealNewGame` (인원별 분배 + jokerCount 옵션), `detectChongtong`(총통)
- `scoring/` — `calculateScore` (광/끗/띠/피/고도리/홍·청·초단/쌍피, `nineYeolAsSsangPi`/`allowGukJoon` 옵션), `calculateFinalScore` (박/배수: 피박·광박·멍박·멍따·고박·N고·총통·3뻑·나가리·shakeBonusType)
- `ai/` — `chooseAiCard(hand, field, collected, difficulty)` 솔로 AI
- `types/` — `Card` (`isBomb`, `isJoker` 플래그), `RoomView`, `RoomListItem`, `GameAction` (`targetAfterHand`/`Draw`), `RoomRules`, `defaultRoomRules`, `Player.flags` (`consecutiveAutoTurns`, `nineYeolAsSsangPi`)
- `messages.ts` — Socket.io `ClientToServerEvents`, `ServerToClientEvents`, `PlayCardResponse` (needsSelection)

서버(`apps/server/src/socket/turnFlow.ts`의 `playCardForPlayer`)도 `executeTurn`을 호출해 액션을 검증 → **클라이언트 액션은 서버에서 같은 룰로 다시 실행**되며 결과를 broadcast.

### 정통 매칭 룰 (rules-final.md §1-6, Image #20 표 기준)

| 케이스 | 결과 (용어) | 비고 |
|---|---|---|
| 바닥 0 + 손 1 + 더미 같은 월 | 쪽 | 피 1장씩 뺏어옴 |
| 바닥 1 + 손 1 + 더미 다른 월 | 그냥 먹기 | 일반 매칭 |
| 바닥 1 + 손 1 + 더미 같은 월 | **뻑 (설사)** | 3장 stuck — `executeTurn` 후처리에서 손패 collected 되돌림 |
| 바닥 2 + 손 1 + 더미 다른 월 | 그냥 먹기 (선택) | **종류 다른 2장**이면 사용자 선택 모달 |
| 바닥 2 + 손 1 + 더미 같은 월 | 따닥 | 4장 모두 + 피 1장씩 |
| 바닥 3 + 손 1 | 뻑 회수 | 자뻑 +2피 / 일반 회수 +1피 |

종류 비교 (`hasDifferentMatchKinds`): `kind` + `ddiKind` + `isSsangPi` + `isGoDori` + `isBigwang`. 같은 종류 2장(피 2장 등)은 자동 첫 번째.

선택 모달 시점: **Phase 3 후** (더미 비행 끝난 후) → 사용자 선택 → 두 번째 `executeTurn` 호출 → Phase 4. 솔로/멀티 모두 동등 흐름.

### 클라이언트 (`apps/web/src`)

```
features/
  lobby/         Lobby (다크 그린 그라데이션, 좌1:우2 grid),
                 LobbyProfileCard, LobbyActionCards (방 만들기 단일 액션),
                 LobbyResumeCard (이전 방 복귀, room:my-current 응답),
                 LobbyRoomList (방 목록 + 5초 폴링 + visibilitychange throttle + ID 입장),
                 CreateRoomModal (비밀번호 + 관전자 + 미디어 모드 video/voice-only),
                 PasswordPromptModal, PasswordInput
  room/          GameView (phase 'waiting' 포함 모든 단계, testMode 배너),
                 RoomScreen (voiceOnly = view.rules.mediaMode === 'voice-only' 도출 후 LiveKit으로 전달),
                 ResultView, ResultDemoView,
                 RoomLobbyModal (대기실 컨트롤 — phase='waiting' 오버레이,
                                 멤버 그리드 + 시작 + AI 봇 + 본인 관전자 + 광팔이 + MediaModeBadge),
                 LobbyMemberCard (드래그&드롭 + 클릭 메뉴 — 강퇴/위임/관전자/광팔이 지정),
                 AISetupModal (봇 인원 + 봇별 난이도, RoomLobbyModal에서 호출),
                 RoomRulesModal (mediaMode 옵션 포함),
                 useEndedSnapshot (ResultView snapshot/dismiss hook),
                 GameSettingsActions (호스트 룰 / 9월 열끗 토글 / 쇼당 선언),
                 game-ui/* (CenterField, MyHand,
                 OpponentSlot — phase='waiting' 클릭 시 호스트 메뉴 popover,
                 CompactHeader, MobileCollected, ShakeBombModal, TargetPickerModal),
                 result/ (helpers, Badges)
  livekit/       LiveKitGameRoom (voiceOnly prop → token fetch + initialVideo false),
                 VideoSidebar (voiceOnly 시 "🎙️ 음성" 배지),
                 VideoMobileModal (voiceOnly 헤더 라벨 분기),
                 VideoTile, MediaSettings, MediaToggleButtons (voiceOnly 시 카메라 토글 hide),
                 PCExpandedModal, FitTile, _shared/
  rule-test/     RuleTestPage + presets.ts + ResultPanel
  debug-game/    개발용 디버그 도구
components/      Card (`isBomb`/`isJoker` SpecialCard 분기), EventOverlay,
                 ChatPanel, HelpModal, HistoryModal, SettingsModal,
                 EmojiReactions, EmojiPicker, AnimatedNumber,
                 TurnIndicator, InviteLink, CollectedStrip,
                 ErrorBoundary (App 최상위 wrap), ToastContainer
hooks/           useElementSize, useRoomSocket, useAfkDetect,
                 useAnyTurnCountdown (server timestamp 기반 모든 player turn 카운트),
                 useMultiPlayCard (멀티 emit + needsSelection 모달),
                 useMultiSpecialsTrigger, useMultiTurnSequence (stagedView staging)
lib/             layoutConstants, animationTiming, animationContext, sound,
                 socket, livekit, dealingPattern (정통 4-3-3 stagger)
stores/          zustand: sessionStore, roomStore, chatStore, eventOverlayStore,
                 gameHistoryStore, devTestStore, toastStore
```

### 서버 (`apps/server/src`)

```
server.ts          Fastify entry, /health, LiveKit 토큰 endpoint
config.ts          env 로딩 (CORS_ORIGIN array 지원, LIVEKIT_API_KEY/SECRET 등)
rooms/             InMemoryRoomStore (Repository 패턴) + playerOps
socket/
  handlers.ts      모든 socket.on 라우팅 (room/game/chat/광팔이/9yeol/shodang/list)
  turnFlow.ts      playCardForPlayer (handlers + autoTurn 공통),
                   scheduleAutoTurnTimer (server-side 시간 초과 timer),
                   autoPlayTurnNow, pickAutoCardId
  gameLogic.ts     distributeGwangPali / startGameInRoom / fillWithAIBots (1:1 1명만) /
                   stealPiFromOpponents / reconvertSpectatorsToPlayers
  aiTurn.ts        progressAITurnIfAny — AI 봇 자동 턴 (2.2초 setTimeout 재귀)
  broadcast.ts     broadcastRoomState, userRoom/gameRoom, IO 타입
  views.ts         buildRoomView (서버 → 클라 시점 변환, hand는 본인만,
                   turnStartedAt/currentTurnLimitSec 노출)
  schemas.ts       zod 스키마 (RoomCreate에 password, GameAction에 targetAfterHand/Draw)
livekit/
  token.ts         AccessToken 발급 (livekit-server-sdk, 실제 통합)
```

`game:action` 핸들러: `playCardForPlayer(io, room, store, userId, opts, false)` 한 줄로 처리. 자동 발동(server timer)은 `playCardForPlayer(..., true)`로 동일 함수 호출 (`isAuto=true`면 needsSelection 자동 첫 번째 + `consecutiveAutoTurns` +1).

### 핵심 시스템

- **방장 권한** — `Room.hostUserId`. 핸들러: `room:kick`, `room:transfer-host`, `room:return-to-lobby`, `room:update-rules`. 클라에서 host만 컨트롤 노출. **게임 중(playing) 룰 변경 차단** — 'waiting' 또는 'ended'에서만 가능
- **한 사용자 한 방 정책** — `room:create`/`join`/`rejoin` 직전 `evictUserFromOtherRooms` 호출. 다른 방의 phase='waiting'/'ended'면 자동 정리, phase='playing'이면 거부 ("다른 방에서 게임 진행 중. 먼저 나가주세요")
- **이전 방 복귀** — 로비 mount 시 `room:my-current` 조회. 응답에 방 있으면 `LobbyResumeCard` 노출 → 클릭 시 RoomScreen 자동 rejoin
- **leave guard** (`lib/leftRoomGuard.ts`) — "나가기" 버튼 누른 직후 60초 grace 동안 같은 roomId로 자동 재진입 차단. 뒤로 가기/HMR/URL 직접 입력으로 인한 좀비 멤버십 방지. lobby에서 명시적 입장(방 카드/LobbyResumeCard/방 만들기) 시 flag 제거
- **게임 종료 → 대기실 복귀** — ResultView "🎮 게임으로" → `room:return-to-lobby` (호스트만). phase='ended' → 'waiting' reset, room.game=null, 광팔이 spectator → player 복귀, AI 봇/룰/`nagariMultiplier` 보존. 호스트가 다시 `game:start` 누르면 다음 판 (nagari 누적 그대로)
- **방 룰 모달** (`RoomRulesModal`) — `RoomRules` (winScore 3/5/7, allowMyungttadak, turnTimeLimitSec 0/30/40/50/60/90, jokerCount 0~3장, allowGukJoon, shakeBonusType, **mediaMode 'video'/'voice-only'** 등). 모두 코드 적용됨
- **음성 전용 모드** — `RoomRules.mediaMode='voice-only'`. CreateRoomModal에서 호스트가 선택, 방 룰 모달에서 변경 가능. 서버 LiveKit token 발급 시 `canPublishSources=[MICROPHONE]`로 video publish 권한 X. 클라는 `voiceOnly` prop으로 카메라 토글 hide + initial video 강제 false
- **룰 변경 broadcast** — `room:update-rules` 시 변경된 키 diff를 모든 멤버에게 `room:rules-changed` event broadcast. 클라 `useRoomSocket`이 toast 표시 ("⚙️ 호스트가 룰 변경 — 시작 점수 3점")
- **대기실 disconnect 자동 제거** — phase='waiting'/'ended'에서 disconnect 시 10초 grace 후 `removeMember` 자동. phase='playing'은 기존대로 connected=false 유지 (rejoin 가능). 호스트면 `removeMember`가 다음 player/spectator로 자동 위임
- **비밀방** — `Room.password` (4~20자, optional). `RoomCreateSchema` + 입장 시 검증. 멤버 rejoin은 비번 재확인 X. 로비 `room:list`에 `hasPassword` flag만 노출 (비번 자체 X)
- **광팔이** (4~5명) — 자원자 → 호스트 지정 → 마지막 입장자 자동. 광팔이는 spectator로(`isGwangPali=true`), 다음 판에 player 복귀. 의도적 spectator(`isGwangPali=false`)는 그대로
- **1인 자동 AI 모드** — 방에 1명만 있으면 서버가 **AI 봇 1명 자동 합류 (1:1 맞고)**, `progressAITurnIfAny`로 턴 자동 진행. 사람 합류 시 봇 제거. 모든 상대가 AI면 turn timer 비활성 (사용자 자유 진행)
- **server-side turn timer** — `scheduleAutoTurnTimer`가 `room.turnTimerRef`로 setTimeout 예약. 사용자가 브라우저 닫아도 server가 자동 카드. AI 봇 turn에는 X. `consecutiveAutoTurns >= 2`인 player는 다음 turn부터 5초로 단축 (직접 카드 클릭 시 0으로 reset)
- **사용자 선택 모달 (정통 매칭 룰 §1-6)** — 매칭 카드 종류 다른 2장 시 모달. server `needsSelection` 응답 → 클라 모달 → 재emit
- **텍스트 채팅** — `chat:send`/`chat:received`. server는 `socket.to(gameRoom).emit` (본인 제외 broadcast). 클라는 ack 성공 시 즉시 store에 push (optimistic update). 50개 제한 + unread count
- **EventOverlay** — 풀스크린 emoji + label, 2.2초. 14개 이벤트 (뻑/첫뻑/자뻑/따닥/쪽/싹쓸이/폭탄/흔들기/총통/고/스톱/박/멍따/나가리/쇼당). `EVENT_SOUND_MAP`으로 사운드 매핑. `useMultiSpecialsTrigger`가 `view.turnSeq` 변경 감지 시 자동 발화
- **AFK 표시** — `useAfkDetect`. turnUserId 변경 후 30초+ 응답 없으면 닉네임 옆 💤 (클라 단독, broadcast X)
- **9월 열끗 ↔ 쌍피 변환** — `Player.flags.nineYeolAsSsangPi` + `game:toggle-9yeol` 이벤트. `calculateScore({nineYeolAsSsangPi})` 옵션
- **쇼당** — `game:declare-shodang` (본인 turn에만). 즉시 phase=ended + nagariMultiplier ×2
- **조커 카드** — `RoomRules.jokerCount` 0~3장. 셔플에 추가. 매칭 X, 클릭 시 collected에 쌍피 가치 + 더미 1장 뒤집기
- **폭탄 보너스 카드** — 폭탄 발동 후 본인 손패에 폭탄 카드 2장 추가 (`awardBombBonusCards`). 클릭 시 손패 제거 + 더미 1장 뒤집기 (매칭 X)
- **게임 히스토리** — localStorage 50판 + 친구별 통계. `ResultView`에서 ended 시 1회 저장 (savedRef)
- **Toast / ErrorBoundary** — 글로벌 `toastStore` (info/success/warning/error). `alert()` 대신 사용. `ErrorBoundary`는 App.tsx 최상위 wrap → 자식 throw 시 fallback UI + 새로고침
- **PWA** — `vite-plugin-pwa`. manifest + service worker

### 4-Phase 카드 비행 시퀀스

손패 카드 클릭 시 발생하는 4단계 애니메이션. `lib/animationTiming.ts`에서 모든 duration 조절:

1. **Phase 1**: 손패 카드 그 자리에서 확대(`HAND_PEAK_DURATION`) → 바닥으로 비행(`FLY_DURATION_HAND_TO_FIELD`). framer-motion `layoutId` 보간.
2. **Phase 2**: 착지 사운드 (`card-place.mp3`).
3. **Phase 3**: 더미에서 카드 뒤집기(rotateY) + 확대(`SCALE_PEAK`) → 빈 슬롯 비행. CenterField의 별도 floating motion.div (layoutId 없이) 처리 — 일반 매핑의 같은 카드는 opacity 0으로 가림.
4. **Phase 4**: 매칭 카드들이 한 장씩(`COLLECT_STAGGER`) 점수판으로 비행.

**Phase 3 후 사용자 선택 모달** (정통 매칭 룰): 매칭 종류 다른 2장이면 모달 → 사용자 선택 → 두 번째 `executeTurn` → Phase 4 진행.

**4-phase staging** (`useMultiTurnSequence`): server broadcast 도착 시 prevView 유지하다가 단계별로 incoming view로 전환 + peakingHandCardId/flippingCardId 효과. AI 봇 턴은 server `aiTurn.ts`의 `AI_TURN_DELAY_MS`(2200ms 기본)로 자동 진행.

### 정통 4-3-3 분배 시각화 (`lib/dealingPattern.ts`)

`handDealDelay(i, total)` / `fieldDealDelay(i, total)`:
- 3인 (손패 7 / 바닥 6): 4장 → 바닥 3장 → 3장 → 바닥 3장
- 2인 (손패 10 / 바닥 8): 5장 → 바닥 4장 → 5장 → 바닥 4장

MyHand + CenterField 첫 mount 카드만 적용. 새 카드(더미 뒤집기)는 zero delay.

### 반응형 레이아웃

`COMPACT_BREAKPOINT = 950px`. 미만은 모바일 가로 모드:
- `CompactHeader` (한 줄), 점수판 140px, 게임판 2행 4열 (더미가 두 row 사이에 겹쳐 있음), 손패 우측 column만, 화상은 풀스크린 모달 토글

PC (≥ 950px):
- `OpponentSlot` row, 점수판 260px, 게임판 6각형 + 코너, 손패 가로 전체, 우측 화상 사이드바 (16:9 × 5)

GameView는 단일 CSS Grid:
- `grid-template-columns`: `${COLLECTED_PANEL_WIDTH}px 1fr`
- `grid-template-rows`: `auto minmax(0, 1fr) ${handMin}px`
- 모바일은 좌측 점수판이 `row-span-2`로 game+hand 영역 모두 차지

OpponentSlot은 **고정 height 170px** + collected 미리 영역 확보 (`min-h-[56px]`) → 카드 누적되어도 layout 안 흔들림.

### 사이즈 변수 단일 소스

**`apps/web/src/lib/layoutConstants.ts`** — 손패/바닥/점수판 카드 크기, 영역 비율, gap, breakpoint를 모두 한 파일에서 관리.

⚠️ `cardW = min(cap, widthBased, heightBased)` 중 가장 작은 값이 결정자.
PC에서는 heightBased가 결정자인 경우가 많아 `*_MAX_WIDTH` cap만 키워도 효과 없음 → `HAND_AREA_RATIO`/`HAND_AREA_MAX` 등 영역 height 조절 필요. 시나리오별 가이드는 [`apps/web/docs/layout-sizing.md`](apps/web/docs/layout-sizing.md) 참고.

## 자주 하는 작업

| 변경하고 싶은 것 | 손대야 할 곳 |
|---|---|
| 카드 사이즈 (손패/바닥) | `lib/layoutConstants.ts` — 단 cap만 바꾸면 효과 없을 수 있음, 영역 height도 조절 |
| 손패 영역 height 비율 | `layoutConstants.ts` 의 `HAND_AREA_RATIO` |
| 점수판 컬럼 너비 | `layoutConstants.ts` 의 `COLLECTED_PANEL_WIDTH` |
| 모바일/PC 분기 임계값 | `layoutConstants.ts` 의 `COMPACT_BREAKPOINT` |
| 카드 비행 속도 | `lib/animationTiming.ts` (Phase별 duration) |
| 분배 stagger 패턴 | `lib/dealingPattern.ts` |
| AI 봇 속도 | `apps/server/src/socket/aiTurn.ts` `AI_TURN_DELAY_MS` (default 2200ms, env override 가능) |
| 매칭 강조 ring/glow 톤 | `components/Card.tsx` 의 `HIGHLIGHT_CLASS` lookup |
| 사운드 추가 / 교체 | 파일을 `apps/web/public/assets/sounds/` 에 두고 `lib/sound.ts` 의 `SOUND_FILES` Record + `EventOverlay.tsx` 의 `EVENT_SOUND_MAP` |
| 새 룰 추가 | `packages/shared/src/rules/*.ts` + 동일 디렉토리에 `*.test.ts` 추가. `RuleTestPage` preset에도 추가 |
| 점수/배수 변경 | `packages/shared/src/scoring/multipliers.ts` (`calculateFinalScore`) |
| 결과 화면 디자인 변경 | `features/room/ResultView.tsx` 수정 후 `/result-demo` 라우트로 mock 빠른 검증 |
| 룰 동작 검증 (수동) | `/rule-test` 라우트, `features/rule-test/presets.ts` 에 시나리오 추가 |
| 카드 뒷면 이미지 | `apps/web/public/assets/cards/card-back.jpg` 교체 (CSS 변경 X) |
| 새 socket 이벤트 | `packages/shared/src/messages.ts` 타입 + `apps/server/src/socket/schemas.ts` zod + `handlers.ts` 핸들러 |
| 시각효과(EventOverlay) 추가 | `stores/eventOverlayStore.ts` 의 `GameEvent` union + `EventOverlay.tsx` 의 EMOJI/LABEL map + `EVENT_SOUND_MAP` |
| 룰 옵션 (방장 모달) | `packages/shared/src/types/rules.ts` 의 `RoomRules` + `RoomRulesModal.tsx` UI + 적용 지점 |
| turn timer 동작 | `apps/server/src/socket/turnFlow.ts` `scheduleAutoTurnTimer` |
| 카드 플레이 핵심 로직 | `apps/server/src/socket/turnFlow.ts` `playCardForPlayer` (handlers + autoTurn 공통) |

## 디버깅 팁

- **layout 디버그용 viewport 사이즈** (playwright):
  - PC 1280×720 / 모바일 가로 932×430 / 짧은 화면 800×360 / iPhone SE 667×375
- **변경 후 자동 검증 순서**: typecheck → playwright 캡처(모바일+PC) → 사용자 보고
- **DOM 사이즈 측정**: `mcp__playwright__browser_evaluate`로 `getBoundingClientRect()` 호출. 실제 element height 확인용
- **결과 화면 빠른 검토**: `/result-demo` (mock 카드들로 ended state 즉시 표시)
- **룰 동작 검증**: `/rule-test` 페이지 — preset 클릭 시 `executeTurn` 또는 `calculateFinalScore` 결과 panel 표시
- **playwright 5173 접속 실패**: server CORS_ORIGIN에 `127.0.0.1:5173`도 포함됨 → 둘 다 사용 가능. Vite가 5174로 fallback하면 좀비 프로세스 확인 (`Get-NetTCPConnection -LocalPort 5173`)

## 작업 컨벤션

- **한국어 답변 + 존댓말** (사용자 메모리에 명시)
- 변경 후 `pnpm --filter @gostop/web typecheck` 실행
- UI 변경은 playwright 캡처로 모바일(932×430) + PC(1280×720) 모두 확인
- 새 사이즈 값 도입 시 인라인 매직 넘버 X — `layoutConstants.ts`에 명명된 상수로
- 새 애니메이션 duration 도입 시 `animationTiming.ts`에 명명된 상수로
- 컴포넌트 자식 motion.div 안에 layoutId 카드가 있다면, **부모 motion은 transform-free** (opacity/scale 등 transform property 사용 금지) — layoutId 보간과 충돌
- 룰 변경 시 **shared rules + scoring 테스트 추가** + `/rule-test` preset 추가 + 클라/서버 양쪽 검증
- 카드 플레이 로직 변경 시 server `playCardForPlayer` + client 4-phase staging (`useMultiTurnSequence`) 양쪽 일관성 유지
- 큰 작업 끝나면 리팩토링 한 번 하고 다음 진행 (사용자 선호)
- `alert()` 사용 금지 — `toast.error/info/success/warning` 사용

## 알려진 함정

- **`HAND_CARD_MAX_WIDTH` cap이 결정자가 안 되는 경우**: heightBased(영역 height ÷ 1.63)가 더 작을 때. 카드를 진짜 키우려면 `HAND_AREA_RATIO`/`HAND_AREA_MAX` 조절
- **framer-motion `layoutId` 보간**이 부모 motion.div의 transform과 충돌. CenterField/MyHand의 카드 wrapper는 transform-free (opacity만)
- **CenterField 카드의 절대 위치**: inline `left/top` 픽셀로 직접 계산 (translate 회피)
- **Phase 3 floating overlay**: CenterField에서 `flippingCardId` 카드는 일반 매핑 opacity 0 + 별도 motion.div(layoutId 없음)로 그림
- **이모지 반응**: 우측 중앙 토글 버튼 → 모달 형태로 펼침. 떠오르는 이모지 효과는 모달과 별개
- **카드 뒷면**: 사용자가 직접 제공한 이미지(`/assets/cards/card-back.jpg`). `index.css`의 `.bg-card-back`이 background-image로 사용
- **채팅 socket join 타이밍**: 서버는 `socket.to(gameRoom).emit` (본인 제외) + 클라는 `chat:send` ack 성공 시 즉시 store에 push (optimistic update)
- **자뻑 vs 일반 회수**: `executeTurn`은 `stuckOwners[month]`와 `myActorKey` 옵션으로 자동 판정. `specials.isOwnRecover`가 true면 자뻑 → stealPi += 2
- **server hand 노출**: `buildRoomView`는 본인 player의 hand만 그대로 두고 다른 player hand는 `[]`로 마스킹
- **Case 3 뻑 후처리**: `executeTurn`에서 손패 매칭 + 더미 같은 월 placed 시 → 손패 단계 collected를 되돌리고 3장 stuck (정통 룰)
- **needsSelection 자동 발동**: server timer로 자동 카드 발동 시 (`isAuto=true`) `playCardForPlayer`가 needsSelection이면 첫 번째 후보 자동 선택 + 재실행
- **Vite 5173 점유 시 fallback**: 좀비 dev process가 5173 잡고 있으면 Vite가 자동으로 5174로 옮겨감. CORS_ORIGIN에 5174도 포함되어 있어 일시적으로 동작하지만 좀비 프로세스 종료 권장
- **server-side timer 메모리**: `room.turnTimerRef`는 setTimeout return — broadcast/직렬화 X. `buildRoomView`에서도 노출 X
- **consecutiveAutoTurns reset 시점**: `playCardForPlayer`에서 `isAuto=false`이면 0으로 reset, true면 +1. 사용자가 직접 카드 한 번 클릭하면 다음 turn은 원래 시간

## 상태 (2026-05-09 기준)

- ✅ 룰 엔진 100% 구현 (rules-final.md 기준) — 분배/시작점수/박/고배수/뻑/자뻑/따닥/쪽/총통/3뻑/나가리/마지막턴 싹쓸이 / **정통 매칭 룰 §1-6 (Image #20 표) 완전 적용**
- ✅ 5인 화상 (LiveKit Cloud 실제 통합) + **음성 전용 모드** (server token이 카메라 publish 권한 X로 강제)
- ✅ 광팔이 (자원/지정 메뉴 모두 지원), 방장 권한 (게임 중 룰 변경 차단), 방장 자동 위임, **1:1 AI 모드**, 텍스트 채팅, 도움말, 게임 히스토리, **server-side turn timer** (자동 5초 단축), EventOverlay 14개, RoomRules 모달 (모든 옵션 적용), PWA, 룰 테스트 페이지, **비밀방**, **방 목록 폴링**, **한 사용자 한 방 정책**, **로비 이전 방 복귀**, **테스트 모드** (손패 1장 분배), **게임 종료 후 대기실 복귀** (다음 판 시작 전 호스트 재조정), **룰 변경 알림 toast**, **대기실 disconnect 자동 제거**
- ✅ 옵션 룰: 9월 열끗 ↔ 쌍피 / 쇼당 / 조커 / 폭탄 보너스 카드 / 멍따
- ✅ ErrorBoundary + Toast 시스템
- ✅ AFK 표시 (30초+ 응답 없음)
- ✅ shared 테스트 114개 통과
- ✅ 정통 4-3-3 분배 시각화 stagger
- ❌ 외부 배포 안 됨 (Vercel/Railway)
- ✅ 솔로 모드 제거 — 1인 게임은 `/room/:id` 1인 + AI 봇 자동 합류로 통일. AI 봇 흔들기/폭탄 자동 적용은 server `startGameInRoom`이 처리

## 문서 참조 정책

- **매 작업 시**: 이 CLAUDE.md (자동 로드)
- **사이즈 작업 시**: [`apps/web/docs/layout-sizing.md`](apps/web/docs/layout-sizing.md)
- **새 세션 시작 시 1회만**: [`docs/ROADMAP3.md`](docs/ROADMAP3.md) — 다음 작업 / 추천 기능 / 빠른 참조. compact 시점마다 다시 읽을 필요 없음
- **룰 정의 / 미구현 룰**: [`docs/rules-final.md`](docs/rules-final.md) (정통 매칭 §1-6 표 포함), [`docs/rules-todo.md`](docs/rules-todo.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ROADMAP2.md`](docs/ROADMAP2.md)는 구버전 — 참고용
