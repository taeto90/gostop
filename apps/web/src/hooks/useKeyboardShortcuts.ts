import { useEffect, useRef } from 'react';

interface ShortcutHandlers {
  onSelectCard?: (index: number) => void;
  onGo?: () => void;
  onStop?: () => void;
  onToggleChat?: () => void;
  enabled: boolean;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!ref.current.enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const h = ref.current;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        h.onSelectCard?.(num - 1);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'g':
          e.preventDefault();
          h.onGo?.();
          break;
        case 's':
          e.preventDefault();
          h.onStop?.();
          break;
        case 'c':
          e.preventDefault();
          h.onToggleChat?.();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers.enabled]);
}
