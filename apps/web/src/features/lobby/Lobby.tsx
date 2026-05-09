import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { RoomListItem } from '@gostop/shared';
import { useSessionStore } from '../../stores/sessionStore.ts';
import { toast } from '../../stores/toastStore.ts';
import { emitWithAck } from '../../lib/socket.ts';
import { clearLeftRoomGuard } from '../../lib/leftRoomGuard.ts';
import { HelpModal } from '../../components/HelpModal.tsx';
import { HistoryModal } from '../../components/HistoryModal.tsx';
import { LobbyHeaderButtons } from './LobbyHeaderButtons.tsx';
import { LobbyProfileCard } from './LobbyProfileCard.tsx';
import { LobbyActionCards } from './LobbyActionCards.tsx';
import { LobbyResumeCard } from './LobbyResumeCard.tsx';
import { LobbyRoomList } from './LobbyRoomList.tsx';
import { CreateRoomModal } from './CreateRoomModal.tsx';
import { PasswordPromptModal } from './PasswordPromptModal.tsx';
import { ProfileForm } from './ProfileForm.tsx';

export function Lobby() {
  const profile = useSessionStore((s) => s.profile);
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // 비밀방 입장 시 비밀번호 입력 모달 — 어떤 방인지 + 에러 메시지
  const [passwordPrompt, setPasswordPrompt] = useState<{
    room: RoomListItem;
    err?: string;
  } | null>(null);

  // 사용자가 멤버인 방 (한 사용자 한 방 정책상 0~1개) — 로비 mount 시 조회 후 배너 노출
  const [resumeRoom, setResumeRoom] = useState<RoomListItem | null>(null);
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      const r = await emitWithAck('room:my-current', { userId: profile.userId });
      if (!cancelled && r.ok) setResumeRoom(r.data.room);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 p-6 text-white">
        <div className="mx-auto mt-8 max-w-2xl">
          <h1 className="mb-8 text-center text-4xl font-bold text-amber-400">
            🎴 화투 게임
          </h1>
          <ProfileForm />
        </div>
      </div>
    );
  }

  async function createRoom(opts: {
    password?: string;
    asSpectator: boolean;
    mediaMode: 'video' | 'voice-only';
  }) {
    if (!profile) return;
    setBusy(true);
    const result = await emitWithAck('room:create', {
      userId: profile.userId,
      nickname: profile.nickname,
      emojiAvatar: profile.emojiAvatar,
      asSpectator: opts.asSpectator,
      password: opts.password,
      mediaMode: opts.mediaMode,
    });
    setBusy(false);
    if (result.ok) {
      setCreateOpen(false);
      // 명시적 입장 — leave flag 제거
      clearLeftRoomGuard();
      navigate(`/room/${result.data.roomId}`);
    } else {
      toast.error(result.error);
    }
  }

  async function joinRoomById(roomId: string, password?: string) {
    if (!profile) return;
    setBusy(true);
    const result = await emitWithAck('room:join', {
      userId: profile.userId,
      nickname: profile.nickname,
      emojiAvatar: profile.emojiAvatar,
      roomId: roomId.toUpperCase(),
      asSpectator: false,
      password,
    });
    setBusy(false);
    if (result.ok) {
      setPasswordPrompt(null);
      // 명시적 입장 — leave flag 제거
      clearLeftRoomGuard();
      navigate(`/room/${roomId.toUpperCase()}`);
    } else {
      // 비밀번호 필요/틀림 → password prompt 유지하고 에러 표시
      if (passwordPrompt) {
        setPasswordPrompt({ ...passwordPrompt, err: result.error });
      } else {
        toast.error(result.error);
      }
    }
  }

  function handleJoinRoom(room: RoomListItem) {
    if (room.hasPassword) {
      setPasswordPrompt({ room });
    } else {
      void joinRoomById(room.id);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 p-3 text-white sm:p-4 lg:p-8">
      <LobbyHeaderButtons
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 sm:gap-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-amber-400 sm:text-4xl lg:text-5xl">
            화투 게임
          </h1>
          <p className="mt-1 text-xs text-green-200 sm:text-sm">
            친구들과 즐기는 전통 카드 게임
          </p>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* 좌측: 프로필 + (이전 방 복귀) + 액션 */}
          <div className="flex flex-col gap-3 sm:gap-4 lg:col-span-1">
            <LobbyProfileCard
              nickname={profile.nickname}
              emojiAvatar={profile.emojiAvatar}
              myUserId={profile.userId}
            />
            {resumeRoom && (
              <LobbyResumeCard
                room={resumeRoom}
                onResume={() => {
                  clearLeftRoomGuard();
                  navigate(`/room/${resumeRoom.id}`);
                }}
              />
            )}
            <LobbyActionCards
              onCreateRoom={() => setCreateOpen(true)}
              busy={busy}
            />
          </div>

          {/* 우측: 방 목록 */}
          <div className="min-h-[400px] lg:col-span-2 lg:min-h-0">
            <LobbyRoomList
              onJoinRoom={handleJoinRoom}
              onJoinById={(id) => void joinRoomById(id)}
            />
          </div>
        </div>

        {/* 개발/테스트 도구 — 하단 작은 링크 */}
        <div className="flex flex-shrink-0 justify-center gap-3 pb-2 text-[11px] text-green-400/60">
          <button
            onClick={() => navigate('/rule-test')}
            className="hover:text-amber-300"
          >
            🧪 룰 테스트
          </button>
          <span>·</span>
          <button
            onClick={() => navigate('/result-demo')}
            className="hover:text-amber-300"
          >
            🎴 결과 데모
          </button>
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <CreateRoomModal
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onCreate={createRoom}
      />
      <PasswordPromptModal
        open={passwordPrompt !== null}
        hostNickname={passwordPrompt?.room.hostNickname ?? ''}
        busy={busy}
        err={passwordPrompt?.err ?? null}
        onClose={() => setPasswordPrompt(null)}
        onSubmit={(pw) => {
          if (passwordPrompt) void joinRoomById(passwordPrompt.room.id, pw);
        }}
      />
    </div>
  );
}
