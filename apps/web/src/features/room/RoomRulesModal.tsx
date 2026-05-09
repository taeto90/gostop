import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { defaultRoomRules, type RoomRules } from '@gostop/shared';
import { emitWithAck } from '../../lib/socket.ts';
import { toast } from '../../stores/toastStore.ts';

interface RoomRulesModalProps {
  open: boolean;
  /** 현재 적용된 룰 (룸 view에서 받음). undefined면 default */
  current: RoomRules | undefined;
  /** 호스트만 변경 가능. false면 read-only */
  canEdit: boolean;
  /** 게임 중 변경 — 즉시 반영됨 안내 표시 */
  inGame?: boolean;
  onClose: () => void;
}

/**
 * 호스트가 방 룰을 변경하는 모달.
 *
 * - 호스트가 아니면 read-only로 표시
 * - 게임 중(inGame)에는 변경 차단 (서버에서도 거부) — 진행 중 점수/시간 영향
 * - 일부 옵션은 UI만 (코드 미적용 — 추후 적용 예정 표시)
 */
export function RoomRulesModal({
  open,
  current,
  canEdit,
  inGame = false,
  onClose,
}: RoomRulesModalProps) {
  const [rules, setRules] = useState<RoomRules>(current ?? defaultRoomRules());
  const [busy, setBusy] = useState(false);
  const editable = canEdit && !inGame;

  // 외부에서 current 변경되면 동기화
  useEffect(() => {
    if (current) setRules(current);
  }, [current]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function apply() {
    if (!editable) {
      onClose();
      return;
    }
    setBusy(true);
    const r = await emitWithAck('room:update-rules', { rules });
    setBusy(false);
    if (r.ok) {
      toast.success('룰이 적용되었습니다');
      onClose();
    } else toast.error(r.error);
  }

  function update<K extends keyof RoomRules>(key: K, value: RoomRules[K]) {
    setRules((r) => ({ ...r, [key]: value }));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 8 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border-2 border-amber-400/50 bg-felt-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-bold text-felt-100">⚙️ 방 룰 설정</span>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {!canEdit && (
              <div className="mb-3 rounded border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                호스트만 룰 변경 가능. 현재 적용된 룰을 확인할 수 있습니다.
              </div>
            )}

            {canEdit && inGame && (
              <div className="mb-3 rounded border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                🔒 게임 진행 중에는 룰을 변경할 수 없습니다. 다음 판 대기실 또는 종료 후 변경 가능합니다.
              </div>
            )}

            <fieldset disabled={!editable || busy} className="flex flex-col gap-4">
              {/* 시작 점수 */}
              <RuleSection title="🏁 시작 점수 (났음)">
                <ChoiceRow
                  options={[3, 5, 7] as const}
                  value={rules.winScore}
                  onPick={(v) => update('winScore', v)}
                  format={(v) => `${v}점`}
                  hint="default: 2인 7점, 3인+ 3점. override 시 모든 인원에 일괄 적용"
                />
              </RuleSection>

              {/* 멍따 인정 */}
              <RuleSection title="🐦 멍따 인정">
                <ToggleRow
                  on={rules.allowMyungttadak}
                  onChange={(v) => update('allowMyungttadak', v)}
                  label="끗 7장 모으면 ×2 (멍따)"
                />
              </RuleSection>

              <RuleSection title="⏱ 턴 시간 제한">
                <ChoiceRow
                  options={[0, 30, 40, 50, 60, 90] as const}
                  value={rules.turnTimeLimitSec}
                  onPick={(v) => update('turnTimeLimitSec', v)}
                  format={(v) => (v === 0 ? '없음' : `${v}초`)}
                  hint="시간 초과 시 매칭 가능한 첫 카드 자동 플레이"
                />
              </RuleSection>

              <RuleSection title="🃏 조커 카드">
                <ChoiceRow
                  options={[0, 1, 2, 3] as const}
                  value={rules.jokerCount}
                  onPick={(v) => update('jokerCount', v)}
                  format={(v) => (v === 0 ? '사용 X' : `${v}장`)}
                  hint="조커는 매칭 X, 클릭 시 collected에 쌍피 가치로 추가 + 더미 1장 뒤집기"
                />
              </RuleSection>

              <RuleSection title="🎙️ 미디어 모드">
                <ChoiceRow
                  options={['video', 'voice-only'] as const}
                  value={rules.mediaMode}
                  onPick={(v) => update('mediaMode', v)}
                  format={(v) => (v === 'video' ? '🎥 화상 + 음성' : '🎙️ 음성 전용')}
                  hint="음성 전용 시 카메라 publish 권한 X (server 강제). 변경은 다음 LiveKit 재연결 시 반영"
                />
              </RuleSection>

              {/* --- 아래는 UI만, 코드 미적용 (추후) --- */}
              <div className="my-2 rounded bg-felt-950/50 px-3 py-2 text-[10px] text-felt-400">
                ⏳ 아래 옵션은 UI만 — 점진 적용 예정
              </div>

              <RuleSection title="💪 흔들기 처리">
                <ChoiceRow
                  options={['multiplier', 'addPoint'] as const}
                  value={rules.shakeBonusType}
                  onPick={(v) => update('shakeBonusType', v)}
                  format={(v) => (v === 'multiplier' ? '×2 (표준)' : '+1점 (변형)')}
                />
              </RuleSection>

              <RuleSection title="💣 폭탄 피 빼앗기">
                <ChoiceRow
                  options={[1, 2] as const}
                  value={rules.bombStealCount}
                  onPick={(v) => update('bombStealCount', v)}
                  format={(v) => `${v}장씩`}
                />
              </RuleSection>

              <RuleSection title="🎴 국준 인정">
                <ToggleRow
                  on={rules.allowGukJoon}
                  onChange={(v) => update('allowGukJoon', v)}
                  label="국준 (4월 흑싸리 변형) 인정"
                />
              </RuleSection>

            </fieldset>

            {/* 하단 버튼 */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600"
              >
                {editable ? '취소' : '닫기'}
              </button>
              {editable && (
                <button
                  onClick={apply}
                  disabled={busy}
                  className="rounded bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 shadow hover:bg-amber-400 disabled:opacity-50"
                >
                  {busy ? '적용 중...' : '✓ 적용'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RuleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-felt-300">{title}</span>
      {children}
    </div>
  );
}

function ChoiceRow<T extends string | number>({
  options,
  value,
  onPick,
  format,
  hint,
}: {
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
  format: (v: T) => string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onPick(opt)}
            className={`flex-1 rounded border px-2 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
              value === opt
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-felt-700/60 bg-felt-950/60 text-felt-400 hover:border-felt-600'
            }`}
          >
            {format(opt)}
          </button>
        ))}
      </div>
      {hint && <span className="text-[10px] text-felt-500">{hint}</span>}
    </div>
  );
}

function ToggleRow({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
        on
          ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200'
          : 'border-felt-700/60 bg-felt-950/60 text-felt-300 hover:bg-felt-800'
      }`}
    >
      <span>{label}</span>
      <span className="font-bold">{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}
