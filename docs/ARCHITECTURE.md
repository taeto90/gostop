# 아키텍처 (Architecture)

## 개요

GoStop은 **모노레포** 구조의 웹 애플리케이션으로, 한국 고스톱 게임에 5인 화상/음성 채팅 기능을 통합한 친구용 서비스입니다. 프론트엔드, 백엔드, 공유 라이브러리를 단일 저장소에서 관리하며, TypeScript 타입을 클라이언트와 서버가 공유하여 게임 상태 동기화의 안전성을 보장합니다.

## 디렉토리 구조

```
GoStop/
├── apps/
│   ├── web/                    # React 프론트엔드 (Vite)
│   │   ├── src/
│   │   │   ├── components/     # 재사용 UI 컴포넌트
│   │   │   ├── features/       # 도메인별 기능 (lobby, game, video)
│   │   │   ├── hooks/          # 커스텀 React 훅
│   │   │   ├── stores/         # Zustand 상태 저장소
│   │   │   ├── lib/            # 유틸 (socket client, livekit client)
│   │   │   ├── routes/         # 페이지 라우트
│   │   │   └── App.tsx
│   │   └── vite.config.ts
│   │
│   └── server/                 # Node.js 백엔드 (Fastify)
│       ├── src/
│       │   ├── server.ts       # 진입점
│       │   ├── config.ts       # 환경변수 로딩
│       │   ├── rooms/          # 방 관리 (Repository 패턴)
│       │   ├── socket/         # Socket.io 핸들러 + Zod 스키마
│       │   ├── livekit/        # LiveKit 토큰 발급
│       │   └── utils/          # 유틸 (ID 생성 등)
│       └── tsconfig.json
│
├── packages/
│   └── shared/                 # 클라이언트/서버 공유 코드
│       ├── src/
│       │   ├── types/          # Card, Player, Room, GameState, GameAction
│       │   ├── cards/          # 화투 48장 정의 (DECK)
│       │   ├── rules/          # 게임 룰 엔진 (Phase 1+)
│       │   └── scoring/        # 점수 계산 (Phase 1+)
│       └── tsconfig.json
│
├── docs/                       # 문서
├── .mcp.json                   # Claude Code MCP 서버 설정 (gitignored)
├── .gitignore
├── package.json                # 루트 (워크스페이스 매니페스트)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── tsconfig.base.json          # 모든 패키지가 상속하는 TS 베이스
```

## 기술 스택

### 프론트엔드

| 기술 | 버전 | 선택 이유 |
|------|------|----------|
| Vite | 7.x | 빠른 dev 서버, SPA에 최적, SSR 불필요 |
| React | 19.x | 최신 안정 버전, Concurrent Features |
| TypeScript | 5.x | 타입 안정성, 모노레포 친화적 |
| Tailwind CSS | 4.x | PostCSS 불필요, `@tailwindcss/vite` 플러그인 한 줄 |
| Zustand | 5.x | Redux보다 가볍고, 게임 상태에 적합 (Phase 2+) |
| React Router | 7.x | 페이지 라우팅 (Phase 2+) |
| Framer Motion | 12.x | 카드 애니메이션 (Phase 5) |
| LiveKit Client SDK | 2.x | 화상/음성 (Phase 3) |

### 백엔드

| 기술 | 버전 | 선택 이유 |
|------|------|----------|
| Node.js | 22+ | 최신 LTS, ESM/Top-level await 지원 |
| Fastify | 5.x | Express보다 2-3배 빠름, 스키마 검증 내장 |
| Socket.io | 4.x | 양방향 실시간 통신, 자동 재연결 |
| Zod | 3.x | 메시지 런타임 검증 + 타입 추론 |
| tsx | 4.x | TypeScript 직접 실행 (빌드 단계 생략) |
| pino | 9.x | 빠른 JSON 로거 (Fastify 기본) |

### 인프라/도구

| 기술 | 용도 |
|------|------|
| pnpm 10.x | 패키지 매니저 (workspace 지원) |
| LiveKit Cloud | SFU 미디어 서버 (무료 티어 50명) |
| Vitest | 단위/통합 테스트 (Phase 1+) |
| Playwright | E2E 테스트 (Phase 2+) |

## 핵심 설계 결정

### 1. 모노레포 (pnpm workspaces)

**왜?** 게임 상태 타입을 클라이언트와 서버가 공유해야 동기화 버그를 방지할 수 있습니다. 단일 저장소에서 `@gostop/shared` 패키지를 참조하면 타입 한 번 정의로 양쪽이 자동 일치합니다.

```typescript
// packages/shared/src/types/card.ts
export interface Card { id: string; month: Month; kind: CardKind; ... }

// apps/web 에서 사용
import type { Card } from '@gostop/shared';

// apps/server 에서 사용
import type { Card } from '@gostop/shared';
```

### 2. 서버 권위 모델 (Server-Authoritative)

게임 상태의 모든 변경은 서버에서 검증하고 결정합니다. 클라이언트는 액션을 제안할 뿐, 서버가 적용 여부를 결정해 모든 클라이언트에 결과를 브로드캐스트합니다.

```
[클라이언트] --액션 제안--> [서버: 검증/적용] --상태 변경 브로드캐스트--> [모든 클라이언트]
```

**왜?** 친구용이라도 클라이언트 상태를 신뢰하면 디버깅 시 동기화 깨짐 문제가 끊임없이 발생합니다. 서버 권위 모델은 이를 원천 차단합니다. 추후 상용 전환 시에도 기반이 그대로 유지됩니다.

### 3. Repository 패턴 (DB 교체 대비)

```typescript
// packages/server에서
interface RoomStore {
  create(opts): Room;
  get(id): Room | undefined;
  delete(id): boolean;
}

class InMemoryRoomStore implements RoomStore { ... }    // Phase 0-3
class SqliteRoomStore implements RoomStore { ... }       // Phase 4+ (필요 시)
```

서버는 인터페이스에만 의존하므로 DB 도입 시 1줄 교체로 끝납니다.

### 4. 게임 + 미디어 채널 분리

```
[웹] ←Socket.io→ [Game Server] : 게임 상태 동기화
[웹] ←WebRTC→ [LiveKit Cloud] : 화상/음성 (별도 인프라)
```

**왜?** 게임 트래픽(KB 단위)과 미디어 트래픽(MB 단위)은 특성이 완전히 다릅니다. 분리하면 게임 서버가 화상 부하에 영향받지 않고, 각자 최적의 인프라(Railway 무료 vs LiveKit Cloud)를 선택할 수 있습니다.

### 5. ESM Native 전환

`"type": "module"`로 모든 패키지가 ECMAScript Modules 사용. 모던 표준이며 `import.meta`, top-level await, named imports 등 신기능 활용 가능. CommonJS 호환은 하지 않음.

## 데이터 흐름

### 게임 진행 (예: 카드 내기)

```
1. [클라이언트] 사용자가 손패의 m05-yeol 카드 클릭
2. [클라이언트] socket.emit('game:action', { type: 'play-card', cardId: 'm05-yeol' })
3. [서버] Zod로 메시지 스키마 검증
4. [서버] RoomStore에서 방 가져오기, 현재 턴 검증
5. [서버] 룰 엔진으로 매칭 가능 여부 판정 (5월끼리)
6. [서버] 게임 상태 업데이트 (손패 → 딴패 이동, 바닥 변경)
7. [서버] io.to(roomId).emit('game:state', updatedState)
8. [모든 클라이언트] 새 상태 수신, Zustand 스토어 업데이트
9. [모든 클라이언트] React 리렌더링, Framer Motion 애니메이션 트리거
```

### 화상/음성 (LiveKit)

```
1. [클라이언트] 방 입장 시 서버에 토큰 요청 (HTTP POST /api/livekit/token)
2. [서버] livekit-server-sdk로 JWT 서명, 토큰 반환
3. [클라이언트] LiveKit React SDK로 LiveKit Cloud에 직접 연결
4. [LiveKit Cloud] SFU(Selective Forwarding Unit)가 5명의 비디오/오디오 라우팅
5. [클라이언트] <ParticipantTile />이 5명의 비디오 자동 표시
```

## 보안 고려사항

### 클라이언트 신뢰 금지
- 모든 게임 액션은 서버에서 재검증
- 패의 정보는 서버만 알고, 자기 손패만 클라이언트에 전송
- 다른 플레이어의 손패는 카드 수만 전송 (`{ count: 7 }`)

### API 키 관리
- `.mcp.json`, `.env` 모두 `.gitignore` 처리
- 프론트엔드에는 LiveKit URL만 노출, API 키/시크릿은 서버 전용
- 토큰 만료 시간 설정 (1시간 권장)

### CORS
- Fastify의 `@fastify/cors`로 허용 origin 명시
- 개발: `http://localhost:5173`만 허용
- 프로덕션: 실제 도메인만 허용

## 확장 전략

### 단일 인스턴스 한계
- Node.js 단일 인스턴스로 ~1000명 동시 처리 가능 (인메모리 상태)
- 20명/4방 시나리오는 매우 여유로움

### 멀티 인스턴스 전환 시 (필요 시점)
1. Redis로 상태 공유 (Pub/Sub for socket.io)
2. SQLite → PostgreSQL (다중 클라이언트)
3. Sticky session (로드밸런서)
4. LiveKit은 SaaS라 그대로 사용 가능

상용 전환 또는 100명 이상 동시 접속 시점이 되면 검토.
