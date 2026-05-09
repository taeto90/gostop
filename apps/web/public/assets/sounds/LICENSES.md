# Sound Asset Licenses

## 출처별

### Kenney (CC0)
- https://kenney.nl/assets/casino-audio (Casino Audio Pack)
- https://kenney.nl/assets/rpg-audio (RPG Audio)
- https://kenney.nl/assets/sci-fi-sounds (Sci-Fi Sounds)
- 라이선스: **Creative Commons CC0** (퍼블릭 도메인, 무제한 사용)

### Pixabay (Pixabay Content License)
- card-place.mp3 — Universfield의 whip 사운드 (`universfield-whip-05-323597`)
- 라이선스: 크레딧 표시 불필요, 상업/수정 가능, 재배포만 금지

## 매핑

| 파일 | 출처 | 사용 시점 |
|------|------|-----------|
| `card-place.mp3` | Pixabay (Universfield whip-05) | Phase 2/3 카드 도착 ("착") |
| `score-up.ogg` | Kenney Casino · chips-stack-1 | 매칭 카드 회수 완료 시 |
| `emoji-react.ogg` | Kenney Casino · chip-lay-1 | 이모지 반응 클릭 |
| `game-end.ogg` | Kenney Casino · cards-pack-open-2 | 게임 종료 |
| `fly-to-field.ogg` | Kenney Casino · card-slide-1 | Phase 1 — 손패→바닥 비행 |
| `fly-to-flip.ogg` | Kenney Casino · card-fan-1 | Phase 3 — 더미 카드 뒤집기 |
| `fly-to-collected.ogg` | Kenney Casino · card-slide-3 | Phase 4 — 점수판 비행 |

## 후보 폴더 (`candidates/`)

다양한 사운드 후보를 카테고리별로 보관 — 마음에 드는 걸 골라 위 파일에 덮어씌우면 됨.

- `candidates/casino/` — Kenney Casino: card-slide (1~8), card-fan (1~2), card-shove (1~4), card-place (1~4)
- `candidates/rpg/` — Kenney RPG: bookFlip (1~3), cloth (1~4), knifeSlice (1~2), drawKnife (1~3)
- `candidates/scifi/` — Kenney Sci-Fi: laserSmall (000~004), laserRetro (000~004)

## 형식

`.mp3`와 `.ogg` 모두 지원됩니다. Howler.js가 자동으로 사용 가능한 파일을 fallback해서 재생합니다.
