import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 화투 룰 도움말 모달 — 처음 하는 친구를 위한 룰 요약.
 *
 * 점수 계산 / 특수 룰 / 박 / 고스톱 / 광팔이 등 핵심 룰을 한 페이지에 정리.
 * 자세한 룰은 `docs/rules-final.md` 참고.
 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 10 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-felt-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-felt-800/60 px-5 py-3">
              <span className="text-base font-bold text-felt-100">📖 화투 룰 가이드</span>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5 text-sm text-felt-100">
                <Section title="🃏 카드">
                  <p>
                    <b>총 48장</b> — 1~12월 각 4장씩. <b>광 5장</b> /{' '}
                    <b>열끗 9장</b> / <b>띠 10장</b> / <b>피 24장</b>.
                  </p>
                </Section>

                <Section title="🎯 게임 진행">
                  <ul className="ml-4 list-disc space-y-1">
                    <li>2인은 손패 10장 + 바닥 8장, 3인은 손패 7장 + 바닥 6장</li>
                    <li>본인 차례에 손패 1장을 바닥에 내고, 더미에서 1장 뒤집음</li>
                    <li>같은 월 카드끼리 매칭되면 둘 다 가져옴</li>
                  </ul>
                </Section>

                <Section title="🏆 점수 계산">
                  <Table
                    rows={[
                      ['광 3장', '3점 (비광 포함 시 2점)'],
                      ['광 4장 / 5장', '4점 / 15점'],
                      ['끗 5장 / 6장 / 7장', '1점 / 2점 / 3점'],
                      ['고도리 (1·2·8월 새 3장)', '+5점'],
                      ['띠 5장 (이후 1장당 +1점)', '1점'],
                      ['홍단 / 청단 / 초단', '각 +3점'],
                      ['피 10장 (이후 1장당 +1점)', '1점'],
                      ['쌍피', '한 장 = 2장 가치'],
                    ]}
                  />
                  <p className="mt-2 text-xs text-felt-300">
                    🏁 <b>났다</b>: 2인 7점, 3인 3점 도달 시 고/스톱 결정
                  </p>
                </Section>

                <Section title="✨ 특수 매칭 (피 빼앗기)">
                  <Table
                    rows={[
                      ['뻑 (싸기)', '바닥 같은 월 2장 + 손패 1장 → 3장 묶임'],
                      ['자뻑', '본인 뻑을 본인이 회수 → 피 2장씩'],
                      ['따닥', '바닥 2 + 손패 1 + 더미 1 = 4장 → 피 1장씩'],
                      ['쪽', '손패 placed + 더미 같은 월 → 피 1장씩'],
                      ['싹쓸이', '매칭 후 바닥 비면 → 피 1장씩'],
                      ['폭탄', '같은 월 3장 + 바닥 1 = 4장 한 번에 → 피 1장 + ×2'],
                      ['총통', '시작 시 손패 같은 월 4장 → 즉시 7점 승리'],
                    ]}
                  />
                </Section>

                <Section title="💢 박 (점수 ×2)">
                  <Table
                    rows={[
                      ['피박', '본인 피로 점수 + 상대 피 1~5장'],
                      ['광박', '본인 광 3장+ + 상대 광 0장'],
                      ['멍박', '본인 끗 5장+ + 상대 끗 0장'],
                      ['멍따', '본인 끗 7장+ (상대 무관, ×2)'],
                      ['고박', '고 부른 사람이 진 경우 ×2 패널티'],
                    ]}
                  />
                </Section>

                <Section title="🔥 고 / 스톱">
                  <ul className="ml-4 list-disc space-y-1">
                    <li>
                      <b>1고</b> = +1점, <b>2고</b> = +2점, <b>3고+</b>는 ×2 누적
                      (×2/×4/×8...)
                    </li>
                    <li>
                      <b>스톱</b>: 점수 확정 + 게임 종료
                    </li>
                    <li>고 부르고 다른 사람이 먼저 나면 → 고박 (×2 패널티)</li>
                  </ul>
                </Section>

                <Section title="💪 흔들기 / 폭탄">
                  <ul className="ml-4 list-disc space-y-1">
                    <li>
                      <b>흔들기</b>: 손패 같은 월 3장 → 공개 시 ×2
                    </li>
                    <li>
                      <b>폭탄</b>: 손패 3장 + 바닥 1장 → 4장 한 번에 가져감 (자동)
                    </li>
                  </ul>
                </Section>

                <Section title="🎴 광팔이 (4~5인)">
                  <ul className="ml-4 list-disc space-y-1">
                    <li>4명 → 1명, 5명 → 2명이 광팔이로 빠져 관전</li>
                    <li>
                      우선순위: 자원자 → 호스트 지정 → 마지막 입장자 자동
                    </li>
                  </ul>
                </Section>

                <Section title="🤖 1인 자동 AI 모드">
                  <p>
                    혼자만 있어도 게임 시작 가능. AI 봇 2명이 자동 합류해 3인
                    게임 진행. 친구가 들어오면 다음 판부터 합류 가능.
                  </p>
                </Section>

                <div className="rounded bg-felt-950/50 px-3 py-2 text-[10px] text-felt-400">
                  📚 자세한 룰: <code>docs/rules-final.md</code>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-bold text-amber-300">{title}</div>
      <div className="text-sm leading-relaxed text-felt-100">{children}</div>
    </div>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded border border-felt-800/60">
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([label, value], i) => (
            <tr
              key={i}
              className={`border-felt-800/40 ${i > 0 ? 'border-t' : ''}`}
            >
              <td className="bg-felt-950/40 px-3 py-1.5 font-bold text-felt-200">
                {label}
              </td>
              <td className="px-3 py-1.5 text-felt-200">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
