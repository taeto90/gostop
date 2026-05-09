import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore, type ToastKind } from '../stores/toastStore.ts';

const ICON: Record<ToastKind, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

const STYLE: Record<ToastKind, string> = {
  info: 'border-sky-400/50 bg-sky-500/10 text-sky-100',
  success: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-400/50 bg-amber-500/10 text-amber-100',
  error: 'border-rose-400/50 bg-rose-500/10 text-rose-100',
};

/** 화면 우측 상단에 toast list 표시. 자동/수동 사라짐. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[200] flex max-w-[calc(100vw-24px)] flex-col gap-2 sm:right-4 sm:top-4 sm:max-w-sm">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur ${STYLE[t.kind]}`}
            role="alert"
          >
            <span className="text-base leading-tight">{ICON[t.kind]}</span>
            <span className="flex-1 break-words">{t.text}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-current opacity-60 hover:opacity-100"
              aria-label="닫기"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
