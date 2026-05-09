# Sound Assets

사운드 효과 파일을 이 폴더에 배치하면 자동 재생됩니다. 파일 없어도 앱은 정상 동작합니다.

## 필요한 파일 (둘 중 하나면 됨, .mp3 우선)

| 파일명 | 사용 시점 | 추천 분위기 |
|--------|---------|-----------|
| `card-place.mp3` / `.ogg` | 카드 착지 (Phase 2) | 짧고 나무판 두드리는 듯한 "딱" 소리 |
| `card-match.mp3` / `.ogg` | 카드 매칭 시 | 부드러운 chime, 0.3초 |
| `score-up.mp3` / `.ogg` | 점수 획득 시 | 띠리링, 상승 톤 |
| `emoji-react.mp3` / `.ogg` | 이모지 반응 클릭 시 | 짧은 pop |
| `game-end.mp3` / `.ogg` | 게임 종료 시 | 결과 팡파르 |
| `fly-to-field.ogg` | Phase 1 — 손패→바닥 비행 | 카드가 미끄러지는 swoosh |
| `fly-to-flip.ogg` | Phase 3 — 더미 flip→빈자리 | 카드 뒤집어 펼쳐지는 효과 |
| `fly-to-collected.ogg` | Phase 4 — 점수판으로 이동 | 짧은 drop / select |

## Fly 사운드 후보 교체 방법

`candidates/` 폴더에 카테고리별 후보 사운드들이 있습니다. 마음에 드는 걸 골라 덮어쓰기:

```powershell
# 예: fly-to-field 사운드를 cloth1로 변경
copy candidates\rpg\cloth1.ogg fly-to-field.ogg
```

**현재 매핑 (기본값):**
- `fly-to-field.ogg` ← `candidates/casino/card-slide-1.ogg`
- `fly-to-flip.ogg`  ← `candidates/casino/card-fan-1.ogg`
- `fly-to-collected.ogg` ← `candidates/casino/card-slide-3.ogg`

**후보 카테고리:**
- `candidates/casino/` — 카드 전용 (card-slide 1~8, card-fan 1~2, card-shove 1~4, card-place 1~4)
- `candidates/rpg/` — 천/책장 (cloth 1~4, bookFlip 1~3, knifeSlice 1~2, drawKnife 1~3)
- `candidates/scifi/` — 미래 (laserSmall 000~004, laserRetro 000~004)

## 특수 이벤트 사운드 (events/)

뻑/자뻑/따닥/쪽/싹쓸이/폭탄/흔들기/총통/고/스톱/박/멍따/나가리 등 게임 중
특수 이벤트 사운드는 별도 `events/` 폴더에서 관리. 자세한 매핑은 `events/README.md` 참고.

## 추천 출처 (CC0 무료)

- **freesound.org** (CC0 필터 검색)
- **opengameart.org** (sfx 카테고리)
- **kenney.nl/assets/category:Audio** (모두 CC0)
- **mixkit.co/free-sound-effects/** (무료 라이선스)

## 라이선스 표시

CC0 외 다른 라이선스 파일 사용 시 이 폴더에 `LICENSES.md` 추가하여 출처 명시 권장.

## 음소거

사용자는 게임 내에서 사운드를 음소거할 수 있습니다 (Phase 5 후속 작업에서 UI 추가).
설정은 `localStorage['gostop:muted']`에 저장됩니다.
