# 진행 로드맵 (Roadmap)

## 현재 진척도

```
사전 셋업    ▓▓▓▓▓▓▓▓▓▓ 100%  ✅
Phase 0     ▓▓▓▓▓▓▓▓▓▓ 100%  ✅ (인프라)
Phase 1     ░░░░░░░░░░   0%  ⏳ 진행 중
Phase 2     ░░░░░░░░░░   0%
Phase 3     ░░░░░░░░░░   0%
Phase 4     ░░░░░░░░░░   0%
Phase 5     ░░░░░░░░░░   0%
```

**최종 갱신**: 2026-05-02

---

## ✅ 완료된 단계

### 사전 셋업

| 작업 | 상태 | 산출물 |
|------|------|--------|
| MCP 서버 5개 셋업 | ✅ | sequential-thinking, magic, context7, playwright, reactbits |
| `.gitignore` | ✅ | API 키 보호, node_modules, dist, .env 등 제외 |
| 메모리 저장 | ✅ | 다음 세션 컨텍스트 유지 (project_overview, tech_stack, security, feature_scope, asset_strategy) |

### Phase 0 — 모노레포 인프라

#### Step 1: 루트 셋업 ✅
- `package.json`: 워크스페이스 매니페스트, prettier 설정
- `pnpm-workspace.yaml`: `apps/*`, `packages/*` 등록
- `tsconfig.base.json`: strict 모드, ES2022, Bundler resolution
- `.npmrc`: pnpm 옵션
- pnpm 10.26.2 + Node 22.16.0 환경 검증

#### Step 2: `packages/shared` ✅
- 화투 48장 정의 (`DECK`)
- 카드 분포 런타임 검증: 광 5 / 열끗 9 / 띠 10 / 피 24 / 쌍피 3 / 고도리 3 / 비광 1
- 타입 정의:
  - `Card`, `Month`, `CardKind`, `DdiKind`
  - `Player`, `PlayerFlags`
  - `Room`, `Spectator`, `GameState`, `GamePhase`
  - `GameAction` (discriminated union)
- 유틸: `createShuffledDeck(rng)`, `getCardById(id)`

#### Step 3: `apps/web` (Vite + React 19 + Tailwind v4) ✅
- Vite 7 + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite` 플러그인)
- `@gostop/shared` 워크스페이스 의존성 작동 확인
- "Hello GoStop" 페이지로 카드 분포 시각화
- 빌드 검증: 198KB (gzip 62KB), 757ms
- Playwright로 실제 렌더링 + 스크린샷 검증
- 다크 테마 + 반응형 그리드

#### Step 4: `apps/server` (Fastify + Socket.io) ✅
- Fastify 5 + Socket.io 4 + Zod 3
- pino-pretty 컬러 로그
- `GET /health`: 헬스체크 + 방 카운트 + uptime
- `POST /api/livekit/token`: 토큰 발급 (Phase 3 placeholder)
- Repository 패턴: `RoomStore` 인터페이스 + `InMemoryRoomStore` 구현
- Socket.io 핸들러 스켈레톤 (ping:check 동작)
- `generateRoomId()`: 6자, 헷갈리는 0/O/I/1 제외
- 포트 4000으로 검증 완료 (3001은 Docker 충돌 회피)
- Graceful shutdown (SIGINT/SIGTERM)

---

## ⏳ 다음 단계

### Phase 1 — 게임 룰 코어 (예상 1-2주)

`packages/shared`에 룰 엔진을 추가하여 클라이언트와 서버 모두 동일한 룰을 사용합니다.

#### Step 1.1: 테스트 환경 셋업
- Vitest 도입 (`packages/shared`)
- 첫 테스트 작성: `DECK` 무결성 검증

#### Step 1.2: 카드 매칭 로직 (`rules/matching.ts`)
- 같은 월끼리 매칭 규칙
- `findMatches(field, card)`: 바닥에서 매칭 가능한 카드 찾기
- `applyMatch(state, action)`: 매칭 적용 결과
- 단위 테스트

#### Step 1.3: 기본 점수 계산 (`scoring/basic.ts`)
- 광 / 띠 / 열끗 / 피 점수 계산
- 단(홍단/청단/초단) 보너스
- 고도리 / 비광 처리
- 쌍피 카운트
- 단위 테스트 (각 시나리오)

#### Step 1.4: 게임 상태 머신 (`rules/game.ts`)
- 카드 분배 (서로 7장, 바닥 6장, 더미 28장)
- 턴 진행
- 게임 종료 조건 (7점 도달 시 고/스톱)
- 액션 검증 (`canPlayCard`, `canDeclareGo` 등)
- 단위 테스트

#### Step 1.5: 디버그 UI
- 단일 화면 2인 게임 (로컬, AI 없이 클릭으로 진행)
- 룰 엔진 시각적 검증용
- Tier 1 기능: 가능한 카드 하이라이트

**Phase 1 완료 기준**: 단일 PC에서 2명이 번갈아 클릭하여 1판 끝까지 정상 진행, 점수 정확히 계산됨, 모든 단위 테스트 통과.

---

### Phase 2 — 멀티플레이어 (예상 1주)

#### Step 2.1: Socket.io 클라이언트 통합
- `apps/web/src/lib/socket.ts`: 연결 관리
- `useSocket()` 커스텀 훅
- 서버 health 체크 + 연결 상태 UI

#### Step 2.2: 방 시스템
- 로비 화면: 방 만들기 / 입장
- 친구 초대 링크 (`/room/ABC123`) — Tier 1
- QR 코드 생성 — Tier 1
- 닉네임 + 이모지 아바타 입력 — Tier 1

#### Step 2.3: 서버 권위 게임 상태
- 액션 검증 → 상태 적용 → 브로드캐스트
- 다른 플레이어 손패는 카드 수만 노출
- 관전자에게도 동기화

#### Step 2.4: 재연결 처리 — Tier 1
- 클라이언트 자동 재연결 (Socket.io 기본 + 커스텀 로직)
- 5초 이상 끊김 시 다른 플레이어에게 표시
- 게임 상태 복구 (서버에서 push)

**Phase 2 완료 기준**: 3명이 다른 컴퓨터에서 접속, 1판 정상 진행, 한 명 새로고침 후 자동 복구.

---

### Phase 3 — 화상/음성 (예상 1주)

#### Step 3.1: LiveKit 셋업
- LiveKit Cloud 계정 생성
- API 키/시크릿 환경변수 설정
- 서버에 `livekit-server-sdk` 추가
- 토큰 발급 엔드포인트 실제 구현

#### Step 3.2: 클라이언트 LiveKit 통합
- `@livekit/components-react` 설치
- 방 입장 시 LiveKit Room 자동 연결
- 5인 비디오 그리드 UI
- 음성/카메라 토글 버튼

#### Step 3.3: 관전자 모드
- 관전자도 LiveKit Room 입장 (영상 publish 가능)
- 게임 액션은 못함 (UI에서 숨김)
- 게임 상태는 보임 (read-only)

#### Step 3.4: 영상 UI 다듬기 — Tier 2
- 말하는 사람 강조 (LiveKit 음성 감지 활용)
- 음성 파형 표시
- 영상 5인 띠 형태 (게임 화면 위 고정)

**Phase 3 완료 기준**: 5명이 화상채팅하며 게임 진행, 관전자도 음성 참여 가능.

---

### Phase 4 — 보너스 룰 (예상 1-2주)

#### Step 4.1: 특수 매칭 룰
- 따닥 (같은 월 2장 동시 매칭)
- 쪽 (손패 + 더미 매칭)
- 뻑 (같은 월 3장 동시) + 카드 선택 모달
- 자뻑

#### Step 4.2: 흔들기 / 폭탄
- 흔들기 (같은 월 3장 손패) → 점수 ×2
- 폭탄 (같은 월 4장 손패) → 점수 ×2 + 피 빼앗기

#### Step 4.3: 박 시스템
- 피박 / 광박 / 멍박 / 고박
- 점수 2배 처리
- 시각적 강조 — Tier 1

#### Step 4.4: 고/스톱 결정
- 7점 도달 모달
- 고 누적 배수 (1고 × 1, 2고 × 2, 3고 × 3...)
- 고박 처리

#### Step 4.5: 점수 자동 계산 + 분해 시각화 — Tier 1
- 게임 끝날 때 점수 내역 풀어서 표시
- "광 3장 = 3점, 띠 6장 = 2점, 피박 ×2 = 16점" 식 분해

#### Step 4.6: 누적 점수 (여러 판) — Tier 1
- 세션 단위로 점수 누적
- 5판 정도 후 최종 정산

#### Step 4.7: 룰 변형 토글 — Tier 2
- 시작 점수 (3점/7점)
- 국준 처리 (쌍피/광)
- 흔들기 룰 (×2 / 점수만)
- 멍따 인정 여부

**Phase 4 완료 기준**: 모든 보너스 룰 정상 작동, 점수 계산 정확, 변형 룰 옵션 동작.

---

### Phase 5 — 폴리시 (예상 미정)

#### Step 5.1: 카드 디자인
- 화투 카드 이미지 적용 (사용자 제공 또는 임시 placeholder)
- 카드 컴포넌트 추상화 (옵션 A 일러스트 / 옵션 B 미니멀 텍스트)

#### Step 5.2: 애니메이션
- Framer Motion으로 카드 뒤집기, 이동, 매칭 효과
- 점수 획득 애니메이션
- 박/고스톱 시 화면 효과

#### Step 5.3: 사운드
- Howler.js로 효과음 재생
- 카드 놓기, 점수, 고/스톱 외침
- 배경 음악 (옵션)

#### Step 5.4: 차별점 기능 — Tier 2
- 이모지 반응 (영상 위 떠오름) ⭐
- 게임 통계 보드 (광부/호구/도박꾼/평화주의자) ⭐
- 관전자 사이드 베팅

#### Step 5.5: 모바일 반응형
- 영상 스트립 4명 (모바일에서 작아도 OK)
- 손패 가로 스크롤
- 터치 인터랙션 최적화

#### Step 5.6: Tier 3 기능 (시간 여유)
- AI 대전 모드 (3단계 난이도)
- 리플레이 시스템
- 게임 일시정지 / AFK 처리
- 모바일 화면 꺼짐 방지 (Wake Lock)
- 음성 인식 "고!"/"스톱!"

**Phase 5 완료 기준**: 친구들이 즐겁게 1시간 이상 플레이할 수 있는 완성도.

---

## 배포 일정

| 시점 | 환경 | 비고 |
|------|------|------|
| Phase 0-2 종료 | 로컬만 | 외부 노출 없음 |
| Phase 3 종료 | 시범 배포 (Vercel + Railway) | 친구 1-2명과 테스트 |
| Phase 4 종료 | 정식 배포 (도메인 연결) | 친구 그룹에 공식 공개 |
| Phase 5 진행 중 | 정식 배포 (지속 업데이트) | 사용자 피드백 반영 |

---

## 일정 추정 (1인 개발)

| Phase | 예상 기간 | 누적 |
|-------|----------|------|
| Phase 0 | ✅ 완료 | - |
| Phase 1 | 1-2주 | ~2주 |
| Phase 2 | 1주 | ~3주 |
| Phase 3 | 1주 | ~4주 |
| Phase 4 | 1-2주 | ~6주 |
| Phase 5 | 미정 | ~8주+ |

**MVP 정식 배포까지: 약 6주**

집중도, 학습 곡선, 변경 요구에 따라 변동 가능.
