export const EMOJI_AVATARS = [
  '🐱', '🐶', '🦊', '🐼', '🐰', '🐯', '🦁', '🐻',
  '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦄', '🐢',
  '🐠', '🐙', '🐝', '🦋', '😀', '😎', '😂', '🥰',
  '😴', '🤔', '🥳', '🤡', '👻', '👽', '🤖', '💩',
] as const;

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {EMOJI_AVATARS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={`flex aspect-square items-center justify-center rounded-lg text-2xl transition ${
            value === e
              ? 'bg-amber-500/30 ring-2 ring-amber-400'
              : 'bg-slate-800 hover:bg-slate-700'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
