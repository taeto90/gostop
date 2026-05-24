# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **루트 [`../../CLAUDE.md`](../../CLAUDE.md)** 에 프로젝트 전체 아키텍처, 룰 엔진, 클라이언트 구조, 작업 컨벤션이 있음. 이 파일은 **서버 패키지(`@gostop/server`)** 에 한정된 가이드.

## 명령어

```bash
# dev — .env 로드 + 포트 4000 점유 프로세스 자동 kill
pnpm dev              # == node scripts/kill-port.cjs 4000 && tsx watch --env-file=.env src/server.ts

# 타입체크
pnpm typecheck        # tsc --noEmit

# 프로덕션 실행 (Railway)
pnpm start            # tsx src/server.ts (.env 로드 X — 플랫폼 env 사용)
```

서버 단독 테스트 파일은 없음 — 룰 로직 테스트는 `packages/shared`에서 실행.

## 환경 변수 (.env)

| 변수 | 용도 | 필수 |
|---|---|---|
| `PORT` | Fastify 포트 (기본 4000) | N |
| `CORS_ORIGIN` | 쉼표 구분 origin 목록 | N (기본 localhost:5173) |
| `LIVEKIT_URL` | LiveKit Cloud 서버 URL | 화상/음성 사용 시 |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit 토큰 발급 | 화상/음성 사용 시 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | game_logs + error_logs DB | N (미설정 시 DB 로깅 비활성) |
| `NODE_ENV` | `production` 시: pino-pretty 비활성, /debug/rooms 숨김, 파일 로그 비활성, testMode 무시 | N |

## 아키텍처 (요청 흐름)

```
클라이언트 Socket.io emit
  → handlers.ts (이벤트 라우팅 + Zod 유효성)
    → turnFlow.ts (카드 플레이 핵심: playCardForPlayer)
      → @gostop/shared executeTurn (룰 엔진)
      → gameLogic.ts (stealPi, 광팔이 분배 등 부수효과)
      → aiTurn.ts (다음 턴이 AI면 자동 진행)
    → broadcast.ts → views.ts (플레이어별 시점 변환 후 emit)
    → gameLog.ts / errorLog.ts (로깅)
```

## 파일별 역할

| 파일 | 핵심 역할 | 변경 시 주의 |
|---|---|---|
| `server.ts` | Fastify + Socket.io 초기화, /health, LiveKit 토큰, 1분 cron 방 정리 | shutdown 핸들러에서 turnTimerRef 정리 안 함 (cron이 처리) |
| `config.ts` | env 로딩. CORS_ORIGIN은 쉼표 split | Railway Raw Editor로 설정 (UI 모드 TLD 잘림 버그) |
| `handlers.ts` | 모든 socket.on 등록 (1000줄+). room/game/chat/reaction 이벤트 | `evictUserFromOtherRooms`로 1인 1방 강제. `fail()` 헬퍼가 에러 시 자동 로깅 |
| `turnFlow.ts` | `playCardForPlayer` — 카드 플레이 + 점수 계산 + go/stop + 다음 턴 이동 | 가장 복잡한 파일. bonusPi stuck/recovery, needsSelection 자동 발동, consecutiveAutoTurns 관리 |
| `gameLogic.ts` | `startGameInRoom`, `fillWithAIBots`, `stealPi*`, `distributeGwangPali` | stuckOwners/stuckBonusPis 항상 쌍으로 초기화 |
| `aiTurn.ts` | AI 봇 자동 턴 (2.2s 딜레이 재귀). go/stop 정책 | `AI_TURN_DELAY_MS` env로 오버라이드 가능 |
| `broadcast.ts` | `broadcastRoomState` — 각 멤버에게 개별 view emit | socket room: `room:{id}`, `user:{userId}` |
| `views.ts` | `buildRoomView` — 타인 hand 마스킹, turnStartedAt 노출 | spectator는 현재 모든 hand 볼 수 있음 |
| `schemas.ts` | Zod 스키마: RoomCreate, GameAction (discriminated union), PresetId | 새 preset 추가 시 PresetIdSchema enum 갱신 필요 |
| `gameLog.ts` | 파일(dev) + Supabase(설정 시) 듀얼 로깅. 게임 종료 시 batch insert | `captureCounts` → 액션 → delta 검증 (card uniqueness, turn order, stealPi) |
| `errorLog.ts` | console + Supabase 즉시 insert (fire-and-forget) | 게임 외 시점 에러도 잡아야 하므로 buffer 없이 즉시 |
| `rooms/InMemoryRoomStore.ts` | Map 기반 in-memory 저장소. generateRoomId 충돌 재시도 | 서버 재시작 시 모든 상태 소실 (의도된 설계) |
| `rooms/playerOps.ts` | addPlayer/addSpectator/removeMember + 호스트 자동 위임 | removeMember가 빈 방 감지 → 삭제 반환 |
| `livekit/token.ts` | AccessToken 발급. voiceOnly면 카메라 publish 권한 X | 1시간 TTL |
| `lib/supabase.ts` | service_role Supabase 클라이언트 (세션 비활성) | URL+KEY 둘 다 없으면 null 반환 |

## 핵심 패턴

### 상태 변경 (in-place mutation)
Room/Player 객체를 직접 변경 — 불변성 강제 없음. broadcast 전 항상 mutation 완료 보장.

### Socket 콜백 규약
모든 이벤트 핸들러는 `cb({ ok: true, ... })` 또는 `cb({ ok: false, error: "메시지" })` 반환. `fail()` 헬퍼가 에러 경로에서 자동 `logServerError` 호출.

### Turn Timer
`room.turnTimerRef` = setTimeout ref. 직렬화/broadcast 불가 — `buildRoomView`에서 노출 X. 상태 전환(startGame, endGame, returnToLobby) 시 반드시 `clearTimeout`.

### playCardForPlayer 이중 호출 패턴
1. 사용자 카드 클릭 → `handlers.ts game:action` → `playCardForPlayer(io, room, store, userId, opts, false)`
2. Server timer 만료 → `autoPlayTurnNow` → `playCardForPlayer(..., true)` (isAuto=true → needsSelection 시 첫 번째 자동 선택)

### stuckOwners / stuckBonusPis 쌍
뻑 발생 시 `stuckOwners[month]`에 소유자 기록 + `stuckBonusPis[month]`에 끼인 보너스피 기록. 초기화 시 항상 둘 다 `= {}`.

## 알려진 함정

- **pnpm dev 병렬 시작**: web이 먼저 뜨고 server가 아직 안 뜨면 브라우저 console에 `ERR_CONNECTION_REFUSED` — 새로고침하면 해결
- **kill-port.cjs**: ESM 프로젝트에서 `.cjs` 확장자 필수 (`.js`면 `require` 에러)
- **tsx watch + --env-file**: tsx 4.x에서 `--env-file`은 Node.js 내장 기능 위임 — `.env` 파일 없으면 silent fail (에러 X, env 미로드)
- **pino-pretty는 devDependency**: production install에서 제외됨. `NODE_ENV=production`이면 자동으로 plain JSON 로거
- **room.turnTimerRef 메모리**: setTimeout return은 직렬화 불가 — JSON.stringify 시 누락됨. cron cleanup에서 수동 clearTimeout
- **CORS_ORIGIN 쉼표 구분**: `"http://a.com, http://b.com"` 형태. Railway UI 모드에서 `.app` TLD 잘림 버그 → Raw Editor 사용
