import { useNavigate } from 'react-router';
import type { Card, RoomView } from '@gostop/shared';
import { DECK } from '@gostop/shared';
import { ResultView } from './ResultView.tsx';

/**
 * 결과 화면 미리보기 페이지 (디자인 디버그용).
 * 라우트 /result-demo 로 접속하면 mock 데이터로 ResultView 즉시 표시.
 */
export function ResultDemoView() {
  const navigate = useNavigate();
  const all = DECK as readonly Card[];

  // mock collected — me는 광 2장 + 띠 5장 + 피 8장, ai1은 그보다 적게, ai2는 더 적게
  const me = [
    ...all.filter((c) => c.kind === 'gwang').slice(0, 2),
    ...all.filter((c) => c.kind === 'yeol').slice(0, 3),
    ...all.filter((c) => c.kind === 'ddi').slice(0, 5),
    ...all.filter((c) => c.kind === 'pi').slice(0, 8),
  ];
  const ai1 = [
    ...all.filter((c) => c.kind === 'gwang').slice(2, 3),
    ...all.filter((c) => c.kind === 'yeol').slice(3, 5),
    ...all.filter((c) => c.kind === 'ddi').slice(5, 7),
    ...all.filter((c) => c.kind === 'pi').slice(8, 12),
  ];
  const ai2 = [
    ...all.filter((c) => c.kind === 'pi').slice(12, 18),
    ...all.filter((c) => c.kind === 'ddi').slice(7, 9),
  ];

  const view: RoomView = {
    roomId: 'DEMO',
    hostUserId: 'user-me',
    maxPlayers: 3,
    phase: 'ended',
    players: [
      {
        userId: 'user-me',
        nickname: '나',
        emojiAvatar: '🐶',
        connected: true,
        hand: [],
        handCount: 0,
        collected: me,
        score: 0,
        goCount: 1,
        flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0 },
      },
      {
        userId: 'ai-bot-1',
        nickname: 'GoStop봇',
        emojiAvatar: '🤖',
        connected: true,
        handCount: 0,
        collected: ai1,
        score: 0,
        goCount: 0,
        flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0 },
      },
      {
        userId: 'ai-bot-2',
        nickname: 'GoStop봇 2',
        emojiAvatar: '👽',
        connected: true,
        handCount: 0,
        collected: ai2,
        score: 0,
        goCount: 0,
        flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0 },
      },
    ],
    spectators: [],
    field: [],
    deckCount: 0,
    turnUserId: 'user-me',
    goCount: 1,
    history: [],
    myUserId: 'user-me',
    amSpectator: false,
  };

  return (
    <div className="relative h-full w-full">
      <ResultView view={view} goCounts={{ me: 1, ai1: 0, ai2: 0 }} />
      <button
        onClick={() => navigate('/')}
        className="absolute right-2 top-2 z-50 rounded bg-rose-500/80 px-2 py-1 text-xs font-bold text-white"
      >
        ✕ 데모 닫기
      </button>
    </div>
  );
}
