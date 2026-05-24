import { useState, type FormEvent } from 'react';
import { useAuthStore, upsertDbProfile } from '../../stores/authStore.ts';
import { useSessionStore } from '../../stores/sessionStore.ts';
import { EmojiPicker, EMOJI_AVATARS } from '../../components/EmojiPicker.tsx';
import { toast } from '../../stores/toastStore.ts';

export function ProfileSetupPage() {
  const user = useAuthStore((s) => s.user);
  const googleName = user?.user_metadata?.full_name ?? '';

  const [nickname, setNickname] = useState(googleName);
  const [emoji, setEmoji] = useState<string>(EMOJI_AVATARS[0]);
  const [busy, setBusy] = useState(false);

  const trimmed = nickname.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 20;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid || !user) return;

    setBusy(true);
    const profile = await upsertDbProfile(user.id, trimmed, emoji, user.email ?? undefined);
    setBusy(false);

    if (!profile) {
      toast.error('프로필 저장에 실패했습니다');
      return;
    }

    useAuthStore.getState().setDbProfile(profile);
    useSessionStore.getState().setProfile({
      userId: user.id,
      nickname: profile.nickname,
      emojiAvatar: profile.emoji_avatar,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div className="rounded-2xl border border-amber-700/40 bg-green-900/50 p-8 backdrop-blur-sm">
          <h2 className="mb-6 text-center text-2xl font-bold text-amber-400">
            프로필 설정
          </h2>

          <div className="mb-4">
            <label className="mb-1 block text-sm text-green-200">
              닉네임 (1-20자)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="w-full rounded-lg border border-green-700 bg-green-950 px-3 py-2 text-white outline-none focus:border-amber-400"
              placeholder="원하는 이름"
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm text-green-200">
              아바타 이모지
            </label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>

          <button
            type="submit"
            disabled={!isValid || busy}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? '저장 중...' : '저장하고 시작'}
          </button>
        </div>
      </form>
    </div>
  );
}
