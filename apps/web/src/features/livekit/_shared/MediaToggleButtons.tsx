import { useEffect, useState } from 'react';
import {
  useLocalParticipant,
  useMaybeRoomContext,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { saveCameraPref, saveMicrophonePref } from '../../../lib/livekit.ts';

interface MediaToggleButtonsProps {
  /** 'compact' = 작은 아이콘 2개 (모바일 헤더), 'full' = 라벨+ON/OFF (설정 모달) */
  variant?: 'compact' | 'full';
  /** 음성 전용 모드 — 카메라 토글 숨김 */
  voiceOnly?: boolean;
}

/**
 * 카메라/마이크 토글. LiveKit Room context 안에서만 사용 (없으면 null).
 * voiceOnly 모드면 카메라 토글 자체를 안 보임 (server token이 video publish 권한 X).
 */
export function MediaToggleButtons({
  variant = 'full',
  voiceOnly = false,
}: MediaToggleButtonsProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <ConnectedToggle variant={variant} voiceOnly={voiceOnly} />;
}

function ConnectedToggle({
  variant,
  voiceOnly,
}: {
  variant: 'compact' | 'full';
  voiceOnly: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [camOn, setCamOn] = useState(localParticipant.isCameraEnabled);
  const [micOn, setMicOn] = useState(localParticipant.isMicrophoneEnabled);
  const [busy, setBusy] = useState(false);
  const isConnected = room.state === ConnectionState.Connected;

  useEffect(() => {
    setCamOn(localParticipant.isCameraEnabled);
    setMicOn(localParticipant.isMicrophoneEnabled);
  }, [localParticipant.isCameraEnabled, localParticipant.isMicrophoneEnabled]);

  async function toggle(kind: 'cam' | 'mic') {
    if (busy || !isConnected) return;
    setBusy(true);
    try {
      if (kind === 'cam') {
        const next = !camOn;
        await localParticipant.setCameraEnabled(next);
        setCamOn(next);
        saveCameraPref(next);
      } else {
        const next = !micOn;
        await localParticipant.setMicrophoneEnabled(next);
        setMicOn(next);
        saveMicrophonePref(next);
      }
    } catch (e) {
      console.warn(`[livekit] ${kind} toggle failed:`, e);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !isConnected;
  const Toggle = variant === 'compact' ? CompactToggle : FullToggle;

  return (
    <>
      {!voiceOnly && (
        <Toggle
          active={camOn}
          disabled={disabled}
          onClick={() => toggle('cam')}
          onIcon="📹"
          offIcon="🎬"
          label="카메라"
        />
      )}
      <Toggle
        active={micOn}
        disabled={disabled}
        onClick={() => toggle('mic')}
        onIcon="🎙️"
        offIcon="🔇"
        label="마이크"
      />
    </>
  );
}

interface ToggleProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  onIcon: string;
  offIcon: string;
  label: string;
}

function CompactToggle({ active, disabled, onClick, onIcon, offIcon, label }: ToggleProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded text-base transition disabled:opacity-50 ${
        active
          ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
          : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
      }`}
      title={active ? `${label} 끄기` : `${label} 켜기`}
    >
      {active ? onIcon : offIcon}
    </button>
  );
}

function FullToggle({ active, disabled, onClick, onIcon, offIcon, label }: ToggleProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
        active
          ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200'
          : 'border-felt-700/60 bg-felt-950/60 text-felt-300 hover:bg-felt-800'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="text-base">{active ? onIcon : offIcon}</span>
        <span>{label}</span>
      </span>
      <span className="font-bold">{active ? 'ON' : 'OFF'}</span>
    </button>
  );
}
