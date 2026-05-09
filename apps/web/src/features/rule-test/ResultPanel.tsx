import { useMemo } from 'react';
import {
  calculateFinalScore,
  calculateScore,
  getCardById,
  type Card as CardType,
  type TurnResult,
} from '@gostop/shared';
import { Card } from '../../components/Card.tsx';
import type { RuleTestPreset } from './presets.ts';

export function ResultPanel({
  preset,
  result,
}: {
  preset: RuleTestPreset;
  result: TurnResult | null;
}) {
  const card = (id: string) => getCardById(id);
  const handCards = preset.hand;
  const fieldCards = preset.field;

  // executeTurn 직접 호출이 아닌 preset(예: 박/멍따)은 finalScore 계산
  const finalScore = useMemo(() => {
    if (!preset.evaluateAsFinal) return null;
    const collected = preset.collected;
    const opponents = preset.opponents ?? [];
    return calculateFinalScore(collected, opponents, {
      goCount: preset.goCount ?? 0,
      shookCount: preset.shookCount ?? 0,
      bombCount: preset.bombCount ?? 0,
      gobak: preset.gobak,
      chongtong: preset.chongtong,
      ppeoksCausedWin: preset.ppeoksCausedWin,
      nagariMultiplier: preset.nagariMultiplier ?? 1,
      allowMyungttadak: preset.allowMyungttadak ?? true,
    });
  }, [preset]);

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <div className="text-[10px] font-bold text-felt-400">시나리오</div>
        <div className="text-sm font-bold text-felt-100">{preset.label}</div>
        <div className="text-[11px] text-felt-300">{preset.description}</div>
      </div>

      {handCards.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold text-felt-400">
            손패 ({handCards.length}장)
            {preset.cardToPlay && (
              <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">
                클릭: {card(preset.cardToPlay)?.name ?? preset.cardToPlay}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {handCards.map((c) => (
              <Card key={c.id} card={c} width={32} />
            ))}
          </div>
        </div>
      )}

      {fieldCards.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold text-felt-400">
            바닥 ({fieldCards.length}장)
          </div>
          <div className="flex flex-wrap gap-1">
            {fieldCards.map((c) => (
              <Card key={c.id} card={c} width={32} />
            ))}
          </div>
        </div>
      )}

      {preset.deck.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold text-felt-400">
            더미 ({preset.deck.length}장) — 첫 카드: {preset.deck[0]?.name}
          </div>
          <div className="flex flex-wrap gap-1">
            {preset.deck.slice(0, 5).map((c) => (
              <Card key={c.id} card={c} width={28} />
            ))}
            {preset.deck.length > 5 && (
              <span className="self-center text-felt-500">
                +{preset.deck.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="mb-2 text-[10px] font-bold text-amber-300">
            🎯 turn 결과
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <SpecialsList specials={result.specials} />
            <div>
              <div className="font-bold text-felt-200">획득 카드</div>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {result.newState.collected.map((c) => (
                  <Card key={c.id} card={c} width={22} />
                ))}
                {result.newState.collected.length === 0 && (
                  <span className="text-felt-500">없음</span>
                )}
              </div>
            </div>
          </div>
          <ScoreBreakdownPanel collected={result.newState.collected} />
        </div>
      )}

      {finalScore && (
        <div className="mt-2 rounded border border-emerald-500/40 bg-emerald-500/10 p-3">
          <div className="mb-2 text-[10px] font-bold text-emerald-300">
            🏆 최종 점수 (박/배수 적용)
          </div>
          <div className="text-[11px] text-felt-100">
            base {finalScore.baseTotal}점 + go {finalScore.flags.goCount} ={' '}
            {finalScore.bonusedTotal}점 × multiplier {finalScore.multiplier} ={' '}
            <span className="text-lg font-extrabold text-emerald-200">
              {finalScore.finalTotal}점
            </span>
          </div>
          <FlagsList flags={finalScore.flags} />
        </div>
      )}
    </div>
  );
}

function SpecialsList({ specials }: { specials: TurnResult['specials'] }) {
  const items: { label: string; value: string }[] = [];
  if (specials.bomb) items.push({ label: '💣 폭탄', value: 'true' });
  if (specials.ttadak) items.push({ label: '✨ 따닥', value: 'true' });
  if (specials.jjok) items.push({ label: '💋 쪽', value: 'true' });
  if (specials.sweep) items.push({ label: '🧹 싹쓸이', value: 'true' });
  if (specials.ppeokMonth !== undefined)
    items.push({ label: '🚫 뻑', value: `${specials.ppeokMonth}월` });
  if (specials.recoveredMonth !== undefined)
    items.push({
      label: specials.isOwnRecover ? '💥 자뻑 회수' : '↺ 일반 회수',
      value: `${specials.recoveredMonth}월`,
    });
  items.push({ label: '🩸 stealPi', value: String(specials.stealPi) });
  return (
    <div>
      <div className="font-bold text-felt-200">specials</div>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((it, i) => (
          <li key={i}>
            <span className="text-felt-400">{it.label}:</span>{' '}
            <span className="text-felt-100">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreBreakdownPanel({ collected }: { collected: readonly CardType[] }) {
  const score = calculateScore(collected);
  return (
    <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
      <ScoreCell label="광" value={score.gwang} />
      <ScoreCell label="끗" value={score.yeol + score.godori} />
      <ScoreCell label="띠" value={score.ddi + score.dan} />
      <ScoreCell label="피" value={score.pi} />
      <ScoreCell label="고도리" value={score.godori} />
      <ScoreCell label="합" value={score.total} highlight />
    </div>
  );
}

function ScoreCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded border px-2 py-0.5 ${
        highlight
          ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
          : 'border-felt-800 bg-felt-950/40 text-felt-200'
      }`}
    >
      <span className="text-felt-400">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function FlagsList({
  flags,
}: {
  flags: ReturnType<typeof calculateFinalScore>['flags'];
}) {
  const items: string[] = [];
  if (flags.chongtong) items.push('👑 총통');
  if (flags.ppeoksCausedWin) items.push('🚫 3뻑');
  if (flags.pibak) items.push('피박 ×2');
  if (flags.gwangbak) items.push('광박 ×2');
  if (flags.myungbak) items.push('멍박 ×2');
  if (flags.myungttadak) items.push('멍따 ×2');
  if (flags.gobak) items.push('고박 ×2');
  if (flags.goCount >= 3)
    items.push(`${flags.goCount}고 ×${Math.pow(2, flags.goCount - 2)}`);
  if ((flags.nagariMultiplier ?? 1) > 1)
    items.push(`나가리 ×${flags.nagariMultiplier}`);
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
      {items.map((s, i) => (
        <span
          key={i}
          className="rounded bg-emerald-500/30 px-1.5 py-0.5 font-bold text-emerald-100"
        >
          {s}
        </span>
      ))}
    </div>
  );
}
