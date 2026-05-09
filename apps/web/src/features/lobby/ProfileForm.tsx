import { useState, type FormEvent } from 'react';
import { useSessionStore } from '../../stores/sessionStore.ts';
import { EmojiPicker, EMOJI_AVATARS } from '../../components/EmojiPicker.tsx';

interface ProfileFormProps {
  onComplete?: () => void;
}

export function ProfileForm({ onComplete }: ProfileFormProps) {
  const profile = useSessionStore((s) => s.profile);
  const setProfile = useSessionStore((s) => s.setProfile);

  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [emoji, setEmoji] = useState(profile?.emojiAvatar ?? EMOJI_AVATARS[0]);

  const trimmed = nickname.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 20;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setProfile({ nickname: trimmed, emojiAvatar: emoji });
    onComplete?.();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-6">
      <h2 className="text-2xl font-bold">프로필 설정</h2>
      <div>
        <label className="mb-1 block text-sm text-slate-400">닉네임 (1-20자)</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-amber-400"
          placeholder="원하는 이름"
          autoFocus
        />
      </div>
      <div>
        <label className="mb-2 block text-sm text-slate-400">아바타 이모지</label>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>
      <button
        type="submit"
        disabled={!isValid}
        className="w-full rounded bg-amber-500 px-4 py-2 font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        저장하고 시작
      </button>
    </form>
  );
}
