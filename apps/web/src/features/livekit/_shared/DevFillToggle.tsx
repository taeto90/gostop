import { useDevTestStore } from '../../../stores/devTestStore.ts';

const OPTIONS = [0, 1, 2, 3, 4, 5];

/**
 * DEV 환경에서 화상 placeholder 인원 토글. 실제 참여자 수 위에 N명까지 채움.
 * 운영 배포 시 default 0 + 부모가 `import.meta.env.DEV`로 표시 가드.
 */
export function DevFillToggle() {
  const fillCount = useDevTestStore((s) => s.videoFillCount);
  const setFillCount = useDevTestStore((s) => s.setVideoFillCount);
  return (
    <div className="mt-1 flex items-center gap-1 rounded bg-felt-950/40 px-2 py-1">
      <span className="text-[9px] font-bold text-felt-400">🧪</span>
      <span className="text-[9px] text-felt-500">테스트</span>
      <div className="ml-auto flex gap-0.5">
        {OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setFillCount(n)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
              fillCount === n
                ? 'bg-amber-500/30 text-amber-200'
                : 'text-felt-500 hover:bg-felt-800/60'
            }`}
            title={n === 0 ? '실제 참여자만' : `${n}명 placeholder`}
          >
            {n === 0 ? '실' : n}
          </button>
        ))}
      </div>
    </div>
  );
}
