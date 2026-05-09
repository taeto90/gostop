# Special Event Sounds

게임 중 특수 이벤트(뻑/자뻑/따닥/쪽/싹쓸이/폭탄/흔들기/총통/고/스톱/박/멍따/나가리)에 대한 사운드 효과.

파일 없어도 앱 정상 동작 (silent fail). 매핑은 `apps/web/src/lib/sound.ts`의 `SOUND_FILES`에서 관리.

---

## 필요한 사운드 파일

| 파일명 (예상) | 이벤트 | 길이 | 분위기 |
|---|---|---|---|
| `ppeok.ogg` | 뻑 (싸기) | 0.3초 | 둔탁한 "퉁" — 실패 / 묶임 느낌 |
| `ja-ppeok.ogg` | **자뻑** (본인이 싼 뻑 회수) | 1초 | 환호 + chime — "오!" 보너스 |
| `ttadak.ogg` | 따닥 | 0.5초 | 빠른 두 번 "탁탁" |
| `jjok.ogg` | 쪽 | 0.4초 | "쪽!" 입맞춤 / 가벼운 pop |
| `sweep.ogg` | 싹쓸이 | 0.6초 | 빗자루 "쓱" 소리, 또는 sweep whoosh |
| `bomb.ogg` | 폭탄 | 0.8초 | 폭발 "쾅!" |
| `shake.ogg` | 흔들기 | 0.5초 | 흔드는 rattle 또는 떨림 |
| `chongtong.ogg` | 총통 | 1.5초 | 트럼펫/팡파르 — 즉시 승리 |
| `go.ogg` | 고 | 0.8초 | 드럼롤 또는 "고고고!" |
| `stop.ogg` | 스톱 | 0.6초 | 종소리 "땅!" / 결정타 |
| `bak.ogg` | 박 (피박/광박/멍박) | 0.5초 | 도장 찍는 "쾅" / stamp |
| `myungttadak.ogg` | 멍따 (끗 7장) | 1초 | 환호 + chime |
| `nagari.ogg` | 나가리 (무승부) | 1초 | 슬픈 wah-wah-wah |

---

## 기존 candidates에서 매핑 가능한 후보

이미 받은 Kenney 패키지 (`../candidates/`)에서 적절한 후보:

| 이벤트 | candidates 매핑 후보 | 비고 |
|---|---|---|
| **뻑** | `rpg/cloth1.ogg` | 둔탁한 천 소리, 묶임 느낌 |
| **자뻑** | `casino/card-fan-1.ogg` | 펼쳐지는 화려한 카드 |
| **따닥** | `casino/card-shove-2.ogg` | 빠른 두 번 |
| **쪽** | `casino/card-place-1.ogg` | 또렷한 "딱" |
| **싹쓸이** | `rpg/cloth4.ogg` | 천 쓸리는 swish |
| **흔들기** | `rpg/cloth3.ogg` | 흔들림 (또는 별도 다운) |
| **고** | `casino/card-slide-7.ogg` | 강한 sliding (또는 별도 다운) |
| **스톱** | `casino/card-place-3.ogg` | 끝맺음 "딱" |

> 사용자가 듣고 어울리는 것 골라 events/에 복사:
> ```powershell
> copy ..\candidates\rpg\cloth1.ogg ppeok.ogg
> copy ..\candidates\casino\card-fan-1.ogg ja-ppeok.ogg
> ```

---

## 직접 다운이 필요한 사운드 (candidates에 없음)

다음 사운드는 Kenney 패키지에 없어 별도 다운 권장:

| 파일 | 검색어 (Pixabay/Freesound/Mixkit) | 추천 |
|---|---|---|
| `bomb.ogg` | "explosion short", "boom small" | 짧은 0.5~1초 |
| `chongtong.ogg` | "fanfare short", "trumpet victory" | 1초 내외 |
| `go.ogg` | "drum roll short", "war drum hit" | 강조 |
| `bak.ogg` | "stamp", "rubber stamp", "thud heavy" | 도장 |
| `myungttadak.ogg` | "cheer short", "achievement", "fanfare" | 환호 |
| `nagari.ogg` | "wah wah trombone", "sad horn", "fail" | 실망 |

### 추천 사이트 (CC0 / 무료)
- **Pixabay Sound** — https://pixabay.com/sound-effects/ (무료, 회원가입 권장)
- **Mixkit** — https://mixkit.co/free-sound-effects/ (CC0)
- **Freesound** — https://freesound.org/ (CC0 필터 검색)
- **Kenney UI Audio** — https://kenney.nl/assets/ui-audio (CC0, 사이트 직접 다운)
- **Kenney Impact Sounds** — https://kenney.nl/assets/impact-sounds (CC0)

---

## 사운드 추가 후 코드 연결

새 사운드 파일을 events/에 넣은 후:

1. `apps/web/src/lib/sound.ts`의 `SoundName` 타입에 이벤트명 추가
2. `SOUND_FILES` Record에 매핑 추가:
   ```ts
   const SOUND_FILES: Record<SoundName, string> = {
     // 기존...
     'ppeok': 'events/ppeok.ogg',
     'ja-ppeok': 'events/ja-ppeok.ogg',
     // ...
   };
   ```
3. 게임 로직에서 `playSound('ppeok')` 등 호출 (룰 엔진이 특수 이벤트 감지 시점)

---

## 라이선스

CC0 외 라이선스 파일 사용 시 `../LICENSES.md`에 출처 명시.
