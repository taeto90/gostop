import { useCallback, useRef, useState } from 'react';

interface TabRecorderState {
  recording: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useTabRecorder(): TabRecorderState {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gostop-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        chunksRef.current = [];
        setRecording(false);
      };

      // 사용자가 브라우저 공유 중지 시 자동 stop
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
        recorderRef.current = null;
        streamRef.current = null;
      });

      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      // 사용자가 탭 공유 거부
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
  }, []);

  return { recording, start, stop };
}
