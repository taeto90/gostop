# GoStop 로드맵 v4 — 상업 배포 전환

**최종 갱신**: 2026-05-06
**이전**: [`ROADMAP3.md`](./ROADMAP3.md) (친구 MVP 완성 시점)

> ⚠️ **방향 전환**: 친구용 비공개 MVP → **상업 배포 (동시접속 50~100명)**. 이에 따라 PROJECT.md의 "비목표(상용 서비스)" 항목이 무효화되며, 사행성 규제 / 인증 / DB / 결제 등 새로운 영역이 추가됩니다.

---

## 1. 상업화 시 핵심 변경점 — 한국 게임산업법

> **반드시 변호사 자문 후 진행**. 아래는 일반적 가이드라인이며 법적 효력 없음.

### 한국 게임산업법 — 화투/고스톱은 사행성 게임으로 분류
- **현금/현금성 재화 베팅 절대 금지** (가짜 코인도 환전 가능하면 불법)
- **게임물관리위원회 등급분류 필수** — 청소년이용불가 (18세 이상) 등급
- **웹보드 게임 규제** 적용 시:
  - 1일 손실한도 제한 (가짜 머니 기준)
  - 1회 베팅한도 제한
  - **본인인증 의무** (성인 인증)
  - 24시간 접속 제한 (자동 일시정지)
  - 자동/대리 게임 차단

### 권장 노선
1. **순수 가상 점수 + 환전 X** — 현재처럼 점수만, 가짜 머니/포인트도 도입 X
2. **만 18세 이상 가입 제한** — OAuth로 본인인증 (카카오/네이버 인증 활용)
3. **이용약관 + 개인정보처리방침** 작성 (변호사 자문)
4. **게임물관리위원회 등급분류** 신청 (수수료 ~수십만원, 2~4주)
5. **광고 모델만 수익화** — 직접 결제는 사행성 의심 우려 (또는 비기능 결제: 카드 디자인 / 아바타)

---

## 2. 음성 전용 모드 구현 방법

### 핵심: LiveKit은 audio/video 분리 가능
LiveKit Cloud는 트랙 단위로 publish 제어 가능. 클라이언트가 video track을 publish 안 하면 음성만 송수신.

### 구현 단계

#### 2-1. RoomRules에 미디어 모드 추가
```ts
// packages/shared/src/types/rules.ts
export type MediaMode = 'video' | 'audio-only';

export interface RoomRules {
  // ... 기존 필드 ...
  mediaMode: MediaMode;  // default 'video'
}
```

#### 2-2. WaitingRoom의 RoomRulesModal에 토글
```tsx
<RuleSection title="🎙 미디어 모드">
  <ChoiceRow
    options={['video', 'audio-only'] as const}
    value={rules.mediaMode}
    onPick={(v) => update('mediaMode', v)}
    format={(v) => (v === 'video' ? '📹 화상' : '🎙 음성만')}
  />
</RuleSection>
```

#### 2-3. LiveKit 클라 설정
`apps/web/src/features/livekit/LiveKitGameRoom.tsx`:
```ts
const isAudioOnly = view.rules?.mediaMode === 'audio-only';

<LiveKitRoom
  video={!isAudioOnly}  // video 자동 publish 끔
  audio={true}
  // ...
/>
```

#### 2-4. UI 컴포넌트 분기 — 음성 전용 사이드바
- `VideoSidebar` 대신 `AudioSidebar` 새 컴포넌트
  - 참가자 이름 + 이모지 아바타
  - **말하는 사람 강조** (LiveKit `useParticipantTracks` + `isSpeaking`)
  - 음성 파형 (LiveKit `<BarVisualizer>` 컴포넌트 내장)
  - 본인 mute 토글 (마이크만)
- 화상 모드는 기존 VideoSidebar 그대로
- GameView에서 `view.rules?.mediaMode`로 분기 렌더링

#### 2-5. 비용 절감 효과
- LiveKit 무료 한도: 50명 × 1만분
- 음성만이면 대역폭 ~1/10 → 동일 분 사용 시 비용도 약 1/10
- 100명 active + 음성만이면 무료 안에서 운영 가능성 높음

#### 2-6. 추가 고려
- **호스트 변경 시 미디어 모드 전환** — 게임 중에는 잠금 (혼란 방지)
- **참가자별 비디오 toggle** — 음성 전용 모드에서도 본인만 비디오 켜는 옵션? (단순화: X)
- **푸시-투-토크 (PTT)** — 음성 모드에서 평소 mute, 누르고 말하기. (선택 기능)

---

## 3. 미구현 / 수정 / 추가 필요 기능 (배포 제외)

### Tier 1 (배포 전 필수)

| # | 항목 | 설명 |
|---|---|---|
| 1 | **DB 도입** (Postgres) | InMemoryRoomStore → 영구 저장. 사용자/방/통계/히스토리 |
| 2 | **사용자 영구 식별** | 익명 sessionStore → DB users 테이블 + JWT 세션 |
| 3 | **OAuth 로그인** | 카카오/네이버/Google. **버튼만 임시 → 본격 OAuth로 단계적** |
| 4 | **방 자동 정리** | 빈 방 30분 후 자동 삭제 (메모리 누수 방지) |
| 5 | **솔로 모드 제거** | `/solo` 라우트 → 멀티 1인 = 1:1 AI 통일 |
| 6 | **음성 전용 모드** | §2 |
| 7 | **에러 모니터링** | Sentry 또는 GlitchTip (오픈소스) |
| 8 | **이용약관/개인정보처리방침** | 페이지 + 가입 시 동의 체크 |
| 9 | **본인인증** | 카카오 인증 (성인 확인) |
| 10 | **rate limiting** | socket.io 메시지 + REST API spam 방지 |

### Tier 2 (배포 후 점진적)

| # | 항목 | 설명 |
|---|---|---|
| 11 | 게임 히스토리 서버 저장 | 현재 localStorage만 — 사용자별 영구 저장 |
| 12 | 글로벌 통계 / 리더보드 | 일/주/월 우승률, 광박/멍박 횟수 등 |
| 13 | 친구 목록 / 즐겨찾기 | 자주 같이 노는 사람 추가 |
| 14 | 게임 리플레이 저장 | 액션 히스토리 DB 저장 + 재생 |
| 15 | 알림 (Web Push) | 친구가 방 만들면 알림 (PWA 활용) |
| 16 | 모바일 화면 꺼짐 방지 | Wake Lock API |
| 17 | 다국어 (i18n) | 한국어 + 영어 (외국인 친구) |
| 18 | 카드 디자인 테마 | 다크/라이트, 카드 뒷면 종류 |
| 19 | AI 캐릭터성 | 봇별 닉네임/성격/말투 |
| 20 | 키보드 단축키 | 1~7 손패, Space 매칭, G/S 고/스톱 |

### Tier 3 (선택)

| # | 항목 | 설명 |
|---|---|---|
| 21 | 음성 인식 "고/스톱" | Web Speech API |
| 22 | 스트리머 모드 | 닉네임/방ID 가리기 |
| 23 | 배경음악 | 차분한 BGM (룰 모달에서 토글) |
| 24 | 대결 모드 / 토너먼트 | 점수 누적 라운드 |
| 25 | 룰 변형 (지역별) | 전라도/경상도 룰 차이 등 |

### 알려진 수정 필요 사항

| # | 항목 | 우선순위 |
|---|---|---|
| 26 | RoomRules `addPoint` 흔들기 코드 적용 (현재 multiplier만) | Low |
| 27 | 멀티 4-phase 솔로와 완전 동등 검증 | Medium |
| 28 | server-side timer + LiveKit 권한 만료 (1시간) 충돌 | Medium |
| 29 | InMemoryRoomStore — server crash 시 모든 게임 손실 | High (DB 도입으로 해결) |
| 30 | 자동 카드 시 needsSelection 첫 번째 자동 선택 — 항상 최선이 아님 | Low |

---

## 4. OAuth 로그인 — 단계적 구현

### 4-1. 현재 (즉시)
- 로비에 **"게스트로 시작" 버튼** — 클릭 시 sessionStore에 익명 userId(`uuid`) + 닉네임(랜덤) 부여
- 기존 ProfileForm 그대로 유지 — 닉네임 + 이모지만 받기
- `_DEV_LOGIN` 플래그로 dev에서만 동작

### 4-2. OAuth 도입 시점 (배포 직전)
**우선순위**:
1. **카카오** — 한국 시장 1순위, 본인인증 같이 받음
2. **Google** — 외국인 / 부가
3. (나중) 네이버, 애플

**라이브러리**:
- Vite SPA + Fastify 환경 → 직접 OAuth flow 구현 권장
  - 클라: `kakao-js-sdk` 또는 `react-kakao-login`
  - 서버: kakao access_token → user info → JWT 발급
- 또는 [Lucia Auth](https://lucia-auth.com/) (Fastify 호환)
- ❌ NextAuth.js는 Next.js 전용

**DB 스키마**:
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY,
  oauth_provider  VARCHAR(20) NOT NULL,  -- 'kakao', 'google'
  oauth_sub       VARCHAR(255) NOT NULL, -- provider 측 user id
  nickname        VARCHAR(20) NOT NULL,
  emoji_avatar    VARCHAR(8) NOT NULL,
  is_adult        BOOLEAN DEFAULT FALSE, -- 카카오 인증 결과
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ,
  UNIQUE (oauth_provider, oauth_sub)
);

CREATE TABLE game_history (
  id              UUID PRIMARY KEY,
  room_id         VARCHAR(6),
  ended_at        TIMESTAMPTZ,
  players         JSONB,  -- [{userId, nickname, finalScore, isWinner}]
  flags           JSONB,  -- {chongtong, ppeoksCausedWin, ...}
  duration_sec    INTEGER
);

CREATE TABLE game_history_players (
  history_id      UUID REFERENCES game_history,
  user_id         UUID REFERENCES users,
  final_score     INTEGER,
  is_winner       BOOLEAN,
  PRIMARY KEY (history_id, user_id)
);

CREATE INDEX idx_history_players_user ON game_history_players(user_id);
```

### 4-3. 세션 관리
- **JWT** httpOnly cookie (XSS 방지)
- Refresh token rotation
- 만료: access 1시간 / refresh 30일

---

## 5. 배포 — 상업 운영 가이드 (50~100명 동시)

### 결론
**기존 ROADMAP3 / DEPLOYMENT.md 계획 골격 유지 + DB 추가**. Vercel + Railway는 50~100명에 충분하며, 100명 이상 활성 시 LiveKit 유료 전환만 검토.

### 인프라 비교

| 컴포넌트 | 추천 | 비용 (월) | 대안 |
|---|---|---|---|
| **프론트** | Vercel Pro | $20 (or 무료) | Cloudflare Pages |
| **백엔드** | Railway Pro | $20 + 사용량 | Fly.io, Render |
| **DB (Postgres)** | **Supabase Pro** | $25 | Railway Postgres ($5+), Neon |
| **Redis** (선택) | Upstash | $0~10 | 안 쓸 수도 (단일 인스턴스라면) |
| **미디어** | LiveKit Cloud | $0~50 | 셀프 호스팅 (Fly.io $10) |
| **모니터링** | Sentry | $0~26 | GlitchTip 셀프호스팅 |
| **도메인** | Cloudflare | $1/월 | Namecheap |
| **에셋 CDN** | Vercel 자동 | 포함 | Cloudflare R2 |
| **합계** | | **약 $50~150/월** | (트래픽에 따라) |

### DB 세팅

#### 5-1. Postgres 추천: **Supabase**
- 자동 백업 (point-in-time recovery)
- Connection pooling (PgBouncer 내장)
- Realtime 기능은 안 써도 됨 (Socket.io 사용 중)
- 무료 500MB / Pro $25/월 8GB
- 단점: 한국 region 없음 (가까운 region: Tokyo)

대안:
- **Railway Postgres** — 같은 인프라, 간편하지만 백업 등 부족 ($5+)
- **Neon** — Serverless Postgres, autoscale, 무료 0.5GB

#### 5-2. ORM 추천: **Prisma** 또는 **Drizzle**

**Prisma**:
- Schema-first, migration 자동
- TypeScript 타입 자동 생성
- 단점: 빌드 시간 길고 cold start 느림

**Drizzle** (추천):
- 빠르고 가벼움
- Schema 그대로 SQL에 가까움 — Postgres 기능 다 활용
- Vercel/Edge 호환

```ts
// apps/server/src/db/schema.ts (Drizzle 예시)
import { pgTable, uuid, varchar, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  oauthProvider: varchar('oauth_provider', { length: 20 }).notNull(),
  oauthSub: varchar('oauth_sub', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 20 }).notNull(),
  emojiAvatar: varchar('emoji_avatar', { length: 8 }).notNull(),
  isAdult: boolean('is_adult').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### 5-3. Migration 전략
1. **현재**: `InMemoryRoomStore` — 진행 중인 게임만 메모리
2. **DB 도입**: 영구 데이터(users, game_history) DB. 진행 중 게임은 그대로 메모리 (server crash 시 게임 손실 — 짧은 게임이라 허용 가능)
3. **(나중) 진행 게임도 DB**: 멀티 인스턴스 시 필요. Redis pub/sub + 게임 state DB

#### 5-4. Repository 패턴 활용 (이미 적용됨)
ARCHITECTURE.md §3:
```ts
interface RoomStore {
  create(opts): Room;
  get(id): Room | undefined;
  delete(id): boolean;
  list(): Room[];
}
class InMemoryRoomStore implements RoomStore { ... }  // 현재
class PostgresUserStore implements UserStore { ... }   // 신규 (게임 X, 사용자/통계)
```

→ 게임 진행 상태는 InMemory 유지. 사용자/히스토리만 DB.

### 동시접속 50~100명 — 단일 인스턴스 충분
ARCHITECTURE.md §확장 전략:
> Node.js 단일 인스턴스로 ~1000명 동시 처리 가능

- Railway $20 plan = 8GB RAM / 8 vCPU. 100명 × ~10MB = 1GB 메모리 (여유 충분)
- 단일 인스턴스라 **Redis 불필요**, **Sticky session 불필요**
- Server crash 시 — InMemoryRoomStore만 잃음. 사용자/히스토리는 DB에서 복구

### 멀티 인스턴스 검토 시점 (200명+)
- Redis 도입 (`socket.io-redis-adapter`)
- DB connection pool 증설
- LiveKit 유료 전환 또는 셀프호스팅 (Fly.io)

### 배포 체크리스트

#### 배포 직전
- [ ] OAuth 통합 (최소 카카오)
- [ ] DB 마이그레이션 + 사용자/히스토리 영구 저장
- [ ] 이용약관 + 개인정보처리방침 페이지
- [ ] 본인인증 (성인 확인)
- [ ] Rate limiting (socket.io spam 방지)
- [ ] 에러 모니터링 (Sentry)
- [ ] 이메일/문의 처리 채널 (지메일 alias 정도면 충분)
- [ ] 게임물관리위원회 등급분류 신청 ⚠️
- [ ] 변호사 자문 ⚠️

#### 배포 후 모니터링
- [ ] Sentry 에러 알림
- [ ] UptimeRobot 헬스체크
- [ ] Railway/Supabase 사용량 알림
- [ ] LiveKit 분 사용량 (월말 확인)
- [ ] 사용자 피드백 채널 (디스코드 / 카카오 오픈채팅)

---

## 6. Phase 정리 (실제 작업 순서)

| Phase | 작업 | 예상 기간 |
|---|---|---|
| **P0** | 음성 전용 모드 (현재 인프라에 추가) | 1~2일 |
| **P1** | DB 도입 (Drizzle + Supabase) — users, game_history | 3~5일 |
| **P2** | 게스트 + OAuth 임시 버튼 | 1~2일 |
| **P3** | 솔로 라우트 제거, 멀티 1인 통일 | 1일 |
| **P4** | 방 자동 정리 / Rate limiting / Sentry | 2~3일 |
| **P5** | 이용약관 / 개인정보처리방침 페이지 + 가입 동의 | 2~3일 (변호사 협업) |
| **P6** | 카카오 OAuth 본격 통합 + 본인인증 | 3~5일 |
| **P7** | Sentry / UptimeRobot / 모니터링 셋업 | 1~2일 |
| **P8** | **시범 배포** (게임물관리위원회 등급분류 동시 진행, 2~4주 대기) | 1주 |
| **P9** | 등급분류 후 정식 오픈 | - |
| **P10** | 글로벌 통계 / 리더보드 / 게임 히스토리 서버 저장 | 1주 |
| **P11** | 친구 목록 / 알림 / 다국어 | 점진적 |

**총 예상**: 6~10주 + 등급분류 대기 2~4주

---

## 7. 추가 알려드릴 사항

### 7-1. ⚠️ 한국 사행성 게임 규제 — 필수 체크
- **변호사 자문 없이 상업 운영 X** — 게임산업법 위반 시 형사 처벌 가능
- 현금성 자산 / 환전 가능 포인트 / 광고 보상 코인 등 어떤 형태든 사행성 의심받을 수 있음
- 등급분류 미신청 운영도 위법
- 안전한 노선: **광고만 수익, 가짜 점수 비환전, 18세 이상**

### 7-2. LiveKit 비용 폭증 위험
- 100명 active 시 무료 한도 (50명/1만분) 자주 초과
- **음성 전용으로 운영하면 비용 절감** (대역폭 1/10)
- 정 비용 부담되면 LiveKit 셀프호스팅 (Fly.io $10/월)

### 7-3. DB 백업 / 데이터 복구 정책
- Supabase Pro는 자동 백업 7일
- 게임 히스토리는 비교적 작은 데이터라 부담 X
- 사용자 탈퇴 시 데이터 삭제 (개인정보보호법 — 30일 내 처리)

### 7-4. 서비스 약관 / 개인정보처리방침
- 변호사 자문 + 표준 양식 활용 (한국인터넷진흥원 KISA 가이드)
- 필수 포함:
  - 수집 항목 (OAuth 닉네임/이메일/생년월일)
  - 보유 기간
  - 제3자 제공 (없음 권장)
  - 게임물관리위원회 등급분류 정보

### 7-5. 결제 모델 옵션 (사행성 회피)
- ✅ **광고 (배너 / 영상)** — Google AdSense, Coupang Partners
- ✅ **비기능 결제** — 카드 디자인, 아바타, 효과음 팩 (가짜머니 X)
- ✅ **구독 (광고 제거)** — 월 1~3천원
- ❌ 가짜 머니 충전 (사행성)
- ❌ 게임 결과로 보상 코인

### 7-6. 안티치트 / 보안
- ARCHITECTURE.md §보안 이미 server 권위 모델 → 클라 신뢰 X (✓)
- 추가:
  - SQL Injection 방지 (Drizzle 자동)
  - JWT XSS 방지 (httpOnly cookie)
  - CSRF 토큰 (REST API)
  - Rate limiting (socket.io + REST)
  - 친구간 담합 / 의도적 패배 — 친구 매칭 못하게? (사행성 방지)

### 7-7. 마케팅 / 사용자 획득
- 한국 시장 → 카카오톡 공유 / 페이스북 / 인스타
- 화투 카페 / 유튜브 화투 영상 댓글
- 시드 머니 ($100~500) 광고 시범
- 게이머 인플루언서 협업 (마이너 채널)

### 7-8. 운영 부담
- 50~100명 active 운영 = 거의 부담 없음 (자동 스케일링)
- 단, **이메일 응답 / 버그 리포트 / 신고 처리** 일정 시간 필요
- 디스코드 또는 카카오 오픈채팅으로 사용자 커뮤니티 운영 권장

### 7-9. 솔로 모드 제거 시 주의
- 현재 `/solo`는 socket 없이 동작 — 빠른 테스트 가능
- 멀티 1인 모드로 통일하면 server 부하 약간 증가 (게임 1인당 + AI 1봇)
- DB도 마찬가지 (게임 히스토리 저장)
- 그래도 50~100명 active에는 여유

### 7-10. PROJECT.md 업데이트 필요
- "비목표 — 상용 서비스" → "상용 서비스로 전환됨"
- "비목표 — 회원가입/본인인증" → "OAuth + 본인인증 도입"
- "비목표 — 광고 수익 모델" → "광고/비기능 결제 검토"
- "법적 고려사항 — 친구용 비공개" → "사행성 규제 준수, 등급분류 받음"

---

## 관련 문서
- [`PROJECT.md`](./PROJECT.md) — 비목표 항목 갱신 필요
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — DB 추가, 확장 전략
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Supabase / Sentry 추가, 비용 갱신
- [`rules-final.md`](./rules-final.md) — 룰은 그대로

---

## 8. 세션 작업 로그 — 원래 계획에 없던 변경 (2026-05-07)

ROADMAP의 P0~P11 단계가 아닌, 사용자 요청으로 즉석 진행된 UX 정비 작업. 추적용 기록.

### 8-1. 동기 — 사용자 피드백
- 대기실(WaitingRoom)이 게임 화면(GameView)과 시각적으로 단절됨 → 방 입장 = 게임 화면처럼 보이게
- AI 봇 설정이 게임 시작 버튼에 묶여있어 사전 설정 불가능
- ResultView 다음 판 흐름이 호스트/비호스트 모두에게 자연스럽지 않음
- 본인이 player ↔ spectator 전환 불가능 (재입장 필요)

### 8-2. 적용된 변경 (commit 단위로 묶일 작업)

| 영역 | 변경 |
|---|---|
| **WaitingRoom 제거** | `apps/web/src/features/room/WaitingRoom.tsx` 삭제. phase='waiting'에서도 GameView 렌더 (`RoomScreen`) + `RoomLobbyModal` 오버레이로 컨트롤 노출 |
| **RoomLobbyModal 신설** | `features/room/RoomLobbyModal.tsx` — 멤버 그리드 + AI 봇 설정 + 본인 관전자 토글 + 광팔이 자원 + 시작 버튼. createPortal + framer-motion spring scale |
| **OpponentSlot 클릭 메뉴** | 호스트가 phase='waiting'에서 다른 player slot 클릭 시 popover 메뉴 — 관전자 지정 / 광팔이 / 위임 / 강퇴. `OpponentMenuActions` interface 추가 |
| **AI 봇 사전 설정** | `AISetupModal`이 시작 버튼이 아닌 RoomLobbyModal의 별도 "봇 설정" 버튼에서 호출. `botDifficulties` state로 `game:start` payload에 전달 |
| **봇별 개별 난이도** | `room.aiBotDifficulties: Record<string, AiDifficulty>` 영구 저장 (`Room` 타입 + `views.ts`엔 미노출). `progressAITurnIfAny`가 봇별 lookup |
| **관전자 토글** | `room:toggle-spectator` 신규 socket 이벤트. 본인 또는 호스트 권한 체크 (`handlers.ts`). 호스트 자신 강제 X (위임 먼저) |
| **ResultView 흐름** | 호스트/비호스트 모두 "🎮 게임으로" 버튼. 호스트 = 즉시 다음 판 + endedSnapshot null. 비호스트 = 본인만 dismiss + dismissed flag. 호스트가 시작하면 비호스트 5초 후 자동 dismiss |
| **endedSnapshot hook** | `features/room/useEndedSnapshot.ts` — RoomScreen의 useState×2 + useEffect×2 로직 분리 |
| **공통 모달 spring** | `lib/animationTiming.ts`에 `MODAL_SPRING` / `MODAL_SCALE_*` 상수. AISetupModal/TargetPickerModal/RoomLobbyModal이 모두 같은 spring 사용 (게임 텐션에 맞게 stiffness 380) |
| **HistoryModal lobby 버튼** | `onGoToLobby?` prop 추가 — ResultView/in-game 호출자가 "🏠 로비로" 노출 가능. Lobby에서 호출 시엔 의미 없어 prop 안 줌 |
| **상대 점수 강조** | `CompactHeader` `OpponentBadge`에 amber 박스 + "점" 단위 |
| **TargetPickerModal 배경** | `bg-black/70 backdrop-blur-sm` 제거 + `pointer-events-none` 백드롭 → 본인 손패 보면서 선택 가능 |
| **시작 버튼 라벨 통일** | `WaitingRoom`의 "🤖 AI와 게임 시작" → "게임 시작" |

### 8-3. 변경 파일 (15개 + 1 신규 + 1 신규 hook)

**신규**:
- `apps/web/src/features/room/RoomLobbyModal.tsx`
- `apps/web/src/features/room/AISetupModal.tsx`
- `apps/web/src/features/room/useEndedSnapshot.ts`

**삭제**:
- `apps/web/src/features/room/WaitingRoom.tsx`

**수정**:
- `apps/web/src/features/room/{RoomScreen,GameView,ResultView}.tsx`
- `apps/web/src/features/room/game-ui/{OpponentSlot,TargetPickerModal,CompactHeader}.tsx`
- `apps/web/src/components/HistoryModal.tsx`
- `apps/web/src/lib/animationTiming.ts`
- `packages/shared/src/messages.ts` — `game:start` payload + `room:toggle-spectator`
- `packages/shared/src/types/room.ts` — `aiBotDifficulties`
- `apps/server/src/socket/{handlers,schemas,gameLogic,aiTurn}.ts`

### 8-4. ROADMAP 다음 단계와의 정합성

| 원래 ROADMAP 항목 | 이번 세션 영향 |
|---|---|
| **P3. 솔로 모드 제거** | 영향 X. SoloPlay는 그대로 유지 (`/solo` 라우트). 추후 멀티 1인 = 솔로로 통일 시 ResultView/GameView 그대로 사용 가능 |
| **P5. 음성 전용 모드** | 영향 X. `RoomRules.mediaMode` 추가 시 RoomLobbyModal의 RoomRulesModal에 토글 추가만 하면 됨 |
| **P6. DB 도입** | `room.aiBotDifficulties` 추가됨. DB 스키마에 반영 필요 (room 테이블 column 또는 별도 table). `game_history`에는 봇 난이도 기록 X (game 결과만 저장) |
| **P7. OAuth** | 영향 X. UserId는 게스트/OAuth 양쪽 다 같은 socket flow |
| **P9. 사행성 등급분류** | 영향 X — UI/흐름만 변경, 룰/베팅 X |

### 8-5. 회귀 위험

- **GameView가 phase='waiting'에서도 렌더** → `useMultiTurnSequence` / `useMultiSpecialsTrigger` hook이 turnSeq=0 / lastTurnSpecials=null로 noop 동작 확인 (테스트 114개 통과). 단 첫 게임 시작 시 view freeze 효과는 추가 검증 필요
- **RoomLobbyModal 위에 sub-modal (Chat/Rules/AI)** 띄워도 z-index 충돌 X (각 모달은 fixed inset-0 + 자체 z-index)
- **OpponentSlot에 onClick 추가** → 게임 진행 중에는 menuActions=undefined로 클릭 비활성화 (cursor-default)

### 8-6. 다음 세션에서 점검할 것

- [ ] dev에서 시작 버튼 → 분배 stagger 시각화 정상 작동
- [ ] 모바일(932×430)에서 RoomLobbyModal 스크롤 + OpponentBadge 클릭 시 메뉴 (CompactHeader는 메뉴 미지원 — 추후 모바일 UX)
- [ ] phase='waiting' 도중 다른 사용자 입장 시 RoomLobbyModal 멤버 list 즉시 갱신
- [ ] 비호스트가 본인 spectator → player 전환했는데 자리 가득(5명)일 때 toast 노출
- [ ] 게임 중 server-side timer 동작 확인 (RoomLobbyModal이 turn timer 영향 X 확인)

---

## 9. 추가 세션 — RoomLobbyModal 인터랙션 (2026-05-07 cont.)

**1번 세션 직후 사용자 피드백 후속.**

### 9-1. 변경 요점

| 영역 | 변경 |
|---|---|
| **테스트 모드** | `dealNewGame` `testMode` 옵션 (손패 1장 + 바닥 1장). RoomLobbyModal 호스트 토글. `room.testMode` 영구 — game:next-round에도 유지. **추후 제거 예정** (`apps/web/src/features/room/RoomLobbyModal.tsx`의 `TestModeToggle` + `packages/shared/src/rules/game.ts` `DealOptions.testMode`) |
| **`room:add-bots` 이벤트** | 게임 시작과 분리. AISetupModal 확인 → 즉시 server에 봇 추가 broadcast. 다른 사용자 화면에도 봇 슬롯 채워지는 게 보임. 기존 봇은 모두 제거 후 새로 추가 (변경 가능) |
| **AISetupModal 라벨** | "🎮 게임 시작" → "🤖 봇 추가" |
| **ChatInlinePanel** | `ChatPanel`을 `ChatBody` (재사용 가능 본체) + 모달 wrapper로 분리. PC ≥ 950px에선 RoomLobbyModal 우측 column에 항상 펼침. 모바일은 헤더 💬 버튼 → 토글 모달 (기존) |
| **RoomLobbyModal layout** | PC: `max-w-5xl` + flex-row (좌측 본문 + 우측 채팅 320px). 모바일: `max-w-2xl` + flex-col |
| **LobbyMemberCard** | 신규 컴포넌트. 클릭 시 popover 메뉴 (관전자/플레이어 이동 / 위임 / 강퇴). HTML5 native draggable. 호스트는 다른 멤버, 본인은 자기 자신, 비호스트는 본인만 메뉴 가능 |
| **드래그&드롭** | player 그리드 ↔ spectator 그리드 사이. 드래그 중인 사용자가 들어갈 수 있는 영역만 dashed border 강조. 자리 가득(5명)이면 player 영역 drop 거부. 모바일은 native touch DnD 미지원 → 클릭 메뉴로 대체 |

### 9-2. 신규 / 변경 파일

**신규**:
- `apps/web/src/features/room/LobbyMemberCard.tsx` — 드래그&클릭 메뉴 멤버 카드

**변경**:
- `apps/web/src/features/room/RoomLobbyModal.tsx` — layout 재작성 (좌우 분리, sub 컴포넌트 분리)
- `apps/web/src/features/room/AISetupModal.tsx` — 라벨 "봇 추가"
- `apps/web/src/components/ChatPanel.tsx` — `ChatBody` 분리 + `ChatInlinePanel` export
- `packages/shared/src/messages.ts` — `room:add-bots`, `game:start` payload `testMode` 추가
- `packages/shared/src/rules/game.ts` — `DealOptions.testMode`
- `packages/shared/src/types/{room,views}.ts` — `Room.testMode`, `RoomView.testMode`
- `apps/server/src/socket/{handlers,schemas,gameLogic,views}.ts` — `room:add-bots` 핸들러 + `AddBotsSchema` + `startGameInRoom`이 `testMode` 옵션 전달

### 9-3. 회귀 위험 / 알려진 한계

- **드래그&드롭 모바일 미지원** — HTML5 native API는 모바일 touch에서 동작 X. 클릭 메뉴로 대체 (플레이어로/관전자로 이동). dnd-kit 도입은 추후 검토
- **테스트 모드 룰 검증 부적합** — 손패 1장이면 매칭 룰 거의 발동 X. **흐름 검증 전용**. 통계보드 도달 확인 후 즉시 비활성화 권장. 추후 코드에서 완전히 제거할 것 (현재는 RoomLobbyModal `TestModeToggle` + `DealOptions.testMode` 두 곳만 보면 됨)
- **봇 변경 시 기존 봇 모두 제거** — 일부 봇만 변경 X. 한 번에 다시 설정해야 함 (단순화 결정)
- **ChatInlinePanel과 ChatPanel(모달)이 동시 mount 가능** — useChatStore 단일 source라 메시지 동기화는 자동. 하지만 unread 리셋이 두 곳에서 호출될 수 있음 (영향 X — idempotent)

### 9-4. 다음 세션에 점검

- [ ] dev에서 봇 추가 → 빈 자리에 봇 카드 렌더링 + 다른 사용자에게도 broadcast
- [ ] 드래그&드롭으로 player → spectator 이동 (PC 1280×720)
- [ ] 모바일에서 카드 클릭 메뉴로 동등 흐름 확인
- [ ] PC ChatInlinePanel 메시지 자동 스크롤 / unread 리셋
- [ ] 테스트 모드 ON → 손패 1장 분배 → 한 턴 후 종료 → ResultView 노출

---

## 10. 추가 세션 — 배포 + 폴리시 (2026-05-09 ~ 05-10)

**친구 MVP → 상업화 향상 단계로 전환. 배포 인프라 구축 + UX 폴리시 + 애니메이션 보정.**

### 10-1. 변경 요점

| 영역 | 변경 |
|---|---|
| **leftRoomGuard** | `apps/web/src/lib/leftRoomGuard.ts` — `markRoomLeft` / `clearLeftRoomGuard` / `wasRecentlyLeft(roomId)` (60초 grace). RoomScreen이 leave 직후 auto-rejoin loop 빠지지 않도록 sessionStorage 기반 |
| **stale 방 자동 정리** | `apps/server/src/server.ts` — 1분 cron. `room.players + room.spectators` 모두 `connected=false`면 `roomStore.delete`. 좀비 방 누적 방지 |
| **NODE_ENV-aware logger** | server `Fastify({ logger: isProd ? {level:'info'} : {level, transport:pino-pretty} })`. Railway 배포 시 transport 의존성 누락 회피 |
| **/debug/rooms endpoint** | `NODE_ENV !== 'production'`일 때만 노출. 좀비 방 디버깅용 |
| **Vercel + Railway + Supabase 배포** | `vercel.json` (SPA + `pnpm --filter @gostop/web build` → `apps/web/dist`), `railway.json` (NIXPACKS + `pnpm install --frozen-lockfile` + `pnpm --filter @gostop/server start`), Supabase Postgres `game_history` 테이블 + RLS (anon key 기반) |
| **Supabase 게임 히스토리 동기화** | `apps/web/src/lib/supabase.ts` (URL/KEY 없으면 null). `gameHistoryStore`에 `toRow` / `fromRow` / `mergeEntries` / `syncFromCloud(myUserId)` 추가. 로컬 50판 + 클라우드 무제한 (사용자 디바이스 간 동기화) |
| **PWA fullscreen + landscape** | `apps/web/vite.config.ts` manifest: `display: 'fullscreen'`, `display_override: ['fullscreen','standalone']`, `orientation: 'landscape'`. `apps/web/src/lib/pwa.ts` — `isPwaMode()`, `isMobileTouch()`, `tryLockLandscape()` (Screen Orientation API). `InstallPwaBanner.tsx` — `beforeinstallprompt` 캡처 + 설치 prompt |
| **PWA SW 비활성 (dev)** | `vite-plugin-pwa` `devOptions: { enabled: false }`. dev에서 service worker가 stale cache로 JSON parse error 일으키는 문제 회피 |
| **server gameLogic shake/bomb** | `startGameInRoom`이 모든 player(human + AI)에게 `detectShakesAndBombs(player.hand)` 적용. 사람도 흔들기/폭탄 가능 (이전엔 AI만 적용 버그) |
| **CreateRoomModal Spectator 토글** | `<input type=checkbox>` → 큰 토글 button (모바일 touch 영역 부족 fix) |
| **애니메이션 속도 ×2** | `apps/web/src/lib/animationTiming.ts` 모든 duration 2배 (HAND_PEAK 0.3→0.6, FLY 0.3→0.6, FLIP 0.3→0.6, SCALE_PEAK 0.5→1.0, INTER_PHASE 0.2→0.4, FLY_TO_COLLECTED 0.5→1.0, COLLECT_STAGGER 0.15→0.3). 사용자 가시성 ↑ |
| **EventOverlay phase-gated** | `useMultiSpecialsTrigger(view, phase)` — `phase === 'idle'`일 때만 fire. `GameView`가 `displayView` + `animationPhase` (AnimationPhaseContext)를 trigger에 전달. 쪽/뻑이 손패 클릭 즉시 발화하던 버그 fix — 이제 4-phase 완료 후 발화 |
| **useMultiTurnSequence currentPhase** | hook이 'idle' / 'phase1' / 'phase2' / 'phase3' / 'phase4' state 관리. context로 child에 노출. Phase 1-B sleep을 Phase 2 view swap 후로 통합 |
| **player 순서 드래그 변경** | `room:reorder-players` 이벤트 (호스트 한정, 대기실). `LobbyMemberCard`에 `onDropTarget` / `isDropHover` / `onDragOverTarget` / `onDragLeaveTarget` props. `RoomLobbyModal`의 `reorderPlayers(draggedId, targetId)` — splice insert. 게임 시작 시 `players[0]`이 첫 turn |

### 10-2. 신규 / 변경 파일

**신규**:
- `apps/web/src/lib/leftRoomGuard.ts` — leave guard helper
- `apps/web/src/lib/supabase.ts` — supabase client (옵셔널 init)
- `apps/web/src/lib/pwa.ts` — PWA 모드 detect + landscape lock
- `apps/web/src/components/InstallPwaBanner.tsx` — 설치 prompt UI
- `vercel.json` — Vercel SPA 배포 config
- `railway.json` — Railway NIXPACKS config
- `apps/web/src/contexts/AnimationPhaseContext.tsx` — current phase context

**변경**:
- `apps/server/src/server.ts` — /debug/rooms + 1-min cron + isProd logger
- `apps/server/src/socket/gameLogic.ts` — 모든 player에게 shake/bomb apply
- `apps/web/src/features/lobby/CreateRoomModal.tsx` — Spectator 큰 토글 button
- `apps/web/src/lib/animationTiming.ts` — duration 2x
- `apps/web/src/hooks/useMultiTurnSequence.ts` — currentPhase state 추가
- `apps/web/src/hooks/useMultiSpecialsTrigger.ts` — phase parameter, idle gate
- `apps/web/src/features/room/GameView.tsx` — AnimationPhaseContext.Provider wrap, displayView+animationPhase 전달
- `apps/web/src/stores/gameHistoryStore.ts` — Supabase mirror (toRow/fromRow/mergeEntries/syncFromCloud)
- `apps/web/vite.config.ts` — PWA fullscreen + landscape + devOptions disabled
- `apps/web/src/features/room/RoomLobbyModal.tsx` — reorderPlayers + drop handlers
- `apps/web/src/features/room/LobbyMemberCard.tsx` — onDropTarget/isDropHover/onDragOverTarget props
- `packages/shared/src/messages.ts` — `room:reorder-players` event
- `apps/server/src/socket/schemas.ts` — `ReorderPlayersSchema`
- `apps/server/src/socket/handlers.ts` — reorder-players 핸들러 (validation + array reorder)
- `apps/web/.env`, `apps/server/.env` — VITE_SUPABASE_URL/KEY, LIVEKIT_*, SUPABASE_*

### 10-3. 배포 정보

- **Web**: https://gostop-eight.vercel.app/ (Vercel)
- **Server**: https://gostopserver-production.up.railway.app/ (Railway)
- **DB**: Supabase Postgres (`game_history` table)
- **CORS_ORIGIN**: Vercel domain (Railway env Raw Editor 모드로 설정 — UI 모드 truncation 회피)

### 10-4. 알려진 함정

- **Railway lockfile mismatch**: `tsx`를 dev → dependencies 옮길 때 pnpm-lock.yaml 안 갱신하면 `ERR_PNPM_OUTDATED_LOCKFILE`. 항상 `pnpm install` → lock 커밋
- **Railway Watch Paths**: settings에서 watch path 잘못 잡으면 commit이 SKIPPED. 의심되면 manual Redeploy
- **CORS env truncation**: Railway UI 모드에서 `.app` 같은 TLD 잘리는 경우 있음 → Raw Editor 모드 사용
- **Chrome extension JSON parse error**: 일부 확장(McAfee 웹어드바이저 등)이 content script로 HTML fetch 후 JSON.parse → VM2511:1 같은 표시. dev는 incognito 권장. SW 자체 문제 X
- **AnimatePresence 제거**: PlayerGrid/SpectatorGrid의 AnimatePresence가 functional component child의 unmount 감지 못함. plain map으로 대체
- **PWA dev SW 충돌**: dev에서 SW enable 시 Vite HMR과 충돌, JSON parse error 유발 → `devOptions: { enabled: false }` 필수

### 10-5. 다음 세션에 점검

- [ ] 모션 ×2가 너무 느리지 않은지 (필요 시 ÷1.5 조정)
- [ ] 쪽/뻑/따닥이 4-phase 완료 후에만 오버레이 표시되는지
- [ ] 호스트가 player 순서 드래그로 바꾸면 다른 멤버에게도 broadcast
- [ ] 게임 시작 시 player[0]이 첫 turn (재배열한 첫 번째)
- [ ] 서버 cron 1분 후 disconnected 방 정리 확인
- [ ] Supabase 동기화 — 다른 디바이스 로그인 시 history 내려받음
- [ ] PWA 설치 후 fullscreen + landscape 적용 (모바일 Chrome)

---

## 관련 문서 (계속)

- [`ROADMAP3.md`](./ROADMAP3.md) — 친구 MVP 완성 시점 기록 (참고용)
