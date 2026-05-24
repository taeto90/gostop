# 🎴 GoStop — 화투 온라인 게임

한국 전통 카드 게임 **고스톱(화투)**을 최대 5명이 화상/음성 채팅하며 즐길 수 있는 웹 게임입니다.

**[데모 플레이](https://gostop-eight.vercel.app)**

## 기술 스택

| 영역 | 기술 |
|---|---|
| **프론트엔드** | React 19, Vite 7, Tailwind CSS v4, framer-motion, zustand |
| **백엔드** | Fastify 5, Socket.io 4, Zod |
| **공유 룰 엔진** | TypeScript (클라이언트/서버 동일 로직) |
| **화상/음성** | LiveKit Cloud |
| **인증** | Supabase Auth (Google OAuth) |
| **DB** | Supabase Postgres (프로필, 게임 히스토리, 게임 로그) |
| **배포** | Vercel (웹), Railway (서버) |

## 모노레포 구조

```
apps/web        Vite + React SPA (PWA)
apps/server     Fastify + Socket.io 실시간 서버
packages/shared 룰 엔진 + 타입 (클라/서버 공유)
```

## 시작하기

### 필수 요건
- Node.js 22+
- pnpm 10+

### 설치 및 실행

```bash
pnpm install
pnpm dev          # 웹(5173) + 서버(4000) 동시 실행
```

### 개별 실행

```bash
pnpm dev:web      # Vite dev server (port 5173)
pnpm dev:server   # Fastify + Socket.io (port 4000)
```

### 타입체크 및 테스트

```bash
pnpm --filter @gostop/web typecheck
pnpm --filter @gostop/server typecheck
pnpm --filter @gostop/shared test        # vitest (122개 테스트)
```

## 주요 기능

- 2~5인 고스톱 (정통 룰 기반)
- 화상/음성 채팅 (LiveKit)
- 1인 AI 대전 (난이도 easy/medium/hard)
- 광팔이 (4~5명), 흔들기/폭탄, 총통, 쇼당
- 조커/보너스피 (투피/쓰리피) 옵션 룰
- Go/Stop 시스템 + 배수 (피박/광박/멍박/멍따/고박)
- 비밀방, 관전자, 텍스트 채팅
- 테스트 모드 (30개 preset 시나리오)
- PWA (모바일 가로 모드 최적화)
- Google OAuth 로그인
- Admin 페이지 (에러 로그, 게임 로그, 유저 관리)

## 환경 변수

### 웹 (`apps/web`)
| 변수 | 설명 |
|---|---|
| `VITE_SERVER_URL` | 서버 URL |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon 키 |

### 서버 (`apps/server/.env`)
| 변수 | 설명 |
|---|---|
| `PORT` | 서버 포트 (기본 4000) |
| `CORS_ORIGIN` | 허용 origin (쉼표 구분) |
| `LIVEKIT_URL` | LiveKit 서버 URL |
| `LIVEKIT_API_KEY` | LiveKit API 키 |
| `LIVEKIT_API_SECRET` | LiveKit API 시크릿 |
| `SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키 |

## 라이선스

Private — 비공개 프로젝트
