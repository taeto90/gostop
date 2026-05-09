# Visual Effects

특수 이벤트 시각 효과. **대부분 코드(framer-motion + Tailwind)로 구현**되며, 별도 asset 파일 없어도 동작.

이 폴더는 **선택적**으로 추가하는 이미지/Lottie/GIF용.

---

## 시각 효과 plan (코드 구현 위주)

| 이벤트 | 시각 효과 | asset 필요? |
|---|---|---|
| **뻑** | 화면 가운데 "🚫 뻑" 빨간 텍스트 + 카드 묶임 표시 | ❌ 코드만 |
| **자뻑** | "💥 자뻑!" 큰 노란 텍스트 + 폭죽 애니메이션 | ❌ 코드 (확장 시 lottie 권장) |
| **따닥** | "✨ 따닥!" + 카드 4장 함께 모이는 효과 | ❌ 코드만 |
| **쪽** | "💋 쪽!" + 하트 ❤️ 떠오름 | ❌ 코드만 |
| **싹쓸이** | "🧹 싹쓸이!" + 빗자루 sweep 애니메이션 | ❌ 코드만 |
| **폭탄** | "💣 폭탄!" + 화면 흔들림 + 폭발 효과 | ⭕ 옵션 (gif/lottie 또는 코드) |
| **흔들기** | "🤲 흔들기!" + 카드 3장 좌우 흔들 | ❌ 코드만 |
| **총통** | "👑 총통!" 황금 화려한 등장 + 카드 4장 펼침 | ⭕ 옵션 (lottie 권장) |
| **고** | "✊ GO!" 큰 진한 텍스트 + 분 풍선 | ❌ 코드만 |
| **스톱** | "🛑 STOP!" + 정지 효과 | ❌ 코드만 |
| **박** (피박/광박/멍박) | "💢 OO박!" 도장 효과 (회전 + scale 강조) | ❌ 코드만 |
| **멍따** | "🐦 멍따!" + 새 그림자 떨림 | ❌ 코드만 |
| **나가리** | "🤝 나가리..." 흐릿한 톤 다운 | ❌ 코드만 |

---

## 권장 구현 방향

### 1차 — 모든 이벤트 코드 구현 (즉시 가능)
- `apps/web/src/components/EventOverlay.tsx` (신규) — 풀스크린 absolute, 텍스트 + framer-motion
- 트리거: 룰 엔진의 `executeTurn` 결과 `specials` 분석 → 적절한 이벤트 발화
- duration 0.8~1.2초 후 자동 소실

### 2차 — 화려한 효과는 lottie/이미지 추가 (옵션)
사용자가 더 화려한 효과 원하면 다음 asset을 이 폴더에 추가:

| 파일 | 권장 형식 | 용도 |
|---|---|---|
| `bomb-explosion.lottie` 또는 `.gif` | Lottie/GIF | 폭탄 |
| `chongtong-fanfare.lottie` | Lottie | 총통 황금 |
| `confetti.lottie` | Lottie | 자뻑/멍따 환호 |
| `stamp-bak.png` | PNG (반투명) | 박 도장 효과 |

### Lottie 추천 출처 (CC0 / 무료)
- **LottieFiles** — https://lottiefiles.com/free-animations (회원가입 후 다운)
- **LordIcon** — https://lordicon.com/ (일부 무료)
- **icons8 Lottie** — https://icons8.com/animated-icons (무료/유료 혼합)

검색어 추천:
- "explosion" / "boom" → 폭탄
- "fanfare" / "trumpet" / "celebration" → 총통/멍따
- "confetti" / "fireworks" → 자뻑
- "stamp" / "approved" → 박

### Lottie 사용 시 패키지
```bash
pnpm --filter @gostop/web add lottie-react
```
```tsx
import Lottie from 'lottie-react';
import bombAnimation from '../assets/effects/bomb-explosion.json';
<Lottie animationData={bombAnimation} loop={false} />
```

---

## 우선순위

1. **Phase 1**: 코드만으로 모든 이벤트 시각 효과 구현 (asset 0개)
2. **Phase 2**: 사용자가 직접 듣고/보고 어울리는 사운드 + lottie 골라서 추가
3. **Phase 3**: 룰 엔진 fix + 코드 정확성 (`rules-final.md` 기반)

이 폴더는 일단 비어있어도 OK. Phase 2에서 채움.
