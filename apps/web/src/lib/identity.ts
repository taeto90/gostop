const USER_ID_KEY = 'gostop:userId';
const PROFILE_KEY = 'gostop:profile';

export interface Profile {
  userId: string;
  nickname: string;
  emojiAvatar: string;
}

function generateUserId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `u_${ts}_${rand}`;
}

export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const id = generateUserId();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}

export function loadProfile(): Profile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Profile;
    if (
      typeof parsed.userId === 'string' &&
      typeof parsed.nickname === 'string' &&
      typeof parsed.emojiAvatar === 'string'
    ) {
      return parsed;
    }
  } catch {
    // 손상된 데이터 무시
  }
  return null;
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(USER_ID_KEY, profile.userId);
}
