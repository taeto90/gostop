import type { Card as CardType } from '@gostop/shared';
import { calculateScore, canDeclareGoStop } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { Card } from '../../../components/Card.tsx';
import { COLLECTED_CARD_WIDTH } from '../../../lib/layoutConstants.ts';

interface MobileCollectedProps {
  collected: CardType[];
  isCompact?: boolean;
  /** 게임 인원수 — 났음 점수 임계값 결정 (2인=7점, 3인+=3점) */
  playerCount?: number;
  /** 호스트 룰 winScore override (3/5/7) */
  winScoreOverride?: 3 | 5 | 7;
  /** 본인 9월 열끗 → 쌍피 변환 여부 (rules-final.md §1-5) */
  nineYeolAsSsangPi?: boolean;
  /** 국준(9월 쌍피) 인정 여부 (default true) */
  allowGukJoon?: boolean;
}

type Kind = 'gwang' | 'yeol' | 'ddi' | 'pi';

const LABELS: Record<Kind, string> = { gwang: '광', yeol: '끗', ddi: '띠', pi: '피' };
const COLORS: Record<Kind, string> = {
  gwang: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
  yeol: 'bg-sky-500/20 text-sky-200 border-sky-500/50',
  ddi: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
  pi: 'bg-stone-500/20 text-stone-200 border-stone-500/50',
};

/**
 * 좌측 패널 — 내 딴패 + 점수 분해.
 *
 * PC: 각 종류별 [라벨 + 점수] 위에 카드 row 아래
 * 모바일: 각 종류별 [라벨] 옆 inline 카드 (가로 좁아 짧은 화면에서도 카드 보임)
 */
export function MobileCollected({
  collected,
  isCompact = false,
  playerCount = 3,
  winScoreOverride,
  nineYeolAsSsangPi = false,
  allowGukJoon = true,
}: MobileCollectedProps) {
  const score = calculateScore(collected, { nineYeolAsSsangPi, allowGukJoon });
  const canStop = canDeclareGoStop(score, playerCount, winScoreOverride);

  const groups: Record<Kind, CardType[]> = {
    gwang: collected.filter((c) => c.kind === 'gwang'),
    yeol: collected.filter((c) => c.kind === 'yeol'),
    ddi: collected.filter((c) => c.kind === 'ddi'),
    pi: collected.filter((c) => c.kind === 'pi'),
  };

  const kindScore: Record<Kind, number> = {
    gwang: score.gwang,
    yeol: score.yeol + score.godori,
    ddi: score.ddi + score.dan,
    pi: score.pi,
  };

  const cardW = isCompact ? COLLECTED_CARD_WIDTH.mobile : COLLECTED_CARD_WIDTH.pc;

  return (
    // 점수+카드 그룹은 상단부터 차오름. 총점수는 영역 가장 아래에 고정 (mt-auto via flex-1).
    <aside className="flex h-full flex-col gap-1.5 p-1.5 sm:p-2">
      {/* 점수+카드 그룹 영역 — flex-1로 남은 공간 차지, 총점수가 아래로 밀리도록 */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {(['gwang', 'yeol', 'ddi', 'pi'] as const).map((kind) => (
          <KindGroup
            key={kind}
            kind={kind}
            cards={groups[kind]}
            score={kindScore[kind]}
            cardW={cardW}
            isCompact={isCompact}
          />
        ))}
      </div>

      {/* 총 점수 — 영역 가장 아래에 고정 정렬 */}
      <div
        className={`flex flex-shrink-0 items-center justify-between rounded border ${
          isCompact ? 'px-2 py-0.5' : 'px-3 py-2'
        } ${
          canStop
            ? 'border-amber-400/60 bg-amber-400/10'
            : 'border-felt-900/60 bg-felt-950/50'
        }`}
      >
        <span className={`text-felt-300 ${isCompact ? 'text-[10px]' : 'text-sm'}`}>
          총 점수
        </span>
        <AnimatedNumber
          value={score.total}
          className={`font-extrabold ${isCompact ? 'text-base' : 'text-3xl'} ${
            canStop ? 'text-amber-300' : 'text-felt-100'
          }`}
        />
      </div>
    </aside>
  );
}

function KindGroup({
  kind,
  cards,
  score,
  cardW,
  isCompact,
}: {
  kind: Kind;
  cards: CardType[];
  score: number;
  cardW: number;
  isCompact: boolean;
}) {
  const label = (
    <div
      className={`flex flex-shrink-0 items-baseline justify-between gap-1 rounded border ${
        isCompact ? 'px-1.5 py-0.5' : 'px-2 py-1'
      } ${COLORS[kind]}`}
    >
      <span className={isCompact ? 'text-xs font-bold' : 'text-sm font-bold'}>
        {LABELS[kind]}
      </span>
      <AnimatedNumber
        value={score}
        className={isCompact ? 'text-sm font-extrabold' : 'text-base font-extrabold'}
      />
    </div>
  );

  // 모바일(compact): 라벨 + 카드를 한 줄에 inline (가로 좁은 column)
  if (isCompact) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-12 flex-shrink-0">{label}</div>
        {cards.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center -space-x-2">
            {cards.map((c) => (
              <Card key={c.id} card={c} width={cardW} layoutId={c.id} />
            ))}
          </div>
        ) : (
          <span className="text-[10px] italic text-felt-300/40">없음</span>
        )}
      </div>
    );
  }

  // PC: 라벨 위 / 카드 아래
  return (
    <div className="flex flex-col gap-1">
      {label}
      {cards.length > 0 ? (
        <div className="flex flex-wrap items-center -space-x-3 pl-1">
          {cards.map((c) => (
            <Card key={c.id} card={c} width={cardW} layoutId={c.id} />
          ))}
        </div>
      ) : (
        <div className="pl-2 text-[10px] italic text-felt-300/40">없음</div>
      )}
    </div>
  );
}
