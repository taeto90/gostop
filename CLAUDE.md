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
pnpm --filter @gostop/shared test                                          # 전체 (122개)
pnpm --filter @gostop/shared exec vitest run src/rules/matching.test.ts    # 단일 파일

pnpm build
pnpm clean
```

`lint` 스크립트는 root에 정의되어 있으나 sub-package에 실제 스크립트 없음 (ESLint 미설정).

## 라우트

- `/` — 로비 (`features/lobby/Lobby.tsx`) — 프로필 카드 + 방 만들기 카드 + 이전 방 복귀 카드 + 방 목록 (5초 폴링) + 비밀방 모달
- `/room/:id` — 게임 (`features/room/RoomScreen.tsx`) — 1인이면 server가 AI 봇 1명 자동 합류 (1:1 맞고)
- `/result-demo` — 결과 화면 디자인 검토용 (mock 데이터)
- `/rule-test` — 룰 검증 페이지 (30개 preset 시나리오)
- `/login` — Google OAuth 로그인 (미인증 시 자동 리다이렉트)
- `/admin` — 관리자 페이지 (에러 로그/게임 로그/유저 관리, admin_users 테이블 기반 접근 제한)

## 아키텍처

### 모노레포 (pnpm workspace)

```
apps/web        Vite 7 + React 19 + Tailwind v4 (클라이언트, PWA)
apps/server     Fastify 5 + Socket.io 4 + Zod (서버)
packages/shared 룰 엔진 + 타입 (클라/서버 공유)
```

### 공유 룰 엔진 (`packages/shared`)

클라이언트와 서버가 **동일한 룰을** 사용하도록 강제하는 핵심. `src/index.ts`에서 export:

- `cards/` — `DECK` (48장), `createShuffledDeck`, `getCardById`, `createBombCard`, `createJokerCard`, `createBonusPiCard`, `awardBombBonusCards`
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
                 PasswordPromptModal, PasswordInput
  room/          GameView (phase 'waiting' 포함 모든 단계, testMode 배너),
                 RoomScreen (voiceOnly = view.rules.mediaMode === 'voice-only' 도출 후 LiveKit으로 전달),
                 ResultView, ResultDemoView,
                 RoomLobbyModal (대기실 컨트롤 — phase='waiting' 오버레이,
                                 멤버 그리드 + 시작 + AI 봇 + 본인 관전자 + 광팔이 + RoomSettingsBar),
                 LobbyMemberCard (드래그&드롭 + 클릭 메뉴 — 강퇴/위임/관전자/광팔이 지정),
                 AISetupModal (봇 인원 + 봇별 난이도, RoomLobbyModal에서 호출),
                 RoomRulesModal (mediaMode 옵션 포함),
                 useEndedSnapshot (ResultView snapshot/dismiss hook),
                 GameSettingsActions (호스트 룰 / 비밀번호 토글),
                 game-ui/* (CenterField, MyHand,
                 GameHeader — PC 상단 바 (로고/방#/인원/목표점수/나가리배수/방설정/나가기),
                 OpponentSlot — 분리 패널 2개(정보/딴패) + waiting 호스트 메뉴 popover + 점수 클릭 ScoreDetailModal + fake-hand absolute(비행 source),
                 CollectedGroupsRow — 상대 딴패 그룹 렌더러 (라벨 상단, 광끗띠5장·피10점/줄, 50% 겹침),
                 OpponentCollectedOverlay — 모바일 상대 딴패 접이식 오버레이,
                 RightSidebar — PC 우측 통합 (타일+참여자+채팅+접기 토글),
                 CompactHeader, MobileCollected, ShakeBombModal, TargetPickerModal, ScoreDetailModal),
                 result/ (helpers, Badges)
  livekit/       LiveKitGameRoom (voiceOnly prop → token fetch + initialVideo false),
                 MediaTilesPanel (PC 사이드바 2열 타일 + 확대 모달 — voiceOnly는 아바타+useIsSpeaking 하이라이트),
                 VideoMobileModal (voiceOnly 헤더 라벨 분기),
                 VideoTile, MediaSettings, MediaToggleButtons (voiceOnly 시 카메라 토글 hide),
                 FitTile, _shared/
  rule-test/     RuleTestPage + presets.ts + ResultPanel
  debug-game/    개발용 디버그 도구 + GameDemoView (/game-demo — DEV 전용 GameView mock 데모)
components/      Card (`isBomb`/`isJoker` SpecialCard 분기), EventOverlay,
                 ChatPanel, HelpModal, HistoryModal, SettingsModal,
                 EmojiReactions(EmojiFloatLayer+EmojiPickerButton), AnimatedNumber,
                 TurnIndicator, InviteLink, CollectedStrip,
                 ErrorBoundary (App 최상위 wrap), ToastContainer,
                 PasswordToggle (공개/비공개 토글 — RoomSettingsBar + GameSettingsActions 공유)
hooks/           useElementSize, useRoomSocket, useAfkDetect,
                 useAnyTurnCountdown (server timestamp 기반 모든 player turn 카운트),
                 useMultiPlayCard (멀티 emit + needsSelection 모달),
                 useMultiSpecialsTrigger, useMultiTurnSequence (stagedView staging),
                 useKeyboardShortcuts, useWakeLock, useTabRecorder (dev 탭 녹화)
lib/             layoutConstants, animationTiming, animationContext, sound,
                 socket, livekit, dealingPattern (정통 4-3-3 stagger)
stores/          zustand: sessionStore, roomStore, chatStore, eventOverlayStore,
                 gameHistoryStore, devTestStore, toastStore, authStore
```

### 서버 (`apps/server/src`)

```
server.ts          Fastify entry, /health, LiveKit 토큰 endpoint
config.ts          env 로딩 (CORS_ORIGIN array 지원, LIVEKIT_API_KEY/SECRET 등)
rooms/             InMemoryRoomStore (Repository 패턴) + playerOps
socket/
  handlers.ts      모든 socket.on 라우팅 (room/game/chat/광팔이/9yeol/list)
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

- **방장 권한** — `Room.hostUserId`. 핸들러: `room:kick`, `room:transfer-host`, `room:return-to-lobby`, `room:update-rules`. 클라에서 host만 컨트롤 노출. **게임 중(playing) 룰 변경 차단** — 단 비밀번호는 게임 중에도 변경 가능
- **다중 로그인 차단** — 같은 userId로 새 소켓 연결 시 이전 소켓 강제 disconnect + "다른 기기에서 로그인" 에러 emit
- **한 사용자 한 방 정책** — `room:create`/`join`/`rejoin` 직전 `evictUserFromOtherRooms` 호출. 다른 방의 phase='waiting'/'ended'면 자동 정리, phase='playing'이면 거부 ("다른 방에서 게임 진행 중. 먼저 나가주세요")
- **이전 방 복귀** — 로비 mount 시 `room:my-current` 조회. 응답에 방 있으면 `LobbyResumeCard` 노출 → 클릭 시 RoomScreen 자동 rejoin
- **leave guard** (`lib/leftRoomGuard.ts`) — "나가기" 버튼 누른 직후 60초 grace 동안 같은 roomId로 자동 재진입 차단. 뒤로 가기/HMR/URL 직접 입력으로 인한 좀비 멤버십 방지. lobby에서 명시적 입장(방 카드/LobbyResumeCard/방 만들기) 시 flag 제거
- **게임 종료 → 대기실 복귀** — ResultView "🎮 게임으로" → `room:return-to-lobby` (호스트만). phase='ended' → 'waiting' reset, room.game=null, 광팔이 spectator → player 복귀, AI 봇/룰/`nagariMultiplier` 보존. 호스트가 다시 `game:start` 누르면 다음 판 (nagari 누적 그대로)
- **방 룰 모달** (`RoomRulesModal`) — `RoomRules` (winScore 3/5/7, allowMyungttadak, turnTimeLimitSec 0/30/40/50/60/90, jokerCount 0~3장, **bonusPiTwoCount 0~2장**, **bonusPiThreeCount 0~1장**, allowGukJoon, shakeBonusType, **mediaMode 'video'/'voice-only'** 등). 모두 코드 적용됨
- **음성 전용 모드** — `RoomRules.mediaMode='voice-only'` (기본값). 대기실 `RoomSettingsBar`에서 토글. 서버 LiveKit token 발급 시 `canPublishSources=[MICROPHONE]`로 video publish 권한 X. 클라는 `voiceOnly` prop으로 카메라 토글 hide + initial video 강제 false
- **방 만들기 1-step** — 로비에서 즉시 기본값으로 방 생성 → RoomLobbyModal. 비밀번호/미디어모드는 대기실 `RoomSettingsBar`에서 설정
- **비밀방 게임 중 변경** — 방장이 설정 메뉴(⚙️)에서 비밀번호 토글 가능 (`PasswordToggle` 공통 컴포넌트). `room:update-rules`에서 비밀번호만 변경은 phase='playing'에서도 허용
- **URL 비밀방 접속** — `/room/:id` 직접 접속 시 비밀방이면 `PasswordPromptModal` 표시 (에러 메시지 "비밀" 감지)
- **점수 상세 모달** — 상대 OpponentSlot 점수 클릭 → `ScoreDetailModal` (광/고도리/끗/띠/단/피 + 배수 사유)
- **룰 변경 broadcast** — `room:update-rules` 시 변경된 키 diff를 모든 멤버에게 `room:rules-changed` event broadcast. 클라 `useRoomSocket`이 toast 표시 ("⚙️ 호스트가 룰 변경 — 시작 점수 3점")
- **대기실 disconnect 자동 제거** — phase='waiting'/'ended'에서 disconnect 시 10초 grace 후 `removeMember` 자동. phase='playing'은 기존대로 connected=false 유지 (rejoin 가능). 호스트면 `removeMember`가 다음 player/spectator로 자동 위임
- **비밀방** — `Room.password` (4~20자, optional). `RoomCreateSchema` + 입장 시 검증. 멤버 rejoin은 비번 재확인 X. 로비 `room:list`에 `hasPassword` flag만 노출 (비번 자체 X)
- **광팔이** (4~5명) — 자원자 → 호스트 지정 → 마지막 입장자 자동. 광팔이는 spectator로(`isGwangPali=true`), 다음 판에 player 복귀. 의도적 spectator(`isGwangPali=false`)는 그대로
- **1인 자동 AI 모드** — 방에 1명만 있으면 서버가 **AI 봇 1명 자동 합류 (1:1 맞고)**, `progressAITurnIfAny`로 턴 자동 진행. 사람 합류 시 봇 제거. 모든 상대가 AI면 turn timer 비활성 (사용자 자유 진행)
- **server-side turn timer** — `scheduleAutoTurnTimer`가 `room.turnTimerRef`로 setTimeout 예약. 사용자가 브라우저 닫아도 server가 자동 카드. AI 봇 turn에는 X. `consecutiveAutoTurns >= 2`인 player는 다음 turn부터 5초로 단축 (직접 카드 클릭 시 0으로 reset)
- **사용자 선택 모달 (정통 매칭 룰 §1-6)** — 매칭 카드 종류 다른 2장 시 모달. server `needsSelection` 응답 → 클라 모달 → 재emit
- **텍스트 채팅** — `chat:send`/`chat:received`. server는 `socket.to(gameRoom).emit` (본인 제외 broadcast). 클라는 ack 성공 시 즉시 store에 push (optimistic update). 50개 제한 + unread count
- **EventOverlay** — 풀스크린 emoji + label, 2.2초. 이벤트 (뻑/첫뻑/자뻑/따닥/쪽/싹쓸이/폭탄/흔들기/총통/고/스톱/박/멍따/나가리/게임종료). `EVENT_SOUND_MAP`으로 사운드 매핑. `useMultiSpecialsTrigger`가 `view.turnSeq` 변경 감지 시 자동 발화
- **AFK 표시** — `useAfkDetect`. turnUserId 변경 후 30초+ 응답 없으면 닉네임 옆 💤 (클라 단독, broadcast X)
- **9월 열끗 ↔ 쌍피 변환** — `Player.flags.nineYeolAsSsangPi` + `game:toggle-9yeol` 이벤트. `calculateScore({nineYeolAsSsangPi})` 옵션
- **조커 카드** — `RoomRules.jokerCount` 0~3장. 셔플에 추가. 매칭 X. **보너스피와 동일** — collected에 쌍피 가치 직행 + 더미 일반패 손패 보충 + 턴 유지. **유일한 차이: 조커는 상대 피 빼앗기 X** (`bonusPiCollected` 미증가)
- **보너스피 (투피/쓰리피)** — `RoomRules.bonusPiTwoCount` 0~2장 + `bonusPiThreeCount` 0~1장. 셔플 추가. 매칭 X. 점수: 투피 `isSsangPi=true`(2장 가치), 쓰리피 `bonusPiValue=3`(+3 가치).
  - **손에서 낼 때 (사용자 변형 룰, `drawnToHand`)**: 딴패 직행(바닥 경유 X) + 상대 피 뺏기 + 더미 1장 **손패로 보충**(상대는 마스킹으로 모름) + **턴 유지**(손패 보충됐으니 한 번 더 냄). 체인 중 보너스피/조커는 딴패로, 최종 일반 패만 손패로. `game.ts`의 `if (handCard.isBonusPi || handCard.isJoker)` 분기에서 `specials.drawnToHand=true` set (조커도 동일, 상대 피 뺏기만 X).
  - **더미에서 뒤집힐 때**: 점수판 직행 + 더미 1장 추가 뒤집기 체인 (`drawSkippingBonus` helper).
  - **stealPi**: 가져간 보너스피 **총 개수**(손+더미 체인 누적)만큼 모든 상대 각각으로부터 피 1장씩. `stealPiOneFromEachOpponent` 함수 사용
  - **뻑 stuck**: 뻑 발생한 턴에 끼인 보너스피는 점수판 X → `room.stuckBonusPis[month]`에 stuck. 회수자가 함께 가져감 + 추가 stealPi = 보너스피 수 + 1
  - **턴 유지**: server `turnFlow.ts`/`aiTurn.ts`의 `playedHandRefill` 판정 (`reachedWin`/`ended` 우선). **조커도 보너스피와 동일하게 턴 유지 + 손패 보충** (2026-06-03 통일, 차이는 steal뿐)
  - 시각: `Card.tsx` emerald 그라데이션 SpecialCard. 손패 플레이는 전용 무음 시퀀스(`runBonusPiSequence`, 아래 4-phase 섹션 참고). 테스트 시나리오 3개 (`bonus-pi-hand`, `bonus-pi-draw`, `bonus-pi-ppeok-stuck`)
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

⚠️ **broadcast 큐**: `pendingQueueRef`(배열)로 빠른 연속 broadcast(폭탄 보너스 카드 / 보너스피 턴 유지 등 같은 player 연속 진행) 순서대로 처리. 단일 슬롯이면 중간 turn 손실되어 애니메이션 스킵됨.

### 보너스피 전용 시퀀스 (`runBonusPiSequence`, 4-phase 미사용)

손에서 보너스피 낼 때(`lastTurnSpecials.drawnToHand`)는 4-phase 대신 전용 **무음** 시퀀스: 손패 확대 → `DELAY_BONUS_PI_SHORT`(0.5s) → 보너스피 딴패 비행 → 0.5s → 상대 피 뺏기 비행 → `DELAY_BONUS_PI_STEP`(1s) → 더미 카드 손패 보충. 중간 view는 `revertStealPi`/`buildBonusPiBeforeDraw`(`phaseViews.ts`)로 단계 분리. '착' 사운드 X.

### 정통 4-3-3 분배 시각화 (`lib/dealingPattern.ts`)

`handDealDelay(i, total)` / `fieldDealDelay(i, total)`:
- 3인 (손패 7 / 바닥 6): 4장 → 바닥 3장 → 3장 → 바닥 3장
- 2인 (손패 10 / 바닥 8): 5장 → 바닥 4장 → 5장 → 바닥 4장

MyHand + CenterField 첫 mount 카드만 적용. 새 카드(더미 뒤집기)는 zero delay.

### 반응형 레이아웃

`COMPACT_BREAKPOINT = 950px`. **PC/모바일 모두 2026-06 시니어 친화 개편 적용.**

**겹침 규칙 (공통)**: 딴패 카드는 **50% 겹침 고정** — 폭 부족 시 비율 유지한 채 카드 자동 축소.

PC (≥ 950px):
- grid: cols `auto(내 딴패 312px) minmax(0,1fr) auto(사이드바)`, rows `auto(헤더) auto(상대) minmax(0,1fr)(게임판) ${handMin}px(손패)`
- row1 `GameHeader` (로고·방#·인원·목표점수·나가리배수 / 방설정·나가기·설정)
- row2 상대 `OpponentSlot` (col1~2, **h-186px + 분리 패널 2개** — 정보 felt-950 / 딴패 felt-900, 턴이면 amber. 3인은 `dense`로 프로필 축소):
  - 정보 패널: 이름 / 점수(大)+카드뒷면 ×N장+배수+⏱ / **고 배지 줄** — `justify-evenly`로 여백 분배
  - 딴패 패널: `CollectedGroupsRow` — 라벨 상단 chip, **광/끗/띠 5장·피 10점(가치)/줄**, `c=(폭−3·gap)/14.5`로 카드 크기 산출(상한 42), **3줄 이상 아래로 넘침**(overflow-visible)
  - **fake-hand 카드는 absolute 오버레이** — 상대 카드 비행 source라 제거 금지
- col1 row3~4 **내 딴패 패널** (`MobileCollected` `showTotal=false`, 카드 53px·10장/줄, 하단까지 확장) / **내 점수+N고+×배수는 게임판 우하단** absolute 클러스터
- col2 row3 `CenterField` (felt-600→800 radial 배경층) / col2 row4 손패(felt-950/85) + "내 차례입니다" pill
- col3 `RightSidebar` (row2~4): `MediaTilesPanel`(2열 타일, voiceOnly는 아바타+`useIsSpeaking` 하이라이트) + 참여자 + 채팅(`ChatInlinePanel`, 헤더에 😊 `EmojiPickerButton`). 전체 접기 토글(localStorage)

모바일 (< 950px):
- grid: cols `196px(내 딴패) 1fr`, rows `auto(CompactHeader) minmax(0,1fr) ${handMin}px`
- 내 딴패: PC와 같은 라벨-위 구조 (카드 30px·10장/줄, 총점은 게임판 우하단 클러스터)
- **상대 딴패: 접이식 오버레이** (`OpponentCollectedOverlay`, 기본 접힘) — 헤더 아래 `🃏 상대 딴패` 토글 → 게임 위 겹침. 윗줄 광/끗/띠 + 아랫줄 피, 3인은 좌우 동시
- 바닥/더미 카드 = 손패와 동일(52px, `HAND_CARD_GAP=11`). 손패 키우려면 `HAND_AREA_RATIO.mobile` (heightBased 결정자)
- 화상(🎙️)/채팅(💬) 버튼: 바닥패 컨테이너 내부 absolute — 높이 1/3·2/3 지점. 이모지 피커는 채팅 모달 헤더

고/스톱은 버튼 없이 `GoStopModal` 유지. 이모지: `EmojiFloatLayer`(효과, 항상 mount) + `EmojiPickerButton`(피커 — PC 사이드바/모바일 채팅 모달 헤더). 딴패 분류는 `lib/collectedGroups.ts`의 `groupCollected`(국준 9월 이동 포함). 색 위계: 게임판(밝은 radial) > 딴패 패널(felt-900) > 정보·손패 패널(felt-950) > 헤더/사이드바(felt-900→950 그라데이션).

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
| 게임 화면 UI 변경 (PC/모바일) | `GameHeader`/`OpponentSlot`/`CollectedGroupsRow`/`RightSidebar`/`OpponentCollectedOverlay` 수정 후 **`/game-demo`** (DEV 전용, 인증 불필요 — App.tsx 게이트 앞 분기)로 mock 검증. 2인/3인 토글 내장, 모바일은 932×430 리사이즈 |
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

## 행동 지침 (LLM 코딩 원칙)

일반적인 LLM 코딩 실수를 줄이기 위한 행동 지침. 트레이드오프: 속도보다 조심하는 쪽으로 편향됨. 사소한 일에는 판단력 사용.

### 1. 코딩 전에 생각하기

가정하지 마. 혼란을 숨기지 마. 표면적인 트레이드오프.

실행 전:
- 가정을 명확히 하세요. 확실하지 않으면 물어보세요.
- 여러 해석이 존재한다면 제시하세요 — 조용히 선택하지 마세요.
- 더 간단한 방법이 있다면 그렇게 말하세요. 정당할 때 반박하세요.
- 불분명한 부분이 있으면 그만두세요. 무엇이 헷갈리는지 말하고 물어보세요.

### 2. 단순함 우선

문제를 해결하는 최소한의 코드. 추측할 만한 내용은 없음.

- 요청된 것 외에는 특징 없음.
- 일회용 코드에 대한 추상화 금지.
- 요청되지 않은 '유연성'이나 '구성 가능성' 금지.
- 불가능한 상황에 대한 오류 처리 금지.
- 200줄을 썼는데 50줄일 수도 있다면, 다시 쓰세요.
- 스스로에게 물어보세요: "선임 엔지니어가 이게 너무 복잡하다고 말할까?" 그렇다면 단순화하세요.

### 3. 외과적 변화

만져야 할 것만 만져라. 오직 네 엉망진창만 치워.

기존 코드를 편집할 때:
- 인접 코드, 주석, 서식을 '개선'하지 마세요.
- 고장 나지 않은 것들은 리팩토링하지 마세요.
- 기존 스타일을 맞추세요, 설령 다르게 하더라도.
- 관련 없는 죽은 코드를 발견하면 꼭 **언급**하세요 — 삭제하지 마세요.

변경이 고아를 만들 때:
- 변경으로 인해 사용되지 않은 가져오기/변수/함수를 제거하세요.
- 요청하지 않는 한 기존 죽은 코드를 제거하지 마세요.
- 테스트: 변경된 모든 라인은 사용자의 요청으로 직접 추적되어야 함.

### 4. 목표 중심 실행

성공 기준을 정의하세요. 검증될 때까지 루프를 반복하세요.

작업을 검증 가능한 목표로 전환:
- "검증 추가" → "잘못된 입력에 대해 테스트를 작성하고, 통과시키기"
- "버그를 고치기" → "이를 재현하는 테스트를 작성하고 통과시키기"
- "리팩터 X" → "시험 전후 통과 보장"

다단계 작업은 간단한 계획 제시:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

강력한 성공 기준은 독립적 루프를 가능하게 함. 약한 기준("작동하게 만들기")은 끊임없는 명확한 설명 필요.

이 지침들은 다음 조건에서 효과적: 불필요한 차이점 변경이 적고, 과도한 복잡성으로 인한 재작성이 적으며, 실수 이후가 아니라 **구현 전에** 명확한 질문이 먼저 나오는 경우.

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
- **PWA dev SW**: `vite-plugin-pwa` `devOptions: { enabled: false }`. dev에서 SW가 HMR과 충돌해 `Uncaught SyntaxError: Unexpected token '<'` (HTML이 JSON으로 fetch됨) 일으킴. Chrome 확장도 같은 증상 가능 — incognito 권장
- **Railway lockfile mismatch**: `tsx`처럼 dev → dependencies로 옮길 때 `pnpm-lock.yaml` 갱신 안 하면 `ERR_PNPM_OUTDATED_LOCKFILE`. 항상 `pnpm install` → lock 커밋
- **Railway env Raw Editor**: UI 모드에서 `.app` 같은 TLD가 잘리는 버그 — 길거나 특수문자 env는 Raw Editor 모드 사용
- **AnimatePresence + functional component**: PlayerGrid/SpectatorGrid의 AnimatePresence가 functional component child의 unmount 감지 못함 → plain map으로 대체
- **ChoiceModal trigger 시점**: `useEndedSnapshot.triggerChoice`는 자동 useEffect로 발동 X — GameView가 `displayView.phase==='ended' && animationPhase==='idle'`일 때 `onEndedReady` 콜백으로 호출. server `phase='ended'` broadcast가 즉시 와도 Phase 4 staging 끝나야 모달 뜸 (마지막 카드 비행 끊김 차단). RoomScreen은 `case 'ended'`에서도 `!dismissed`이면 GameView mount 유지
- **preset drawTop 위치 검토**: test preset의 `drawTop[i]`가 turn i+1에 더미로 뽑힘. 9월 검증 시나리오에서 `drawTop[1]=m09-pi`면 player2 turn에 같은 월 더미 → 의도치 않은 뻑(Case 3) 발동. test 시나리오 작성 시 각 위치가 어떤 turn에 어떤 동작 일으키는지 검증 필수
- **CollectedStrip/CollectedGroups nineYeolAsSsangPi**: 9월 끗 분류는 `c.kind`가 아니라 player flag 기반. m09-yeol을 'yeol'/'pi' 어느 그룹으로 시각화할지는 그 player의 `flags.nineYeolAsSsangPi`로 결정. OpponentSlot은 `player.flags?.nineYeolAsSsangPi` 전달, ResultView는 `RankedPlayer.nineYeolAsSsangPi` 노출
- **pendingGoStop turn 이동 차단**: server `turnFlow.playCardForPlayer`가 winScore 도달 시 turn 이동 X + `room.pendingGoStop` set. 같은 player가 `declare-go`(다음 turn) / `declare-stop`(phase='ended') 결정해야 진행. AI는 `shouldAIGo(player, room, difficulty)` 함수로 난이도별 판단 (easy=STOP, medium=매칭+손패, hard=상대점수)
- **game 로그 dev only**: `apps/server/src/socket/gameLog.ts`의 **파일 로그**는 `NODE_ENV !== 'production'`일 때만. **Supabase DB 로그**는 env 설정 시 dev/prod 모두 활성. `logs/` 디렉토리는 `.gitignore`에 포함
- **gotrue-js 시계 차이**: Supabase implicit flow에서 `detectSessionInUrl: true`면 1초 차이에도 `issued in the future` 에러 → `detectSessionInUrl: false` + 수동 `parseHashTokens()` + `setSession()` 패턴 사용
- **PowerShell 커밋 메시지**: 한글+특수문자 포함 시 here-string(`@'...'@`) 사용 필수. 큰따옴표 안 한글은 깨질 수 있음
- **Vercel env vs Railway env**: Vercel은 `VITE_` 접두사 (브라우저용 anon key), Railway는 접두사 없음 (서버용 service_role key). 두 키는 용도/권한이 다름

## 인증 (Google OAuth + Supabase Auth)

- **로그인 흐름**: LoginPage → `signInWithOAuth('google')` → Supabase → Google → 리다이렉트 → `#access_token` 해시 수동 파싱 → `setSession`
- **세션 관리**: `authStore.ts`가 Supabase session/user/dbProfile 관리. `sessionStore.ts`는 기존 코드 호환용 wrapper (authStore에서 동기화)
- **Socket JWT**: 연결 시 `auth: { token }` 전달 → 서버 `io.use()` 미들웨어에서 `supabaseAdmin.auth.getUser(token)` 검증 → `socket.data.userId` 설정
- **Supabase 클라이언트**: `flowType: 'implicit'`, `detectSessionInUrl: false` — gotrue-js 시계 차이 문제 우회 (수동 해시 파싱)
- **DB 테이블**: `profiles` (id, nickname, emoji_avatar, email + RLS 본인만), `admin_users` (id + RLS 본인 select), `game_logs` (RLS deny + service_role만 insert, admin select)
- **handlers.ts userId**: `socket.data.userId ?? parsed.data.userId` — JWT 미들웨어가 설정한 값 우선 (위조 방지)

## 배포 (2026-05-24 기준)

- **Web**: https://gostop-eight.vercel.app/ — Vercel SPA. `vercel.json`에 `pnpm --filter @gostop/web build` → `apps/web/dist`
- **Server**: https://gostopserver-production.up.railway.app/ — Railway NIXPACKS. `railway.json`에 `pnpm install --frozen-lockfile` + `pnpm --filter @gostop/server start`. 1분 cron으로 stale 방 자동 정리. `/debug/rooms`는 `NODE_ENV !== 'production'`일 때만 노출
- **DB**: Supabase Postgres (`profiles` + `admin_users` + `game_history` + `game_logs` 테이블, auth.uid() 기반 RLS). `apps/web/src/lib/supabase.ts`가 URL/KEY 없으면 null 반환. Google OAuth 인증 필수
- **Auth**: Supabase Auth Google provider. Site URL=`https://gostop-eight.vercel.app`, Redirect URLs에 localhost:5173 포함. Railway에 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 필수 (JWT 검증 + 로그 저장)
- **PWA**: `display: 'fullscreen'`, `display_override: ['fullscreen','standalone']`, `orientation: 'landscape'`. `apps/web/src/lib/pwa.ts`의 `isPwaMode()` / `isMobileTouch()` / `tryLockLandscape()` (Screen Orientation API)
- **CORS_ORIGIN**: Railway env Raw Editor 모드로 설정 (UI 모드 truncation 회피)

## leftRoomGuard

`apps/web/src/lib/leftRoomGuard.ts` — `markRoomLeft(roomId)` / `clearLeftRoomGuard()` / `wasRecentlyLeft(roomId)` (60초 grace, sessionStorage 기반). RoomScreen이 leave 직후 HMR/Browse-back으로 remount되어 자동 rejoin loop에 빠지지 않도록.

## AnimationPhaseContext + EventOverlay 발화

`apps/web/src/contexts/AnimationPhaseContext.tsx` — `'idle' | 'phase1' | 'phase2' | 'phase3' | 'phase4'`. `useMultiTurnSequence`가 phase state 관리하며 context로 child에 노출.

`useMultiSpecialsTrigger(view, phase)` — `phase === 'idle'`일 때만 fire. 손패 클릭 직후가 아닌 4-phase 완료 후 EventOverlay 노출. `GameView`가 `displayView` (정적 view) + `animationPhase`를 trigger에 전달.

⚠️ 모션 duration은 `apps/web/src/lib/animationTiming.ts`에서 관리. Phase 2→3 대기 `DELAY_AFTER_HAND` (0.75s), Phase 3→4 대기 `DELAY_AFTER_FLIP` (1.0s). devTestStore speed multiplier로 테스트 모드에서 ÷0.5~÷2 조정.

## player 순서 드래그앤드롭 (호스트, 대기실)

`'room:reorder-players'` 이벤트. `LobbyMemberCard`에 `onDropTarget` / `isDropHover` / `onDragOverTarget` / `onDragLeaveTarget` props. `RoomLobbyModal.reorderPlayers(draggedId, targetId)` — splice insert. 게임 시작 시 `players[0]`이 첫 turn.

## 테스트 모드 v2 (preset 시나리오)

`packages/shared/src/rules/presets.ts` — 30개 preset 시나리오 정의. `dealNewGame({ testMode: true, preset })` → `dealWithPreset`이 명시 카드 위치 고정 + 나머지 셔플 분배. **게임 로직 변경 X — 분배 단계만**. 같은 월 4장 모두 명시한 시나리오는 봇 손패/바닥에 들어가지 않음 보장.

**Socket 이벤트**:
- `game:start { testMode, testPreset }` — 테스트 모드 + preset 선택
- `game:set-test-preset { preset }` — 게임 중 시나리오 변경 (호스트, testMode 한정) → 즉시 재시작
- `game:test-restart` — 같은 시나리오 다시 (호스트, testMode 한정) → 즉시 재시작
- `game:apply-shake-bomb { shakeMonths, applyBomb }` — 게임 시작 직후 본인 흔들기/폭탄 적용 선언

**`room.gameInstanceId`** — 매 `startGameInRoom` 호출마다 +1. RoomView에 broadcast. 클라가 새 게임 인스턴스 식별 (turnSeq=0 reset만으로는 같은 시나리오 다시 시 변화 감지 불가).

**`window.__view`** dev 디버그 — GameView mount 시 RoomView 자동 노출. 콘솔에서 `__view.players[0].flags` 등 직접 검사.

## 누적 배수 (게임 중 표시)

`apps/web/src/lib/multiplierUtils.ts` — `computeMultiplier(p)` / `multiplierBreakdown(p)` 공통 helper.

`packages/shared/src/scoring/multipliers.ts` 공식:
- 흔들기 ×2 누적, 폭탄 ×2 누적
- 고: 1·2고 ×1, 3고 ×2, 4고 ×4, 5고 ×8 ... (`2^(goCount-2)`)
- 박은 종료 시점 결정이라 게임 중 X (결과 화면에서)

**표시 위치**:
- 본인: CenterField 영역 좌측 하단 (PC `text-5xl`, 모바일 `text-3xl`) — `GameView`가 absolute 배치
- 상대: OpponentSlot 점수 옆 작은 amber 배지

## 흔들기/폭탄 모달 (rules-final.md §6)

`apps/web/src/hooks/useShakeBombDetection.ts` — 게임 시작 직후 본인 손패 분석 + `ShakeBombModal` 컨트롤. `gameInstanceId` 변화 시 dismissed reset.

`apps/web/src/hooks/useShakeBombFireTrigger.ts` — 어떤 player든 flags 변화 시 EventOverlay 'shake'/'bomb' 발화. **본인 모달 응답 대기 중(`myShakeBombPending=true`)엔 발화 보류** — 봇 자동 적용 broadcast로 본인 응답 전 발화되는 혼란 방지.

`gameLogic.ts:startGameInRoom`이 AI 봇은 자동 적용, 사람은 모달 응답까지 대기 (정통 룰 — 흔들기는 본인 옵션).

## 9월 카드 (정통 한국 룰)

9월 4장 = 끗(m09-yeol) + 청단(m09-ddi) + 피1(m09-pi) + 피2(m09-ssangpi).
**별도 쌍피 카드 X** — 끗이 쌍피 역할 (옵션 `nineYeolAsSsangPi`). `m09-ssangpi` ID는 legacy 호환용 일반 피.
끗 획득 시 `NineYeolPickerModal`이 자동 mount → 사용자가 끗/쌍피 자리 선택 → `game:toggle-9yeol` emit.
`MobileCollected`가 옵션 따라 m09-yeol을 yeol 자리 또는 pi 자리로 시각 이동.

## 4-phase broadcast 큐잉

`useMultiTurnSequence` — view 변화 시 sequence 진행 중이면 `pendingViewRef`에 저장, 끝나면 자동 처리. 빠른 연속 broadcast (본인 turn → 봇 turn)도 화면 점프 없이 순차 재생. 의존성 `[view]` (객체 자체) — flags/preset/gameInstanceId 등 모든 변화 감지.

testMode에서 phase별 console.log 자동 출력 (`[turnSeq=N 🟢본인=alice] Phase 1-A 시작...`).

모바일은 native HTML5 touch DnD 미지원 → 카드 클릭 메뉴로 대체.

## 상태 (2026-05-25 기준)

- ✅ 룰 엔진 100% 구현 (rules-final.md 기준) — 분배/시작점수/박/고배수/뻑/자뻑/따닥/쪽/총통/3뻑/나가리/마지막턴 싹쓸이 / **정통 매칭 룰 §1-6 (Image #20 표) 완전 적용**
- ✅ 5인 화상 (LiveKit Cloud 실제 통합) + **음성 전용 모드** (server token이 카메라 publish 권한 X로 강제)
- ✅ 광팔이 (자원/지정 메뉴 모두 지원), 방장 권한 (게임 중 룰 변경 차단), 방장 자동 위임, **1:1 AI 모드**, 텍스트 채팅, 도움말, 게임 히스토리, **server-side turn timer** (자동 5초 단축), EventOverlay, RoomRules 모달 (모든 옵션 적용), PWA, 룰 테스트 페이지, **비밀방**, **방 목록 폴링**, **한 사용자 한 방 정책**, **로비 이전 방 복귀**, **테스트 모드** (preset 시나리오 + 속도 슬라이더), **게임 종료 후 대기실 복귀**, **룰 변경 알림 toast**, **대기실 disconnect 자동 제거**
- ✅ 옵션 룰: 9월 열끗 ↔ 쌍피 / 조커(보너스피와 동일, steal만 X) / 폭탄 보너스 카드 / 멍따 / **보너스피(투피/쓰리피)**
- ✅ **Go/Stop 시스템** — `pendingGoStop` server state + `GoStopModal`. 본인 turn 끝 winScore 도달 → turn 이동 X + 모달. **고 조건**: 첫 고 winScore 도달, **2고+는 직전 고 점수보다 1점 이상**(`flags.lastGoScore`, `turnFlow.ts`의 `goThreshold`). AI는 `shouldAIGo(player, room, difficulty)` 난이도별 판단
- ✅ **결과 화면 모달화** — ResultView가 `fixed inset-0` + GameView가 backdrop. 종료 직후 `[대기하기/통계보기]` ChoiceModal → 통계보기 선택해야 ResultView. `useEndedSnapshot.triggerChoice`가 GameView `animationPhase==='idle'`일 때만 발화
- ✅ **본인/상대 N고 + 점수 위치 개선** — 본인 CenterField 좌하단에 `{N}고` rose 배지 + `×배수`. OpponentSlot은 점수를 collected 왼쪽 box로 이동 + 카드 수 배지. MobileCollected 라벨 우측에 카드 수 (점수는 하단 총점)
- ✅ **흔들기/폭탄 모달 [취소]** — 모달 cancel 시 emit X, 손패 그대로 → 다른 카드 선택 가능. NineYeolPickerModal은 본인 turn + lastTurnActorUserId 일치 시만 발화 (상대 turn 오발화 차단)
- ✅ **매칭 손패 강조** — amber ring(70%) + drop-shadow + `-translate-y-1.5` + brightness/saturate. pulse 1.6s, glow 16px/5px
- ✅ **일반 게임 속도 ×2** — `animationTiming.ts` base duration ÷2 (HAND_PEAK 0.15 / FLY 0.3 / FLIP 0.3 / SCALE_PEAK 0.5 / FLY_TO_COLLECTED 1.0 / INTER_PHASE 0.75 / COLLECT_STAGGER 0.15). devTestStore speed multiplier로 ÷0.5~÷2 추가 조정 (테스트 모드만)
- ✅ **winScore default 3 → 7점** (정통 1:1 룰)
- ✅ **게임 로그 시스템** — `apps/server/src/socket/gameLog.ts`. 매 액션 + 자동 검증 (orderValid/cardCheck.duplicates/stealValid/piDelta).
  - **파일 로그**: dev only (`NODE_ENV !== 'production'`), `logs/game-*.json` 매 액션 append
  - **Supabase game_logs**: env 설정 시 dev/prod 모두 활성, **게임 종료 시 batch insert** (메모리 buffer)
- ✅ **에러 로그 시스템** — `apps/server/src/socket/errorLog.ts` + `apps/web/src/lib/errorReport.ts`
  - server `game:action` 핸들러의 모든 `cb({ ok: false, error })`는 `logServerError` 자동 호출 — game_logs(type='error')에 즉시 insert
  - 클라 `ErrorBoundary` catch + `toast.error()` 모두 자동 `client:error` socket emit (dedup 3초)
  - source 필드로 발생 위치 식별 (`server:game:action` / `client:ErrorBoundary` / `client:toast.error` 등)
- ✅ **테스트모드 production 노출** — 호스트면 항상 표시 (DEV gate 제거)
- ✅ ErrorBoundary + Toast 시스템
- ✅ AFK 표시 (30초+ 응답 없음)
- ✅ shared 테스트 122개 통과
- ✅ 정통 4-3-3 분배 시각화 stagger
- ✅ Vercel + Railway + Supabase 배포 완료 — 외부 친구 접속 가능
- ✅ 솔로 모드 제거 — 1인 게임은 `/room/:id` 1인 + AI 봇 자동 합류로 통일
- ✅ leftRoomGuard로 leave 후 자동 rejoin loop 차단
- ✅ stale 방 자동 정리 cron (1분 주기)
- ✅ EventOverlay phase-gated (4-phase 완료 후 발화)
- ✅ player 순서 드래그앤드롭 (호스트, 대기실 PC만)
- ✅ **Google OAuth 로그인** — Supabase Auth, 프로필 설정 페이지, Socket JWT 검증 미들웨어
- ✅ **Admin 페이지** (`/admin`) — 에러 로그/게임 로그/유저 관리. admin_users 테이블 기반 접근 제한
- ✅ **보너스피(투피/쓰리피)** — 룰 엔진 + 서버 + UI + steal + ppeok stuck
- ✅ **채팅 사이드 패널** (PC 드래그 리사이즈) + Shift+Enter 줄바꿈 + 모바일 키보드 fix
- ✅ **Rate limiting** — chat 5/1s, room:create 5/1m, game:action 10/1s, reaction 5/2s
- ✅ **키보드 단축키** — 1~9 손패, G/S 고스톱, C 채팅
- ✅ **Wake Lock** — 게임 중 모바일 화면 꺼짐 방지
- ✅ **AI go/stop 난이도별 정책** — easy=STOP, medium=매칭+손패4+, hard=상대점수 고려
- ✅ **게임 로그 자동 검증** — dev only console.warn (orderValid/duplicates/stealValid)
- ✅ **다중 로그인 차단** — 같은 userId 새 소켓 연결 시 이전 소켓 강제 disconnect
- ✅ **방 만들기 1-step** — CreateRoomModal 삭제, 즉시 생성 + RoomSettingsBar 인라인 설정
- ✅ **비밀방 게임 중 변경** — 방장 설정 메뉴에서 비밀번호 토글 (PasswordToggle 공통 컴포넌트)
- ✅ **URL 비밀방 접속** — RoomScreen에서 비밀방 에러 감지 → PasswordPromptModal 표시
- ✅ **점수 상세 모달** — 상대 점수 클릭 → ScoreDetailModal (광/끗/띠/피 breakdown + 배수 사유)
- ✅ **상대 STOP EventOverlay** — 상대 스톱 시 overlay + toast + 2.5초 후 ChoiceModal
- ✅ **게임종료 모달 타이밍** — sequenceBusy로 4-phase 완료 후에만 ChoiceModal 발화
- ✅ **탭 녹화** — dev + testMode에서 MediaRecorder API로 .webm 다운로드
- ✅ **Phase 3→4 딜레이** — DELAY_AFTER_HAND (0.75s) + DELAY_AFTER_FLIP (1.0s) 분리
- 🟡 **남은 작업**: 카카오 OAuth / 본인인증 / 이용약관 / 등급분류 / 다국어 / 카드 테마 — [`docs/ROADMAP66.md`](docs/ROADMAP66.md) 참고

## 문서 참조 정책

- **매 작업 시**: 이 CLAUDE.md (자동 로드)
- **사이즈 작업 시**: [`apps/web/docs/layout-sizing.md`](apps/web/docs/layout-sizing.md)
- **새 세션 시작 시 1회만**: [`docs/ROADMAP66.md`](docs/ROADMAP66.md) — 다음 작업 / 우선순위 / 추천 기능 (최신). compact 시점마다 다시 읽을 필요 없음
- **룰 정의 / 미구현 룰**: [`docs/rules-final.md`](docs/rules-final.md) (정통 매칭 §1-6 표 포함, 테스트 모드 v2 preset 시나리오 설계 기준), [`docs/rules-todo.md`](docs/rules-todo.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ROADMAP2.md`](docs/ROADMAP2.md), [`docs/ROADMAP3.md`](docs/ROADMAP3.md), [`docs/ROADMAP4.md`](docs/ROADMAP4.md), [`docs/ROADMAP5.md`](docs/ROADMAP5.md)는 구버전 — 참고용
