import {
  type Card as CardType,
  createBombCard,
  createBonusPiCard,
  createJokerCard,
  getCardById,
} from '@gostop/shared';
import { Card } from '../../components/Card.tsx';

interface SpecialCardPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 임시 미리보기 모달 — 특수 카드(조커/보너스피/쌍피/폭탄)가 어떻게 렌더되는지 확인용.
 * 카드 디자인 검토 목적. 실제 게임 로직과 무관.
 */
export function SpecialCardPreviewModal({ open, onClose }: SpecialCardPreviewModalProps) {
  if (!open) return null;

  const sections: { label: string; cards: { card: CardType; caption: string }[] }[] = [
    {
      label: '조커 (옵션 추가 카드)',
      cards: [{ card: createJokerCard(), caption: '🃏 조커 — 쌍피 가치' }],
    },
    {
      label: '보너스피 (옵션 추가 카드)',
      cards: [
        { card: createBonusPiCard(2), caption: '✌️ 투피 — 피 2장' },
        { card: createBonusPiCard(3), caption: '🤟 쓰리피 — 피 3장' },
      ],
    },
    {
      label: '정규 쌍피 (48장 중)',
      cards: [
        { card: getCardById('m11-ssangpi')!, caption: '오동 쌍피 (11월)' },
        { card: getCardById('m12-ssangpi')!, caption: '비 쌍피 (12월)' },
      ],
    },
    {
      label: '폭탄 보너스 카드',
      cards: [{ card: createBombCard(), caption: '💣 폭탄 — 더미 뒤집기' }],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-emerald-500/40 bg-green-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-amber-300">🎴 특수 카드 미리보기</h2>
          <button
            onClick={onClose}
            className="rounded-lg bg-green-800 px-3 py-1 text-sm text-green-100 hover:bg-green-700"
          >
            닫기
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.label}>
              <h3 className="mb-2 text-sm font-semibold text-emerald-300">
                {section.label}
              </h3>
              <div className="flex flex-wrap gap-4">
                {section.cards.map(({ card, caption }) => (
                  <div key={card.id} className="flex flex-col items-center gap-1">
                    <Card card={card} width={72} />
                    <span className="text-[11px] text-green-300">{caption}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
