import { useCallback, useMemo } from 'react';
import { useParticipants, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { RoomView } from '@gostop/shared';
import { VideoTile } from '../VideoTile.tsx';
import { PlaceholderTile } from './PlaceholderTile.tsx';
import { isPlaceholder, type MemberLike } from './types.ts';

/**
 * LiveKit 참여자/카메라 트랙을 매핑해 멤버를 카드로 렌더하는 함수 반환.
 *
 * **반드시 LiveKit `<LiveKitRoom>` context 안에서만 호출** (useParticipants/useTracks 사용).
 * 호출 위치는 `useMaybeRoomContext()`로 검증 후 inner 컴포넌트에서.
 *
 * placeholder 멤버는 `PlaceholderTile`, 실제 멤버는 `VideoTile` 렌더.
 */
export function useVideoTileRenderer(
  view: RoomView,
): (m: MemberLike) => React.ReactNode {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);

  const participantByIdentity = useMemo(
    () => new Map(participants.map((p) => [p.identity, p])),
    [participants],
  );
  const cameraByIdentity = useMemo(
    () => new Map(cameraTracks.map((t) => [t.participant.identity, t])),
    [cameraTracks],
  );

  return useCallback(
    (member: MemberLike) => {
      if (isPlaceholder(member.userId)) {
        return (
          <PlaceholderTile avatar={member.emojiAvatar} name={member.nickname} />
        );
      }
      return (
        <VideoTile
          participant={participantByIdentity.get(member.userId)}
          cameraTrack={cameraByIdentity.get(member.userId)}
          fallbackAvatar={member.emojiAvatar}
          nickname={member.nickname}
          isLocal={member.userId === view.myUserId}
        />
      );
    },
    [participantByIdentity, cameraByIdentity, view.myUserId],
  );
}
