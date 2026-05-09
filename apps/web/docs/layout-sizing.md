# 화면 레이아웃 / 카드 크기 결정 원리

이 문서는 현재 모바일/PC 화면에서 **카드 크기**, **영역 크기**, **레이아웃**이
어떻게 결정되는지 정리합니다. 변경 작업 시 이 문서를 먼저 보고 어떤 변수를
조절해야 하는지 파악하세요.

> 모든 사이즈 변수는 **`apps/web/src/lib/layoutConstants.ts`** 한 파일에 모여
> 있습니다. 사이즈 조정은 이 파일만 수정하면 됩니다.

---

## 0. 분기 — 모바일 vs PC

```ts
const COMPACT_BREAKPOINT = 950;
const isCompact = rootW > 0 && rootW < COMPACT_BREAKPOINT;
```

- **rootW < 950px** → 모바일 가로 모드 (`isCompact = true`)
  - CompactHeader (상단 한 줄), 점수판 좁음(140px), 게임판 2행 4열, 손패 우측만
- **rootW ≥ 950px** → PC 모드 (`isCompact = false`)
  - OpponentSlot row, 점수판 넓음(260px), 게임판 6각형 + 코너, 손패 가로 전체

`COMPACT_BREAKPOINT`만 바꾸면 임계값 변경 가능.

---

## 1. 전체 레이아웃 (GameView.tsx)

CSS Grid 한 컨테이너로 PC/모바일 통합:

```
gridTemplateColumns = `${COLLECTED_PANEL_WIDTH}px 1fr`
gridTemplateRows    = `auto minmax(0, 1fr) ${handMin}px`
```

|              | col 1 (점수판)        | col 2 (게임판/손패) |
|--------------|----------------------|--------------------|
| **row 1**    | 헤더 (`col-span-2`)   | (병합)              |
| **row 2**    | 점수판 (모바일은 row-span-2) | 게임판             |
| **row 3**    | (모바일은 점수판 연장) | 손패 (PC는 `col-span-2`) |

- **모바일**: 점수판이 row 2~3 차지 (화면 바닥까지). 손패는 col 2 only.
- **PC**: 점수판은 row 2만. 손패는 col-span-2 (가로 전체).

---

## 2. 카드 크기 결정 — 핵심

### 2-1. 손패 카드 (MyHand.tsx)

```ts
const cap         = compact ? HAND_CARD_MAX_WIDTH.mobile : HAND_CARD_MAX_WIDTH.pc;
const widthBased  = (availableWidth - (total - 1) * HAND_CARD_GAP) / total;
const heightBased = availableHeight / 1.63;

const cardW = Math.max(HAND_CARD_MIN_WIDTH, Math.min(cap, widthBased, heightBased));
//                                          ^^^ 셋 중 가장 작은 값이 적용
```

**3개 후보 중 가장 작은 값**이 카드 너비가 됩니다.

| 변수 | 의미 | 결정자 되는 조건 |
|------|------|-----------------|
| `cap` | 사용자가 정한 상한 (`HAND_CARD_MAX_WIDTH`) | widthBased/heightBased가 충분히 클 때 |
| `widthBased` | 손패 가로 폭 ÷ 7장 (자동) | 손패 영역이 가로로 좁을 때 (모바일) |
| `heightBased` | 손패 세로 폭 ÷ 1.63 (자동) | 손패 영역이 세로로 짧을 때 (대부분 PC) |

> **⚠️ 자주 하는 실수**: `HAND_CARD_MAX_WIDTH.pc`만 키워도 효과 없을 때가 많습니다.
> PC에서는 보통 `heightBased`가 가장 작아서 결정자입니다. 손패 카드를 진짜 키우려면
> **손패 영역 height**(`HAND_AREA_RATIO`, `HAND_AREA_MAX`)를 키워야 합니다.

### 2-2. 게임판 카드 (CenterField.tsx)

같은 원리이지만 컨테이너 가로/세로 양쪽 모두 슬롯 배치를 고려:

```ts
const cardWByWidth  = (containerW / 2 - margin) / farFactorW;
const cardWByHeight = (containerH / 2 - margin) / (farFactorH × CARD_RATIO);
const cap           = compact ? FIELD_CARD_MAX_WIDTH.mobile : FIELD_CARD_MAX_WIDTH.pc;

const cardW = Math.max(FIELD_CARD_MIN_WIDTH, Math.min(cap, cardWByWidth, cardWByHeight));
```

`farFactorW`, `farFactorH`는 게임판에서 가장 외곽 슬롯의 카드 끝까지 거리 비율입니다:

- **PC**: corner 슬롯이 `1.5 × colStep` 떨어져 있음 → factor ≈ 4.25
- **모바일**: 4번째 col이 `2 × colStep` 떨어져 있음 → factor ≈ 5.5
- 세로: PC는 row가 `±rowStep` 떨어짐, 모바일은 `±0.6 cardH` (더미 겹침)

`FIELD_MOBILE_FAR_FACTOR_H`, `FIELD_MOBILE_ROW_DISTANCE_RATIO`로 모바일 row 거리 조절.

> **⚠️ PC 게임판 카드 줄이려고 `FIELD_CARD_MAX_WIDTH.pc`만 작게 해도** heightBased가
> 더 작으면 효과 없음. 실제로는 게임판 영역 height(=손패 외 영역)에 자동 맞춤됨.

---

## 3. 영역(섹션) 크기

### 3-1. 손패 영역 height

```ts
const handRatio =
  rootH < 400 ? HAND_AREA_RATIO.shortMobile
  : compact   ? HAND_AREA_RATIO.mobile
              : HAND_AREA_RATIO.pc;

const handMin = clamp(rootH × handRatio, HAND_AREA_MIN, HAND_AREA_MAX);
```

- `HAND_AREA_RATIO.pc = 0.20` → PC에서 화면 height의 **20%**가 손패 영역
- `HAND_AREA_MIN = 85` → 너무 작아지지 않음
- `HAND_AREA_MAX.pc = 170` → 너무 커지지 않음

> **카드를 키우려면 여기를 조절**: `HAND_AREA_RATIO.pc` 0.20 → 0.30, `HAND_AREA_MAX.pc`도
> 함께 키우면 손패 영역이 커지고 → heightBased가 커져서 → 카드가 커짐.

### 3-2. 점수판 폭

```ts
const collectedW = compact ? COLLECTED_PANEL_WIDTH.mobile : COLLECTED_PANEL_WIDTH.pc;
// PC: 260px, 모바일: 140px
```

좌측 첫 번째 grid column 너비. 게임판 가로 폭 = `rootW - collectedW - gap`.

### 3-3. 게임판 영역

별도 변수 없음. `minmax(0, 1fr)` row가 자동으로 남은 height 차지.
즉 **rootH - header - handMin - gap** 만큼.

손패 영역을 줄이면 게임판 영역이 자동으로 늘어남.

---

## 4. 점수판 카드 / 결과 화면 카드 — 직접 지정

이 둘은 **단순 fixed**입니다:

```ts
COLLECTED_CARD_WIDTH = { pc: 38, mobile: 24 }  // 점수판 안 카드
RESULT_CARD_WIDTH    = { pc: 80, mobile: 44 }  // 결과 화면 카드
```

직접 지정한 px 그대로 적용. 자동 fit 없음.

---

## 5. 손패 카드 사이 간격 / Stack offset

```ts
HAND_CARD_GAP = 22                  // 손패 카드 사이 가로 px
FIELD_HORIZONTAL_GAP_RATIO = 1.5    // col 사이 빈 공간 = cardW × 1.5
FIELD_VERTICAL_GAP_RATIO = 0.5      // row 사이 빈 공간 (PC) = cardH × 0.5
FIELD_STACK_OFFSET_RATIO = 0.25     // 같은 월 stack 시 위 카드 X-offset = cardW × 0.25
                                    // → 위 카드가 75% 덮음, 아래 25% 보임
```

---

## 6. 자주 하는 변경 시나리오

### 시나리오 A: PC 손패 카드 더 크게

```ts
// ❌ 효과 없음 — heightBased가 결정자라 cap 무시됨
HAND_CARD_MAX_WIDTH.pc = 200

// ✅ 손패 영역 height 키워야 함
HAND_AREA_RATIO.pc = 0.28      // 0.20 → 0.28
HAND_AREA_MAX.pc  = 230        // 170 → 230 (max도 함께 키워야 ratio 효과 있음)
```

### 시나리오 B: 모바일 게임판 카드 더 크게

```ts
// 모바일은 heightBased가 결정자. row 거리 줄이면 카드 커짐.
FIELD_MOBILE_FAR_FACTOR_H = 1.0    // 1.1 → 1.0 (위/아래 더 잘림 위험)
FIELD_MOBILE_ROW_DISTANCE_RATIO = 0.5  // 0.6 → 0.5 (더미와 row 더 겹침)

// 또는 손패 영역 줄여 게임판 늘림
HAND_AREA_RATIO.mobile = 0.20  // 0.24 → 0.20
```

### 시나리오 C: 점수판 폭 변경

```ts
COLLECTED_PANEL_WIDTH.pc     = 200    // PC 점수판 좁게
COLLECTED_PANEL_WIDTH.mobile = 110    // 모바일 점수판 좁게
// → 게임판 가로 자동으로 더 넓어짐
```

### 시나리오 D: 매칭 카드 강조 톤 변경

`apps/web/src/components/Card.tsx` 의 `HIGHLIGHT_CLASS`:

```ts
const HIGHLIGHT_CLASS = {
  matchable: 'ring-[6px] ring-amber-300 ring-offset-2 ... shadow-[...]',
  // 두께 ring-[8px], 색상 ring-rose-400 등 변경
};
```

---

## 7. 디버그 팁

### 실제 카드 크기 확인 (콘솔)

브라우저 console에서:

```js
// 게임판 카드 사이즈
document.querySelectorAll('[aria-label]:not([aria-label=""]):not(button)')
  .forEach(c => console.log(c.getBoundingClientRect()));

// 또는 CenterField containerRef 측정
```

### 변수가 실제로 효과 있는지 빠른 확인법

1. cap 변수를 일부러 매우 크게 (예: 500) → 카드 변화 있나?
   - **변화 있음** → cap이 결정자였음
   - **변화 없음** → widthBased / heightBased가 결정자
2. 결정자 찾으면 그 자동 계산을 결정하는 영역 변수(ratio/max)를 조절

---

## 8. 파일별 책임

| 파일 | 역할 |
|------|------|
| `lib/layoutConstants.ts` | **모든 사이즈 변수**의 단일 소스 |
| `lib/animationContext.ts` + `lib/animationTiming.ts` | 애니메이션 타이밍/페이즈 |
| `features/room/GameView.tsx` | Grid 레이아웃 (헤더/점수판/게임판/손패 배치) |
| `features/room/game-ui/MyHand.tsx` | 손패 카드 사이즈 계산 |
| `features/room/game-ui/CenterField.tsx` | 게임판 슬롯 + 카드 사이즈 |
| `features/room/game-ui/MobileCollected.tsx` | 좌측 점수판 (점수+딴패+총점수) |
| `features/room/game-ui/CompactHeader.tsx` | 모바일 상단 한 줄 헤더 |
| `features/room/ResultView.tsx` | 게임 종료 결과 화면 |
| `components/Card.tsx` | 카드 단일 컴포넌트 (highlight, peakScale) |

---

## 9. 향후 단순화 가능 옵션

복잡함이 부담되면 다음 중 하나로 전환 가능:

### 옵션 A — 카드 너비 직접 지정 (가장 단순)
`HAND_CARD_WIDTH = { pc: 90, mobile: 56 }` 처럼 정확히 지정. 영역 height는 cardW × 1.63 + buffer로 자동.

### 옵션 B — 화면 비율 한 변수
`HAND_CARD_HEIGHT_RATIO = { pc: 0.20 }` → 카드 높이 = `rootH × 0.20`. 화면 커지면 카드도 커짐.

현재(옵션 C)는 "cap + 자동 fit" 방식이라 가장 유연하지만 결정자 추적이 필요합니다.
