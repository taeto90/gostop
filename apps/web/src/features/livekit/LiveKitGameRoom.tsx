import { useEffect, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import {
  fetchLiveKitToken,
  loadCameraPref,
  loadMicrophonePref,
} from '../../lib/livekit.ts';

interface LiveKitGameRoomProps {
  roomId: string;
  userId: string;
  nickname: string;
  /** 관전자는 false → publish 권한 없음. 기본은 player */
  canPublish?: boolean;
  /** false면 LiveKit 연결 비활성 — 토큰 fetch X, children만 렌더 */
  enabled?: boolean;
  /** 음성 전용 모드 — 카메라 publish 비활성 (server token도 mic만 허용) */
  voiceOnly?: boolean;
  children: React.ReactNode;
}

/**
 * 멀티 게임 방에서 LiveKit Room을 자동 연결.
 *
 * - 토큰을 서버에서 fetch (voiceOnly 시 server가 video publish 권한 X로 발급)
 * - LiveKitRoom으로 children 감쌈 → 자식들에서 useTracks 등 사용 가능
 * - 카메라/마이크 초기 상태는 localStorage prefs 따름 (기본 OFF)
 * - voiceOnly 모드면 video 초기 상태는 항상 false (사용자 prefs 무시)
 * - 토큰 fetch 실패 시 children만 렌더 (게임은 진행되도록)
 */
export function LiveKitGameRoom({
  roomId,
  userId,
  nickname,
  canPublish = true,
  enabled = true,
  voiceOnly = false,
  children,
}: LiveKitGameRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setToken(null);
      setServerUrl(null);
      return;
    }
    let cancelled = false;
    fetchLiveKitToken({
      roomId,
      participantId: userId,
      participantName: nickname,
      canPublish,
      voiceOnly,
    })
      .then((res) => {
        if (cancelled) return;
        setToken(res.token);
        setServerUrl(res.livekitUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[livekit] token fetch failed:', err);
        setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, userId, nickname, canPublish, enabled, voiceOnly]);

  const initialAudio = loadMicrophonePref();
  // 음성 전용 모드면 video 초기 상태 강제 false
  const initialVideo = voiceOnly ? false : loadCameraPref();

  // LiveKitRoom을 항상 mount 상태로 두고 connect prop으로만 토글.
  // token이 없거나 disabled일 때 unmount하면 children(GameView/RoomLobbyModal)도
  // 함께 unmount되어 깜빡임 + 모든 컴포넌트 재마운트가 발생함.
  // LiveKit이 재연결될 때도 동일 — children은 그대로 두고 LiveKit만 재연결.
  const shouldConnect = enabled && !!token && !!serverUrl && !error;

  return (
    <LiveKitRoom
      token={token ?? undefined}
      serverUrl={serverUrl ?? undefined}
      connect={shouldConnect}
      audio={initialAudio}
      video={initialVideo}
      data-lk-theme="default"
      style={{ height: '100%', width: '100%' }}
    >
      {shouldConnect && <RoomAudioRenderer />}
      {children}
    </LiveKitRoom>
  );
}
