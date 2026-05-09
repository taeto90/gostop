import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useSessionStore } from '../../stores/sessionStore.ts';
import { useRoomStore } from '../../stores/roomStore.ts';
import { emitWithAck, getSocket } from '../../lib/socket.ts';
import { markRoomLeft, wasRecentlyLeft } from '../../lib/leftRoomGuard.ts';
import { LiveKitGameRoom } from '../livekit/LiveKitGameRoom.tsx';
import { MediaSettings } from '../livekit/MediaSettings.tsx';
import { VideoMobileModal } from '../livekit/VideoMobileModal.tsx';
import { VideoSidebar } from '../livekit/VideoSidebar.tsx';
import { GameView } from './GameView.tsx';
import { ResultView } from './ResultView.tsx';
import { RoomLobbyModal } from './RoomLobbyModal.tsx';
import { useEndedSnapshot } from './useEndedSnapshot.ts';
import { toast } from '../../stores/toastStore.ts';

/**
 * 멀티 모드의 play-card emit. 실제 needsSelection 처리는 GameView가 emit 직접 호출.
 * 이 함수는 GameView가 onPlayCard prop으로 받지만 멀티 흐름에서는 호출되지 않음
 * (GameView 내부 handlePlayCardWithPeek에서 직접 emit + 모달 처리).
 */
async function handlePlayCard(cardId: string) {
  const result = await emitWithAck('game:action', { type: 'play-card', cardId });
  if (!result.ok && 'error' in result) {
    toast.error(result.error);
  }
}

export function RoomScreen() {
  const { id } = useParams<{ id: string }>();
  const profile = useSessionStore((s) => s.profile);
  const view = useRoomStore((s) => s.view);
  const navigate = useNavigate();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  // ResultView 라이프사이클 (snapshot freeze + 5초 자동 dismiss + 비호스트 명시적 dismiss)
  const ended = useEndedSnapshot(view);

  // URL 직접 접근 시 자동 입장 (rejoin → join 시도)
  // 단, 사용자가 직전에 명시적으로 leave한 방이면 자동 재입장 X (sessionStorage flag)
  useEffect(() => {
    if (!profile || !id) return;
    if (view?.roomId === id) return;
    if (tried) return;

    // 명시적 leave한 방을 뒤로 가기/HMR로 다시 들어오는 케이스 차단
    if (wasRecentlyLeft(id)) {
      navigate('/', { replace: true });
      return;
    }

    setTried(true);
    void (async () => {
      // 우선 rejoin 시도 (이미 멤버였으면 재접속)
      const rejoin = await emitWithAck('room:rejoin', {
        userId: profile.userId,
        roomId: id,
      });
      if (rejoin.ok) return;

      // 새로 입장 시도 (player)
      const joinPlayer = await emitWithAck('room:join', {
        userId: profile.userId,
        roomId: id,
        nickname: profile.nickname,
        emojiAvatar: profile.emojiAvatar,
        asSpectator: false,
      });
      if (joinPlayer.ok) return;

      // 자리가 가득 찬 경우 관전자로 시도
      const joinSpec = await emitWithAck('room:join', {
        userId: profile.userId,
        roomId: id,
        nickname: profile.nickname,
        emojiAvatar: profile.emojiAvatar,
        asSpectator: true,
      });
      if (!joinSpec.ok) {
        setJoinError(joinSpec.error);
      }
    })();
  }, [id, profile, view?.roomId, tried, navigate]);

  // 재접속 처리: 소켓이 reconnect 되면 자동 rejoin
  useEffect(() => {
    if (!profile || !id) return;
    const socket = getSocket();
    function onReconnect() {
      if (!profile || !id) return;
      void emitWithAck('room:rejoin', { userId: profile.userId, roomId: id });
    }
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.io.off('reconnect', onReconnect);
    };
  }, [profile, id]);

  if (!profile) return <Navigate to="/" replace />;
  if (!id) return <Navigate to="/" replace />;

  if (joinError) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
        <div className="mx-auto max-w-md text-center">
          <h2 className="mb-3 text-xl font-bold text-rose-300">방 입장 실패</h2>
          <p className="mb-6 text-slate-400">{joinError}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
          >
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!view || view.roomId !== id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        방 입장 중...
      </div>
    );
  }

  async function handleLeave() {
    await emitWithAck('room:leave');
    useRoomStore.getState().clear();
    if (id) markRoomLeft(id);
    navigate('/', { replace: true });
  }

  // 화상 사이드바/모바일 모달은 멤버 2명 이상일 때만 노출 (혼자면 비표시).
  // 단, LiveKit 연결 자체는 방에 들어오자마자 활성화하여 멤버 변동 시 disconnect/reconnect
  // 사이클을 피한다 (멤버 변동마다 token 재요청 + LiveKitRoom re-init이 깜빡임 + stale view 재진입 유발).
  const totalMembers = view.players.length + view.spectators.length;
  const showVideoUI = totalMembers >= 2;
  const videoEnabled = true;
  // 음성 전용 모드 — 호스트가 방 만들기 시 선택. server token이 video publish 권한 X로 발급.
  const voiceOnly = view.rules?.mediaMode === 'voice-only';

  // ResultView snapshot — phase 'ended' 또는 호스트가 "🎮 게임으로" 누른 직후
  // 비호스트가 5초간 결과를 더 봐야 할 때 우선 표시.
  if (ended.snapshot) {
    const snap = ended.snapshot;
    const isHost = snap.hostUserId === snap.myUserId;
    // 호스트 "게임으로" — 즉시 다음 판 시작이 아니라 대기실(waiting)로 복귀.
    // 봇/룰/멤버 재조정 후 다시 "게임 시작" 누르면 다음 판이 nagari 누적 보존된 채 시작.
    async function handleReturnToLobby() {
      const r = await emitWithAck('room:return-to-lobby');
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      ended.setSnapshot(null);
    }
    return (
      <LiveKitGameRoom
        roomId={snap.roomId}
        userId={profile.userId}
        nickname={profile.nickname}
        enabled={videoEnabled}
        voiceOnly={voiceOnly}
      >
        <ResultView
          view={snap}
          onStartNextRound={isHost ? handleReturnToLobby : undefined}
          onDismiss={!isHost ? ended.dismissByUser : undefined}
        />
      </LiveKitGameRoom>
    );
  }

  switch (view.phase) {
    case 'waiting':
    case 'playing':
    case 'go-stop-decision':
    case 'dealing':
      return (
        <LiveKitGameRoom
          roomId={view.roomId}
          userId={profile.userId}
          nickname={profile.nickname}
          enabled={videoEnabled}
          voiceOnly={voiceOnly}
        >
          <GameView
            view={view}
            onPlayCard={handlePlayCard}
            onLeave={handleLeave}
            videoSidebar={
              showVideoUI ? <VideoSidebar view={view} /> : undefined
            }
            videoMobileModalRender={
              showVideoUI
                ? ({ open, onClose }) => (
                    <VideoMobileModal view={view} open={open} onClose={onClose} />
                  )
                : undefined
            }
            mediaSettings={showVideoUI ? <MediaSettings voiceOnly={voiceOnly} /> : undefined}
          />
          {/* phase='waiting'에서 GameView 위에 컨트롤 모달 오버레이 */}
          {view.phase === 'waiting' && <RoomLobbyModal view={view} />}
        </LiveKitGameRoom>
      );
    case 'ended':
      // 비호스트가 ResultView 닫기 누른 상태. 호스트가 "🎮 게임으로" 누를 때까지 대기 화면.
      return (
        <div className="flex h-full items-center justify-center bg-felt p-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-felt-100">🏁 게임 종료</div>
            <div className="mt-2 text-sm text-felt-400">
              호스트가 다음 판을 시작하기를 기다리는 중...
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={ended.unDismiss}
                className="rounded bg-felt-800 px-4 py-2 text-sm hover:bg-felt-700"
              >
                📊 결과 다시 보기
              </button>
              <button
                onClick={handleLeave}
                className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600"
              >
                🚪 로비로
              </button>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}
