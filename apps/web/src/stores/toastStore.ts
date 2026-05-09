import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
  /** 자동 사라지는 시간 (ms). 0이면 수동 닫기만 */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, text: string, duration?: number) => void;
  remove: (id: string) => void;
}

let nextId = 1;

const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  info: 3000,
  success: 2500,
  warning: 4000,
  error: 5000,
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, text, duration) => {
    const id = `t${nextId++}`;
    const dur = duration ?? DEFAULT_DURATION_MS[kind];
    set((s) => ({ toasts: [...s.toasts, { id, kind, text, duration: dur }] }));
    if (dur > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, dur);
    }
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 짧은 alias — 컴포넌트 외부에서도 사용 가능 (handler 등) */
export const toast = {
  info: (text: string, duration?: number) =>
    useToastStore.getState().push('info', text, duration),
  success: (text: string, duration?: number) =>
    useToastStore.getState().push('success', text, duration),
  warning: (text: string, duration?: number) =>
    useToastStore.getState().push('warning', text, duration),
  error: (text: string, duration?: number) =>
    useToastStore.getState().push('error', text, duration),
};
