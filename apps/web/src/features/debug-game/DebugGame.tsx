import { useMemo, useState } from 'react';
import {
  calculateScore,
  canDeclareGoStop,
  dealNewGame,
  executeTurn,
  getMatchableCardsFromHand,
  type Card as CardType,
  type ScoreBreakdown,
} from '@gostop/shared';
import { Card } from '../../components/Card.tsx';

interface PlayerState {
  hand: CardType[];
  collected: CardType[];
}

interface DebugState {
  p1: PlayerState;
  p2: PlayerState;
  field: CardType[];
  deck: CardType[];
  currentTurn: 'p1' | 'p2';
  history: string[];
}

function initGame(): DebugState {
  const dealt = dealNewGame(['p1', 'p2']);
  return {
    p1: { hand: dealt.hands['p1']!, collected: [] },
    p2: { hand: dealt.hands['p2']!, collected: [] },
    field: dealt.field,
    deck: dealt.deck,
    currentTurn: 'p1',
    history: ['게임 시작 — 카드 분배 완료'],
  };
}

export function DebugGame() {
  const [state, setState] = useState<DebugState>(initGame);

  const currentKey = state.currentTurn;
  const currentPlayer = state[currentKey];

  const matchable = useMemo(
    () => getMatchableCardsFromHand(currentPlayer.hand, state.field),
    [currentPlayer.hand, state.field],
  );
  const matchableIds = useMemo(() => new Set(matchable.map((c) => c.id)), [matchable]);

  const p1Score = calculateScore(state.p1.collected);
  const p2Score = calculateScore(state.p2.collected);

  function playCard(cardId: string) {
    const player = state[currentKey];
    const result = executeTurn(
      {
        hand: player.hand,
        collected: player.collected,
        field: state.field,
        deck: state.deck,
      },
      cardId,
    );

    const playedEvents = result.events
      .map((e) => {
        const action = e.result === 'matched' ? '매칭' : '바닥에 놓음';
        const collected =
          e.collectedCards.length > 0
            ? ` (${e.collectedCards.map((c) => c.id).join(', ')} 가져감)`
            : '';
        return `${e.step === 'play-hand' ? '손패' : '더미'}: ${e.card.id} → ${action}${collected}`;
      })
      .join(' / ');

    setState({
      ...state,
      [currentKey]: {
        hand: result.newState.hand,
        collected: result.newState.collected,
      },
      field: result.newState.field,
      deck: result.newState.deck,
      currentTurn: currentKey === 'p1' ? 'p2' : 'p1',
      history: [
        `[${currentKey.toUpperCase()}] ${playedEvents}`,
        ...state.history,
      ],
    });
  }

  function reset() {
    setState(initGame());
  }

  const gameOver = state.deck.length === 0 && state.p1.hand.length === 0 && state.p2.hand.length === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎴 GoStop — Phase 1 Debug</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            더미: <span className="font-bold text-white">{state.deck.length}</span>장 ·{' '}
            현재턴:{' '}
            <span className={currentKey === 'p1' ? 'text-emerald-400' : 'text-rose-400'}>
              {currentKey.toUpperCase()}
            </span>
          </span>
          <button
            onClick={reset}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
          >
            새 게임
          </button>
        </div>
      </header>

      {/* P2 영역 (상대) */}
      <PlayerArea
        name="P2"
        player={state.p2}
        score={p2Score}
        isCurrent={currentKey === 'p2'}
        matchableIds={currentKey === 'p2' ? matchableIds : new Set()}
        onPlayCard={currentKey === 'p2' && !gameOver ? playCard : undefined}
        showHand
      />

      {/* 바닥 + 더미 */}
      <FieldArea field={state.field} deckCount={state.deck.length} />

      {/* P1 영역 (나) */}
      <PlayerArea
        name="P1"
        player={state.p1}
        score={p1Score}
        isCurrent={currentKey === 'p1'}
        matchableIds={currentKey === 'p1' ? matchableIds : new Set()}
        onPlayCard={currentKey === 'p1' && !gameOver ? playCard : undefined}
        showHand
      />

      {/* 게임 오버 표시 */}
      {gameOver && (
        <div className="mt-6 rounded border border-amber-500/50 bg-amber-500/10 p-4 text-center">
          <div className="text-lg font-bold text-amber-300">게임 종료 (모든 카드 소진)</div>
          <div className="mt-2 text-sm text-slate-300">
            P1: {p1Score.total}점 · P2: {p2Score.total}점 →{' '}
            {p1Score.total === p2Score.total
              ? '무승부'
              : p1Score.total > p2Score.total
                ? 'P1 승!'
                : 'P2 승!'}
          </div>
        </div>
      )}

      {/* 히스토리 */}
      <details className="mt-8" open>
        <summary className="cursor-pointer text-sm text-slate-400">
          액션 히스토리 ({state.history.length})
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {state.history.map((h, i) => (
            <li key={i} className="font-mono">
              {h}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function PlayerArea({
  name,
  player,
  score,
  isCurrent,
  matchableIds,
  onPlayCard,
  showHand,
}: {
  name: string;
  player: PlayerState;
  score: ScoreBreakdown;
  isCurrent: boolean;
  matchableIds: Set<string>;
  onPlayCard?: (cardId: string) => void;
  showHand: boolean;
}) {
  return (
    <section
      className={`my-4 rounded-lg border p-4 ${
        isCurrent ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-800 bg-slate-900/30'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {name} {isCurrent && <span className="text-amber-400">← 차례</span>}
        </h2>
        <ScoreDisplay score={score} />
      </div>

      <div className="mb-2 text-xs text-slate-500">
        손패 ({player.hand.length}){' '}
        {isCurrent && matchableIds.size > 0 && (
          <span className="text-amber-300">— 노란 테두리: 매칭 가능</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {showHand
          ? player.hand.map((c) => (
              <Card
                key={c.id}
                card={c}
                highlight={matchableIds.has(c.id) ? 'matchable' : undefined}
                onClick={onPlayCard ? () => onPlayCard(c.id) : undefined}
              />
            ))
          : player.hand.map((_, i) => <Card key={i} faceDown />)}
      </div>

      {player.collected.length > 0 && (
        <>
          <div className="mt-3 mb-2 text-xs text-slate-500">
            딴패 ({player.collected.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {player.collected.map((c) => (
              <Card key={c.id} card={c} size="sm" />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FieldArea({ field, deckCount }: { field: CardType[]; deckCount: number }) {
  return (
    <section className="my-4 rounded-lg border-2 border-emerald-500/30 bg-emerald-950/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">바닥 ({field.length}장)</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>더미</span>
          <div className="flex h-12 w-8 items-center justify-center rounded bg-rose-950/50 border border-rose-900/50 text-xs text-rose-100/50">
            {deckCount}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {field.map((c) => (
          <Card key={c.id} card={c} />
        ))}
        {field.length === 0 && (
          <div className="text-sm text-slate-600 italic">(바닥 비어있음)</div>
        )}
      </div>
    </section>
  );
}

function ScoreDisplay({ score }: { score: ScoreBreakdown }) {
  const canStop = canDeclareGoStop(score);
  return (
    <div className="flex items-center gap-3 text-xs">
      {score.gwang > 0 && <Badge color="amber">광 {score.gwang}</Badge>}
      {score.yeol > 0 && <Badge color="sky">열끗 {score.yeol}</Badge>}
      {score.godori > 0 && <Badge color="sky">고도리 +{score.godori}</Badge>}
      {score.ddi > 0 && <Badge color="rose">띠 {score.ddi}</Badge>}
      {score.dan > 0 && <Badge color="rose">단 +{score.dan}</Badge>}
      {score.pi > 0 && <Badge color="slate">피 {score.pi}</Badge>}
      <div className={`text-base font-bold ${canStop ? 'text-emerald-400' : 'text-slate-300'}`}>
        총 {score.total}점{canStop && ' ✓'}
      </div>
    </div>
  );
}

function Badge({ color, children }: { color: 'amber' | 'sky' | 'rose' | 'slate'; children: React.ReactNode }) {
  const colors = {
    amber: 'bg-amber-500/20 text-amber-300',
    sky: 'bg-sky-500/20 text-sky-300',
    rose: 'bg-rose-500/20 text-rose-300',
    slate: 'bg-slate-500/20 text-slate-300',
  };
  return <span className={`rounded px-1.5 py-0.5 ${colors[color]}`}>{children}</span>;
}
