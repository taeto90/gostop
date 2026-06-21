# ROADMAP6 — 남은 작업 (2026-06-21 기준)

**이전**: [`ROADMAP66.md`] (2026-05-17) — 대부분 소화됨. 본 문서가 최신.

> ROADMAP66의 P0/P2 항목 상당수가 이후 세션에서 완료됐고, **이번 세션에 Capacitor Android 앱 + OTA가 도입**됐습니다. 본 문서는 **현재 실제로 남은 작업**만 현재 상태(앱화 완료 + 상업화 지향) 기준으로 재정렬합니다.

---

## ✅ ROADMAP66 이후 완료 (요약)

- **인프라/공개**: Google OAuth · Admin 페이지 · Rate limiting · 게임 로그/에러 로그 시스템 · Supabase 게임 히스토리 cross-device
- **UX**: 키보드 단축키(1~9/G/S/C) · Wake Lock · 모바일 채팅 키보드 fix · AI go/stop 난이도별 · 게임 로그 자동 검증 · 매칭 강조
- **룰 옵션**: 보너스피(투피/쓰리피) · 조커 통일 · 음성 전용 모드 · 비밀방 게임 중 변경 · 마지막 손패 즉시승 · 나가리 무승부
- **앱 (이번 세션)**: Capacitor Android + Capgo OTA · OAuth deep-link · 몰입모드/safe-area · LiveKit 음성품질 상향 · 가로모드 고정 · 뒤로가기 종료 모달 · 로비 버전 표시
- **A작업 (이번)**: 흔들기/폭탄 모달 timeout(기구현 확인) · 결과 박/멍따 슬램인 애니메이션 · **LiveKit 토큰 TTL 1h→12h**(장시간 세션 재접속 만료 해결, 구 추적항목 F)

---

## 1. 우선순위 요약 (남은 것)

| 순위 | 항목 | 분류 | 비고 |
|---|---|---|---|
| **P1** | 앱 아이콘 / 스플래시 | 앱(B) | Capacitor 기본 아이콘 — 에셋 대기 |
| **P1** | preset 전체 audit + 시뮬레이션 테스트 | 도구 | drawTop 위치별 turn 동작 검증 + expected 주석 |
| **P1** | 광팔이 모달 폴리시 | UX | 자원/지정 흐름 명확화 |
| **P1** | LobbyMemberCard 모바일 DnD (@dnd-kit) | UX | 현재 클릭 메뉴 대체 |
| **P2** | README.md / Sentry 에러 모니터링 | 공개(C) | repo 공개·운영 모니터링 |
| **P2** | 카드 테마 · AI 캐릭터성 · i18n(영어) | 폴리시(C) | |
| **P2** | 봇 thinking vs 4-phase timing (testMode 큐) | 안정성 | 일반 모드는 OK, testMode 0.5×만 |
| **P3** | **Play Store 정식 출시** | 상업화(D) | 서명 AAB + 개인정보처리방침 + 콘텐츠 등급 |
| **P3** | 게임물관리위원회 등급분류 | 법규(D) | 미신청 운영 불법, 2~4주 대기 |
| **P3** | 카카오 OAuth + 본인인증 + 이용약관 | 법규/인프라(D) | |
| **P3** | 리더보드 / 친구목록 / 리플레이 | 확장(D) | |
| **P4** | iOS 앱 | 앱 | Mac 필요 — 현재 보류 |
| **P4** | 음성인식 고/스톱 · 스트리머 모드 · BGM · 토너먼트 · 지역별 룰 | 확장 | 장기 |

---

## 2. B — 앱 마감 (이번에 앱화하며 생긴 것)

- **앱 아이콘 / 스플래시**: 현재 Capacitor 기본 아이콘(빌드 시 "icon not found" 경고). 에셋(1024² 아이콘 + 스플래시) 주시면 `@capacitor/assets`로 생성·적용
- **iOS**: 보류 (Mac/클라우드 빌드 필요). 네이티브 코드·권한은 Android와 공유되므로 추후 `npx cap add ios`만 추가하면 대부분 재사용
- OTA 운영: 수정마다 `apps/web/package.json` version +1 후 `pnpm --filter @gostop/web ota` (CLAUDE.md "Capacitor Android 앱 + Capgo OTA" 섹션 참고)

## 3. 게임 폴리시 / 도구

- **preset 전체 audit**: `packages/shared/src/rules/presets.ts` 30개 시나리오 — drawTop 각 위치가 turn N에서 어떤 동작(뻑/쪽/따닥 등) 일으키는지 검증 + expected outcome 주석. 가능하면 server 시뮬레이션 N턴 후 final state 비교 테스트. (`nine-yeol-toggle`은 이번에 안전 확인됨)
- **광팔이 모달 폴리시**: 4~5명 시 RoomLobbyModal 안 광팔이 자원/지정 흐름 highlight·toast·confirm
- **LobbyMemberCard 모바일 DnD**: `@dnd-kit/core` 도입(pointer events, touch/mouse)

## 4. C — 공개 준비 / 품질

- README.md(현재 없음) · Sentry(`@sentry/react`+`@sentry/node`)
- 카드 테마(다크/뒷면 종류) · AI 캐릭터성(봇 말투/도발) · i18n(한/영)

## 5. D — 상업화 (Play Store 정식 출시 시 필수)

> 친구 사이드로드(APK)는 지금도 가능. 정식 스토어 출시로 가면 아래가 핵심 관문.

- **Play Store**: 서명된 release AAB + 스토어 리스팅 + **개인정보처리방침 페이지(필수)** + 콘텐츠 등급 설문
- **게임물관리위원회 등급분류**: 청소년이용불가(18+), 신청→2~4주
- **카카오 OAuth**(한국 1순위) + **본인인증**(성인 확인) + **이용약관**(변호사 자문)
- 리더보드 / 친구목록 / 리플레이(액션 히스토리 기반)

---

## 6. 열린 추적 항목

| # | 항목 | 비고 |
|---|---|---|
| D | `/rule-test`·`/result-demo` production 노출 | guard 검토 (`/game-demo`는 DEV 전용 처리됨) |
| E | preset name이 RoomLobbyModal/schemas/PresetId 3곳 중복 | enum 단일 source |
| G | InMemoryRoomStore — server crash 시 진행 중 게임 손실 | P3 DB 도입으로 해결 |
| H | RoomRules `addPoint`(흔들기 +N점) 코드 미적용 — UI만 | low |

---

## 관련 문서

- [`CLAUDE.md`](../CLAUDE.md) — 프로젝트 컨벤션 + Capacitor/OTA + 행동 지침
- [`rules-final.md`](./rules-final.md) / [`rules-todo.md`](./rules-todo.md) — 룰 정의 / 미구현(현재 핵심 룰 모두 구현)
- ROADMAP·2·3·4·5·66 — 구버전 (참고용)
