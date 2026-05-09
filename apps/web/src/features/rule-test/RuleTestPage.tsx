import { useState } from 'react';
import { useNavigate } from 'react-router';
import { executeTurn, type TurnResult } from '@gostop/shared';
import { PRESETS, type RuleTestPreset } from './presets.ts';
import { ResultPanel } from './ResultPanel.tsx';

/**
 * 룰 테스트 페이지 — preset 시나리오로 룰 동작 검증.
 *
 * 결과: executeTurn의 specials + 점수 분해 + 박/배수 적용 점수 표시.
 */
export function RuleTestPage() {
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState<RuleTestPreset | null>(null);
  const [result, setResult] = useState<TurnResult | null>(null);

  function runPreset(preset: RuleTestPreset) {
    setActivePreset(preset);
    if (preset.skipExecute) {
      setResult(null);
      return;
    }
    try {
      const r = executeTurn(
        {
          hand: preset.hand,
          collected: preset.collected,
          field: preset.field,
          deck: preset.deck,
        },
        preset.cardToPlay,
        {
          allowSpecials: true,
          isLastTurn: preset.isLastTurn,
          stuckOwners: preset.stuckOwners ?? {},
          myActorKey: 'me',
        },
      );
      setResult(r);
    } catch (e) {
      console.error(e);
      setResult(null);
    }
  }

  return (
    <div className="min-h-screen bg-felt p-4 text-felt-50">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🧪 룰 테스트</h1>
        <button
          onClick={() => navigate('/')}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
        >
          🏠 로비로
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Preset 선택 */}
        <section className="rounded-lg border border-felt-900/60 bg-felt-900/30 p-4">
          <div className="mb-3 text-sm font-bold text-felt-200">
            📋 시나리오 선택
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => runPreset(p)}
                className={`rounded border p-2 text-left text-xs transition ${
                  activePreset?.id === p.id
                    ? 'border-amber-400 bg-amber-500/20'
                    : 'border-felt-800 bg-felt-950/40 hover:border-amber-400/50'
                }`}
              >
                <div className="font-bold text-felt-100">{p.label}</div>
                <div className="mt-0.5 text-[10px] text-felt-400">
                  {p.description}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 결과 */}
        <section className="rounded-lg border border-felt-900/60 bg-felt-900/30 p-4">
          {activePreset ? (
            <ResultPanel preset={activePreset} result={result} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-felt-400">
              시나리오를 선택하세요 →
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
