import {
  VideoTrack,
  useIsSpeaking,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';

interface VideoTileProps {
  /** LiveKit 참여자. 없으면 미연결 상태 (UI에 표시) */
  participant?: Participant;
  /** 카메라 트랙 ref. 비디오가 켜져 있으면 publication 존재 + !isMuted */
  cameraTrack?: TrackReferenceOrPlaceholder;
  /** participant 미연결/카메라 OFF 시 표시할 emoji */
  fallbackAvatar: string;
  /** 닉네임 표시 */
  nickname: string;
  /** 본인 카드인지 (오른쪽 상단 "나" 표시) */
  isLocal?: boolean;
}

/**
 * 화상채팅 비디오 카드. 16:9 직사각형.
 *
 * - 참여자 미연결: 플레이어 정보만 표시 (hook 호출 안 함)
 * - 연결됨: ConnectedVideoTile에서 isSpeaking/카메라/마이크 상태 추적
 */
export function VideoTile({
  participant,
  cameraTrack,
  fallbackAvatar,
  nickname,
  isLocal,
}: VideoTileProps) {
  if (!participant) {
    return (
      <TileShell
        nickname={nickname}
        isLocal={isLocal}
        disconnected
      >
        <FallbackAvatar avatar={fallbackAvatar} />
      </TileShell>
    );
  }
  return (
    <ConnectedVideoTile
      participant={participant}
      cameraTrack={cameraTrack}
      fallbackAvatar={fallbackAvatar}
      nickname={nickname}
      isLocal={isLocal}
    />
  );
}

function ConnectedVideoTile({
  participant,
  cameraTrack,
  fallbackAvatar,
  nickname,
  isLocal,
}: VideoTileProps & { participant: Participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const hasCamera =
    cameraTrack?.publication != null && !cameraTrack.publication.isMuted;
  const isMicMuted = !participant.isMicrophoneEnabled;

  return (
    <TileShell nickname={nickname} isLocal={isLocal} isSpeaking={isSpeaking} isMicMuted={isMicMuted}>
      {hasCamera && cameraTrack ? (
        <VideoTrack trackRef={cameraTrack} className="h-full w-full object-cover" />
      ) : (
        <FallbackAvatar avatar={fallbackAvatar} />
      )}
    </TileShell>
  );
}

interface TileShellProps {
  children: React.ReactNode;
  nickname: string;
  isLocal?: boolean;
  isSpeaking?: boolean;
  isMicMuted?: boolean;
  disconnected?: boolean;
}

function TileShell({
  children,
  nickname,
  isLocal,
  isSpeaking,
  isMicMuted,
  disconnected,
}: TileShellProps) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-lg border-2 bg-felt-950 transition-colors ${
        isSpeaking
          ? 'border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.6)]'
          : 'border-felt-800/80'
      } ${disconnected ? 'opacity-50' : ''}`}
    >
      {children}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5">
        <span className="truncate text-[11px] font-bold text-white drop-shadow">
          {nickname}
          {isLocal && <span className="ml-1 text-[9px] text-amber-300">(나)</span>}
        </span>
      </div>

      {isMicMuted && !disconnected && (
        <div
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px]"
          title="마이크 음소거"
        >
          🔇
        </div>
      )}
      {disconnected && (
        <div className="absolute inset-x-0 top-1 flex justify-center">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-felt-300">
            연결 안 됨
          </span>
        </div>
      )}
    </div>
  );
}

function FallbackAvatar({ avatar }: { avatar: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-felt-900 to-felt-950">
      <span className="text-4xl">{avatar}</span>
    </div>
  );
}
