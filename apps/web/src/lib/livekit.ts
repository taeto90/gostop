/**
 * LiveKit 토큰 fetch + 미디어 prefs 영속화.
 *
 * 토큰: 서버 `/api/livekit/token` 호출.
 * 미디어 prefs (카메라/마이크 ON/OFF): localStorage에 저장.
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

interface FetchTokenParams {
  roomId: string;
  participantId: string;
  participantName: string;
  canPublish: boolean;
  /** 음성 전용 모드 — true면 server가 video publish 권한 X로 발급 */
  voiceOnly?: boolean;
}

export interface LiveKitTokenResponse {
  token: string;
  livekitUrl: string;
}

export async function fetchLiveKitToken(
  params: FetchTokenParams,
): Promise<LiveKitTokenResponse> {
  const res = await fetch(`${SERVER_URL}/api/livekit/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`LiveKit token fetch failed: ${res.status}`);
  }
  return (await res.json()) as LiveKitTokenResponse;
}

const CAM_KEY = 'gostop:livekit-cam';
const MIC_KEY = 'gostop:livekit-mic';
const SIDEBAR_OPEN_KEY = 'gostop:video-sidebar-open';

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return v === '1';
  } catch {
    return fallback;
  }
}

function saveBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** 카메라 초기 상태 — 기본 OFF (사용자 답변 1: B 정책) */
export function loadCameraPref(): boolean {
  return loadBool(CAM_KEY, false);
}
export function saveCameraPref(value: boolean): void {
  saveBool(CAM_KEY, value);
}

/** 마이크 초기 상태 — 기본 OFF */
export function loadMicrophonePref(): boolean {
  return loadBool(MIC_KEY, false);
}
export function saveMicrophonePref(value: boolean): void {
  saveBool(MIC_KEY, value);
}

/** 사이드바 펼침 상태 — 기본 PC=ON */
export function loadSidebarOpenPref(): boolean {
  return loadBool(SIDEBAR_OPEN_KEY, true);
}
export function saveSidebarOpenPref(value: boolean): void {
  saveBool(SIDEBAR_OPEN_KEY, value);
}
