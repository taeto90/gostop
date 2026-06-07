import { useMemo, useState } from 'react';
import type { PlayerStateView, RoomView } from '@gostop/shared';
import { DECK, defaultRoomRules } from '@gostop/shared';
import { MediaTilesPanel } from '../livekit/MediaTilesPanel.tsx';
import { GameView } from '../room/GameView.tsx';

/**
 * 개발용 — GameView UI 데모 (mock RoomView, socket/auth 불필요).
 *
 * `/game-demo` (DEV 전용, App.tsx 인증 게이트 앞에서 분기) — playwright 캡처 +
 * PC 레이아웃 디자인 빠른 검증용. /result-demo의 GameView 버전.
 * 우상단 토글로 2인/3인 전환.
 */

const gwangs = DECK.filter((c) => c.kind === 'gwang');
const yeols = DECK.filter((c) => c.kind === 'yeol');
const ddis = DECK.filter((c) => c.kind === 'ddi');
const pis = DECK.filter((c) => c.kind === 'pi');

function mkPlayer(
  userId: string,
  nickname: string,
  emojiAvatar: string,
  collected: PlayerStateView['collected'],
  opts: { hand?: PlayerStateView['hand']; handCount?: number; goCount?: number } = {},
): PlayerStateView {
  return {
    userId,
    nickname,
    emojiAvatar,
    connected: true,
    hand: opts.hand,
    handCount: opts.hand?.length ?? opts.handCount ?? 0,
    collected,
    score: 0,
    goCount: opts.goCount ?? 0,
    flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0, consecutiveAutoTurns: 0 },
  };
}

function buildMockView(playerCount: 2 | 3): RoomView {
  const me = mkPlayer(
    'demo-me',
    '나 (방장)',
    '🧑',
    // 내 딴패도 대량 — 좌측 패널 다중 줄 확인용. 상대와 카드 중복 OK (테스트 전용,
    // 단 layoutId 중복으로 framer 보간이 어색할 수 있음 — 시각 확인 용도로만)
    [...gwangs.slice(0, 3), ...yeols.slice(0, 6), ...ddis.slice(0, 7), ...pis.slice(0, 14)],
    // 손패 10장 (상대 카드와 중복 — 테스트 전용)
    { hand: [...yeols.slice(6, 9), ...ddis.slice(7, 10), ...pis.slice(14, 18)] },
  );
  const opp1 = mkPlayer(
    'demo-opp1',
    '김복순',
    '👵',
    // 딴패 대량 — 끗 5(1줄 꽉)·띠 7(5+2 2줄)·피 15장(쌍피 포함, 10점/줄 청킹) 검증용
    [...gwangs.slice(3, 5), ...yeols.slice(2, 7), ...ddis.slice(3, 10), ...pis.slice(4, 19)],
    { handCount: 7, goCount: 1 },
  );
  const opp2 = mkPlayer(
    'demo-opp2',
    '이영수',
    '👴',
    [...yeols.slice(7, 8), ...pis.slice(19, 21)],
    { handCount: 6 },
  );

  const players = playerCount === 2 ? [opp1, me] : [opp1, opp2, me];

  return {
    roomId: 'DEMO01',
    hostUserId: 'demo-me',
    maxPlayers: playerCount === 2 ? 2 : 3,
    phase: 'playing',
    players,
    spectators: [
      { userId: 'demo-spec1', nickname: '박영희', emojiAvatar: '👩', connected: true },
    ],
    field: [...pis.slice(21, 22), ...yeols.slice(8, 9)],
    deckCount: 20,
    turnUserId: 'demo-me',
    goCount: 0,
    history: [],
    myUserId: 'demo-me',
    amSpectator: false,
    nagariMultiplier: 2,
    rules: defaultRoomRules(),
    lastTurnSpecials: null,
    turnSeq: 0,
    gameInstanceId: 1,
  };
}

export function GameDemoView() {
  const [playerCount, setPlayerCount] = useState<2 | 3>(3);
  const view = useMemo(() => buildMockView(playerCount), [playerCount]);

  return (
    <div className="h-screen w-screen">
      <GameView
        key={playerCount}
        view={view}
        onPlayCard={() => {}}
        onLeave={() => {}}
        videoSidebar={<MediaTilesPanel view={view} />}
      />
      {/* 데모 전용 — 인원 토글 */}
      <button
        onClick={() => setPlayerCount((n) => (n === 2 ? 3 : 2))}
        className="fixed bottom-2 right-2 z-[100] rounded-full border border-rose-500/60 bg-rose-950/90 px-3 py-1 text-xs font-bold text-rose-100 hover:bg-rose-900"
      >
        🧪 {playerCount}인 (클릭: {playerCount === 2 ? 3 : 2}인)
      </button>
    </div>
  );
}
