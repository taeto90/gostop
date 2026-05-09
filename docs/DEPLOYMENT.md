# 배포 가이드 (Deployment)

## 배포 아키텍처

```
[사용자 브라우저]
    ↓ HTTPS
    ├─→ [Vercel] : 프론트엔드 (정적 호스팅)
    │       ↓ wss://
    ├─→ [Railway] : 백엔드 (Fastify + Socket.io)
    │       ↓ (LiveKit 토큰 발급)
    └─→ [LiveKit Cloud] : 미디어 SFU (화상/음성)
```

## 호스팅 추천

| 컴포넌트 | 추천 서비스 | 이유 |
|---------|-----------|------|
| 프론트 (apps/web) | **Vercel** | 무료, 자동 HTTPS, GitHub 연동 자동 배포 |
| 백엔드 (apps/server) | **Railway** | WebSocket 안정 지원, $5/월 시작, Volume 지원 |
| 미디어 | **LiveKit Cloud** | 50명 동시 무료, 운영 부담 0 |
| 도메인 (선택) | Cloudflare/Namecheap | 1만원/년, Cloudflare는 무료 SSL 제공 |

### 사용 안 하는 이유

| ❌ | 이유 |
|----|------|
| Vercel 백엔드 | Serverless라 Socket.io 장기 연결 부적합 |
| Heroku | 무료 티어 종료, 비싸짐 |
| AWS/GCP 직접 | 운영 부담 큼 (MVP 부적합) |
| 자체 서버 | HTTPS 인증서, 도커, 모니터링 부담 |

## 사전 준비

### 1. 계정 가입
- [ ] **GitHub 계정** (코드 호스팅 + Vercel/Railway 연동)
- [ ] **Vercel** ([vercel.com](https://vercel.com)) — GitHub 로그인 가능
- [ ] **Railway** ([railway.app](https://railway.app)) — GitHub 로그인 가능
- [ ] **LiveKit Cloud** ([cloud.livekit.io](https://cloud.livekit.io)) — Google 로그인 가능

### 2. LiveKit 키 발급
1. LiveKit Cloud 가입 후 Project 생성
2. **API Key** + **API Secret** 메모
3. **Server URL** 메모 (예: `wss://your-project.livekit.cloud`)

### 3. (선택) 도메인 구매
- Cloudflare Registrar 추천 (도메인 원가, 자동 무료 SSL)
- 예: `gostop.example.com`

## 환경 변수

### 백엔드 (Railway)

| 변수 | 값 (예시) | 설명 |
|------|----------|------|
| `PORT` | `4000` | Railway가 자동 설정 (수정 X) |
| `HOST` | `0.0.0.0` | 모든 인터페이스에서 listen |
| `CORS_ORIGIN` | `https://gostop.example.com` | 프론트 도메인 (HTTPS 필수) |
| `LIVEKIT_URL` | `wss://your-project.livekit.cloud` | LiveKit 서버 |
| `LIVEKIT_API_KEY` | `APIxxxxxxxx` | LiveKit 콘솔에서 복사 |
| `LIVEKIT_API_SECRET` | `secretxxxxxxxx` | LiveKit 콘솔에서 복사 |

### 프론트엔드 (Vercel)

| 변수 | 값 (예시) | 설명 |
|------|----------|------|
| `VITE_SERVER_URL` | `https://gostop-server.up.railway.app` | Railway가 발급한 URL |
| `VITE_LIVEKIT_URL` | `wss://your-project.livekit.cloud` | LiveKit URL (공개해도 OK) |

**중요**: Vite는 클라이언트로 노출되는 환경변수만 `VITE_` 접두사 사용. **API 키/시크릿은 절대 프론트에 두지 말 것**.

## 단계별 배포 절차

### Step 1: GitHub 저장소 준비

```bash
cd C:\Users\skyst\GoStop
git init
git add .
git commit -m "Initial commit"
gh repo create gostop --private --push
```

> 주의: `.mcp.json`, `.env` 등이 `.gitignore`에 잘 들어있는지 확인. API 키 노출 절대 금지.

### Step 2: Railway 백엔드 배포

1. Railway 콘솔에서 **New Project** → **Deploy from GitHub repo** 선택
2. `gostop` 저장소 선택
3. **Settings**에서 다음 설정:
   - **Root Directory**: `apps/server`
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @gostop/server build`
   - **Start Command**: `cd ../.. && pnpm --filter @gostop/server start`
   - 또는 Dockerfile 사용 (추후 추가)
4. **Variables** 탭에서 환경 변수 설정
5. **Networking** 탭에서 **Generate Domain** 클릭 → URL 메모

### Step 3: Vercel 프론트엔드 배포

1. Vercel 콘솔에서 **Add New Project** → GitHub `gostop` 저장소 선택
2. **Configure Project**:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Vite
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @gostop/web build`
   - **Output Directory**: `dist`
3. **Environment Variables** 추가
4. **Deploy** 클릭

### Step 4: LiveKit 연동 확인

1. 프론트에서 방 입장 시 LiveKit 토큰 요청
2. 토큰 받아 LiveKit Cloud 연결
3. 비디오/오디오 정상 작동 확인

### Step 5: (선택) 커스텀 도메인 연결

1. **Vercel**: Project Settings → Domains → 도메인 추가
2. **Cloudflare**: DNS에 CNAME 레코드 추가 (Vercel이 알려줌)
3. SSL 자동 발급 (Vercel/Cloudflare 자동)
4. **Railway**: 백엔드용 서브도메인 연결 (예: `api.gostop.example.com`)
5. CORS_ORIGIN 환경변수 업데이트

## ⚠️ HTTPS 필수 (WebRTC)

**WebRTC는 HTTPS에서만 마이크/카메라 권한을 받습니다.** 즉:
- ❌ `http://example.com` → 화상채팅 작동 안 함
- ✅ `https://example.com` → 정상
- ✅ `http://localhost:5173` (개발 환경, 예외 허용)

Vercel/Railway 모두 자동 HTTPS 제공하므로 별도 작업 불필요.

## 비용 추정

### 친구용 (20명, 4방)

| 항목 | 비용 | 비고 |
|------|------|------|
| Vercel 프론트 | **$0** | 무료 티어 (월 100GB 대역폭) |
| Railway 백엔드 | **$5/월** | $5 크레딧 자동 충전 |
| LiveKit Cloud | **$0** | 50명 / 1만 분 무료 |
| 도메인 | $10/년 | Cloudflare Registrar |
| **합계** | **약 $5-10/월** | 도메인 미사용 시 거의 무료 |

### LiveKit 사용량 추정 (참고)

20명 × 1시간 = 1200분/세션. 무료 1만 분이면 **약 8회 1시간 게임** 가능.

| 사용 빈도 | 월간 분 | 무료 충분? |
|----------|--------|----------|
| 주말마다 (월 4회 × 1시간) | 4800분 | ✅ |
| 주 2-3회 (월 12회 × 1시간) | 14400분 | ❌ → 유료 ($50/월) |
| 매일 1시간 | 36000분 | ❌ → 셀프호스팅 검토 |

자주 쓰면 LiveKit 셀프호스팅 (Fly.io에 $5-10/월) 검토.

## 모니터링

### 무료 모니터링

| 도구 | 용도 |
|------|------|
| Railway 대시보드 | 백엔드 CPU/메모리/로그 |
| Vercel Analytics | 프론트 페이지뷰, 성능 |
| LiveKit 대시보드 | 미디어 사용량 (분 단위) |
| UptimeRobot | 외부 헬스체크 (5분 간격, 무료) |

### 헬스체크 설정

UptimeRobot에서:
- Monitor Type: **HTTPS**
- URL: `https://your-server.up.railway.app/health`
- Expected Response: `200`
- 5분마다 체크 → 다운 시 이메일 알림

## 트러블슈팅

### "마이크/카메라 권한이 안 떠요"
- HTTPS인지 확인 (HTTP는 WebRTC 불가)
- 브라우저 권한 차단 여부 확인 (주소창 자물쇠 아이콘)
- iOS Safari는 사용자 클릭 후에만 권한 요청 가능

### "Socket.io 연결이 자꾸 끊겨요"
- Railway는 WebSocket 지원 ✅
- Vercel 백엔드는 Serverless라 부적합 ❌
- CORS_ORIGIN이 정확한지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### "LiveKit 연결이 안 돼요"
- API 키/시크릿이 백엔드에만 있고 프론트로 누출 안 됐는지 확인
- LiveKit URL이 `wss://`로 시작하는지 확인
- 토큰 만료 시간 확인 (1시간 권장)

### "비용이 폭발했어요"
- Railway 사용량 확인 (대시보드)
- LiveKit 분 단위 사용량 확인
- 무한 루프나 메모리 누수 가능성

## 배포 시점 (Phase별)

| Phase | 배포 여부 | 이유 |
|-------|----------|------|
| Phase 0-2 | ❌ 로컬 개발만 | 게임 룰 + Socket이 안정될 때까지 |
| Phase 3 | ✅ 시범 배포 | LiveKit 통합 후 친구 1-2명과 테스트 |
| Phase 4-5 | ✅ 정식 배포 | 보너스 룰 + UI 완성 후 |
