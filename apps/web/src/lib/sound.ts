import { Howl, Howler } from 'howler';

/**
 * 사운드 매니저.
 *
 * 사운드 파일은 `apps/web/public/assets/sounds/` 폴더에 배치:
 * - card-place.mp3 — 카드 놓는 소리
 * - card-match.mp3 — 매칭 chime
 * - score-up.mp3   — 점수 획득
 * - emoji-react.mp3 — 이모지 반응 pop
 * - game-end.mp3   — 게임 종료
 *
 * 파일이 없어도 silent fail (앱 정상 동작).
 * 사용자가 freesound.org 등에서 CC0 라이선스 효과음을 받아 넣으면 자동 재생.
 */

export type SoundName =
  | 'card-place'
  | 'score-up'
  | 'emoji-react'
  | 'game-end'
  | 'fly-to-field'
  | 'fly-to-flip'
  | 'fly-to-collected'
  | 'boom';

/** sound key → 실제 파일명. 확장자가 다를 수 있어 명시. */
const SOUND_FILES: Record<SoundName, string> = {
  'card-place': 'card-place.mp3',
  'score-up': 'score-up.ogg',
  'emoji-react': 'emoji-react.ogg',
  'game-end': 'game-end.ogg',
  'fly-to-field': 'fly-to-field.ogg',
  'fly-to-flip': 'fly-to-flip.ogg',
  'fly-to-collected': 'fly-to-collected.ogg',
  boom: 'boom.mp3',
};

const sounds: Partial<Record<SoundName, Howl>> = {};
let muted = loadMutePreference();
let volume = loadVolumePreference();

// 시작 시 전역 master volume 적용
Howler.volume(volume);

function loadMutePreference(): boolean {
  try {
    return localStorage.getItem('gostop:muted') === '1';
  } catch {
    return false;
  }
}

function loadVolumePreference(): number {
  try {
    const raw = localStorage.getItem('gostop:volume');
    if (raw == null) return 0.5;
    const v = Number(raw);
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
    return 0.5;
  } catch {
    return 0.5;
  }
}

function getSound(name: SoundName): Howl | null {
  if (sounds[name]) return sounds[name]!;
  try {
    const file = SOUND_FILES[name];
    const ext = file.split('.').pop() ?? 'ogg';
    const howl = new Howl({
      src: [`/assets/sounds/${file}`],
      format: [ext],
      volume: 0.5,
      preload: true,
      html5: false,
      onloaderror: (_id, err) => {
        if (import.meta.env.DEV) {
          console.warn(`[sound] ${name} load failed:`, err);
        }
      },
    });
    sounds[name] = howl;
    return howl;
  } catch (e) {
    if (import.meta.env.DEV) console.warn(`[sound] ${name} init failed:`, e);
    return null;
  }
}

/**
 * 효과음 재생. 파일 없으면 silent fail.
 */
export function playSound(name: SoundName): void {
  if (muted) return;
  const sound = getSound(name);
  if (!sound) return;
  try {
    sound.play();
  } catch {
    // ignore (autoplay 차단 등)
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem('gostop:muted', value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isMuted(): boolean {
  return muted;
}

/** 전역 master volume (0~1). Howler.volume()을 통해 모든 사운드에 일괄 적용. */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  Howler.volume(volume);
  try {
    localStorage.setItem('gostop:volume', String(volume));
  } catch {
    /* ignore */
  }
}

export function getVolume(): number {
  return volume;
}
