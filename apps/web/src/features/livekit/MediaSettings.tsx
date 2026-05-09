import { useMaybeRoomContext } from '@livekit/components-react';
import { MediaToggleButtons } from './_shared/MediaToggleButtons.tsx';

interface MediaSettingsProps {
  /** 음성 전용 모드 — 카메라 토글 숨김 + 라벨 변경 */
  voiceOnly?: boolean;
}

/**
 * 설정 모달의 카메라/마이크 토글 섹션.
 * LiveKit context 없으면 (토큰 fetch 중) "연결 중" 안내만 표시.
 */
export function MediaSettings({ voiceOnly = false }: MediaSettingsProps) {
  const room = useMaybeRoomContext();
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-bold text-felt-300">
        {voiceOnly ? '🎙️ 음성 채팅 (카메라 X)' : '🎥 화상채팅'}
      </div>
      {!room ? (
        <div className="rounded bg-felt-950/40 px-3 py-3 text-center text-xs text-felt-400">
          연결 중...
        </div>
      ) : (
        <MediaToggleButtons variant="full" voiceOnly={voiceOnly} />
      )}
    </div>
  );
}
