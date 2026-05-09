import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { config } from '../config.ts';

export interface TokenRequest {
  roomId: string;
  participantId: string;
  participantName: string;
  canPublish: boolean;
  /** 음성 전용 모드 — true면 카메라 publish 권한 X (마이크만 허용) */
  voiceOnly?: boolean;
}

/**
 * LiveKit AccessToken 발급.
 *
 * - identity: participantId (우리 userId)
 * - name: participantName (UI 표시용)
 * - canPublish: 관전자는 false, 플레이어는 true
 * - voiceOnly=true면 canPublishSources를 마이크/데이터로 제한 (서버 측 강제)
 */
export async function generateLiveKitToken(req: TokenRequest): Promise<string> {
  if (!config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
    throw new Error('LiveKit API key/secret not configured (.env 확인)');
  }

  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: req.participantId,
    name: req.participantName,
    ttl: 60 * 60,
  });
  at.addGrant({
    roomJoin: true,
    room: req.roomId,
    canPublish: req.canPublish,
    canSubscribe: true,
    canPublishData: true,
    // 음성 전용 모드 — 마이크만 publish 가능 (카메라/화면공유 차단)
    canPublishSources: req.voiceOnly
      ? [TrackSource.MICROPHONE]
      : undefined,
  });
  return at.toJwt();
}
