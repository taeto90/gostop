import type { Card as CardType } from '@gostop/shared';
import { calculateScore, canDeclareGoStop } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { Card } from '../../../components/Card.tsx';
import {
  groupCollected,
  KIND_COLORS,
  KIND_LABELS,
  type CollectedKind,
} from '../../../lib/collectedGroups.ts';
import { COLLECTED_CARD_WIDTH } from '../../../lib/layoutConstants.ts';
import { piValue } from '../../../lib/multiplierUtils.ts';

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
  /** 하단 총 점수 블록 표시 여부 — PC 좌측 패널은 점수를 게임판 우하단에 따로 표시 (default true) */
  showTotal?: boolean;
}

type Kind = CollectedKind;

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
  showTotal = true,
}: MobileCollectedProps) {
  const score = calculateScore(collected, { nineYeolAsSsangPi, allowGukJoon });
  const canStop = canDeclareGoStop(score, playerCount, winScoreOverride);

  // 9월 끗을 쌍피로 사용 시 m09-yeol을 yeol에서 pi 자리로 시각 이동 (점수 계산도 동일하게)
  const groups: Record<Kind, CardType[]> = groupCollected(collected, nineYeolAsSsangPi);

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
            displayCount={kind === 'pi' ? piValue(groups[kind], nineYeolAsSsangPi) : groups[kind].length}
            cardW={cardW}
            isCompact={isCompact}
          />
        ))}
      </div>

      {/* 총 점수 — 영역 가장 아래에 고정 정렬 */}
      {showTotal && (
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
      )}
    </aside>
  );
}

function KindGroup({
  kind,
  cards,
  displayCount,
  cardW,
  isCompact,
}: {
  kind: Kind;
  cards: CardType[];
  displayCount: number;
  cardW: number;
  isCompact: boolean;
}) {
  const label = (
    <div
      className={`flex flex-shrink-0 items-baseline justify-between gap-1 rounded border ${
        isCompact ? 'px-1 py-0' : 'px-2 py-1'
      } ${KIND_COLORS[kind]}`}
    >
      <span className={`font-bold ${isCompact ? 'text-[10px]' : 'text-sm'}`}>
        {KIND_LABELS[kind]}
      </span>
      <AnimatedNumber
        value={displayCount}
        className={isCompact ? 'text-xs font-extrabold' : 'text-base font-extrabold'}
      />
    </div>
  );

  // 라벨 위 / 카드 아래 — 겹침 50% 고정 (PC/모바일 동일 구조, 사이즈만 다름)
  return (
    <div className="flex flex-col gap-1">
      {label}
      {cards.length > 0 ? (
        <div className="flex flex-wrap items-center pl-1">
          {cards.map((c, i) => (
            <div key={c.id} style={i > 0 ? { marginLeft: -Math.round(cardW / 2) } : undefined}>
              <Card card={c} width={cardW} layoutId={c.id} />
            </div>
          ))}
        </div>
      ) : (
        <div className="pl-2 text-[10px] italic text-felt-300/40">없음</div>
      )}
    </div>
  );
}
