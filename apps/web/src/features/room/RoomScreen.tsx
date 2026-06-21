import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useSessionStore } from '../../stores/sessionStore.ts';
import { useRoomStore } from '../../stores/roomStore.ts';
import { emitWithAck, getSocket } from '../../lib/socket.ts';
import { markRoomLeft, wasRecentlyLeft } from '../../lib/leftRoomGuard.ts';
import { LiveKitGameRoom } from '../livekit/LiveKitGameRoom.tsx';
import { MediaSettings } from '../livekit/MediaSettings.tsx';
import { VideoMobileModal } from '../livekit/VideoMobileModal.tsx';
import { MediaTilesPanel } from '../livekit/MediaTilesPanel.tsx';
import { GameView } from './GameView.tsx';
import { ResultView } from './ResultView.tsx';
import { RoomLobbyModal } from './RoomLobbyModal.tsx';
import { useEndedSnapshot } from './useEndedSnapshot.ts';
import { PasswordPromptModal } from '../lobby/PasswordPromptModal.tsx';
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
  const [tried, setTried] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
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
      // 존재하지 않거나 이미 시작된 방 → 로비로 돌려보내며 안내 모달(toast).
      const bounceToLobby = (msg: string) => {
        toast.error(msg);
        navigate('/', { replace: true });
      };

      // 우선 rejoin 시도 (이미 멤버였으면 재접속 — 진행 중이어도 본인 복귀 OK)
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

      const err = joinPlayer.error;
      // 비밀방 → 비밀번호 모달
      if (err.includes('비밀')) {
        setNeedsPassword(true);
        return;
      }
      // 존재하지 않는 방 → 로비로
      if (err.includes('존재하지 않는') || err.includes('찾을 수 없')) {
        bounceToLobby('존재하지 않는 방입니다. 로비로 이동합니다.');
        return;
      }
      // 다른 방에서 게임 진행 중 (1인 1방 정책) → 서버 안내 그대로
      if (err.includes('다른 방')) {
        bounceToLobby(err);
        return;
      }
      // 이 방이 이미 시작됨 → 로비로 (관전자 자동 입장 X)
      if (err.includes('진행 중')) {
        bounceToLobby('이미 게임이 시작된 방입니다. 로비로 이동합니다.');
        return;
      }

      // 그 외 (대기방 자리 가득 등) → 관전자로 입장 시도
      const joinSpec = await emitWithAck('room:join', {
        userId: profile.userId,
        roomId: id,
        nickname: profile.nickname,
        emojiAvatar: profile.emojiAvatar,
        asSpectator: true,
      });
      if (joinSpec.ok) return;
      bounceToLobby(joinSpec.error);
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

  if (!profile) return null;
  if (!id) return <Navigate to="/" replace />;

  if (needsPassword && profile && id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-emerald-950">
        <PasswordPromptModal
          open
          hostNickname=""
          busy={pwBusy}
          err={pwErr}
          onClose={() => navigate('/')}
          onSubmit={async (pw) => {
            setPwBusy(true);
            setPwErr(null);
            const r = await emitWithAck('room:join', {
              userId: profile.userId,
              roomId: id,
              nickname: profile.nickname,
              emojiAvatar: profile.emojiAvatar,
              asSpectator: false,
              password: pw,
            });
            setPwBusy(false);
            if (r.ok) {
              setNeedsPassword(false);
            } else {
              setPwErr(r.error);
            }
          }}
        />
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

  // phase=ended 진입 직후 [대기하기 / 통계보기] 선택 모달 (snapshot 저장 전)
  if (ended.awaitingChoice && !ended.snapshot && view.phase === 'ended') {
    const isHost = view.hostUserId === view.myUserId;
    async function handleSkip() {
      ended.skipResult();
      // 호스트만 즉시 대기실 복귀 가능. 비호스트는 결과 화면 닫고 대기.
      if (isHost) {
        const r = await emitWithAck('room:return-to-lobby');
        if (!r.ok) toast.error(r.error);
      } else {
        ended.dismissByUser();
      }
    }
    return (
      <LiveKitGameRoom
        roomId={view.roomId}
        userId={profile.userId}
        nickname={profile.nickname}
        enabled={videoEnabled}
        voiceOnly={voiceOnly}
      >
        {/* 배경: 종료 시점 GameView (인터랙션 X) — ChoiceModal backdrop */}
        <div className="pointer-events-none h-full opacity-60">
          <GameView
            view={view}
            onPlayCard={handlePlayCard}
            onLeave={handleLeave}
            videoSidebar={showVideoUI ? <MediaTilesPanel view={view} /> : undefined}
            videoMobileModalRender={
              showVideoUI
                ? ({ open, onClose }) => (
                    <VideoMobileModal view={view} open={open} onClose={onClose} />
                  )
                : undefined
            }
            mediaSettings={showVideoUI ? <MediaSettings voiceOnly={voiceOnly} /> : undefined}
          />
        </div>
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <div className="text-xs font-semibold text-amber-300">게임 종료</div>
              <div className="mt-1 text-3xl font-black text-amber-200">🏁 다음 단계 선택</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={ended.showResult}
                className="rounded-lg bg-amber-500 px-4 py-4 text-lg font-black text-slate-950 shadow-lg shadow-amber-900/50 hover:bg-amber-400"
              >
                📊 통계보기
              </button>
              <button
                onClick={() => void handleSkip()}
                className="rounded-lg bg-emerald-500 px-4 py-4 text-lg font-black text-slate-950 shadow-lg shadow-emerald-900/50 hover:bg-emerald-400"
              >
                🎮 {isHost ? '대기하기' : '닫기'}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-felt-400">
              {isHost
                ? '대기하기: 통계 건너뛰고 바로 대기실로 — 다음 판 준비'
                : '닫기: 호스트가 다음 판 시작하기를 대기'}
            </p>
          </div>
        </div>
      </LiveKitGameRoom>
    );
  }

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
        {/* 배경: 종료 시점 GameView snapshot (인터랙션 X) — ResultView 모달 backdrop */}
        <div className="pointer-events-none h-full opacity-60">
          <GameView
            view={snap}
            onPlayCard={handlePlayCard}
            onLeave={handleLeave}
            videoSidebar={showVideoUI ? <MediaTilesPanel view={snap} /> : undefined}
            videoMobileModalRender={
              showVideoUI
                ? ({ open, onClose }) => (
                    <VideoMobileModal view={snap} open={open} onClose={onClose} />
                  )
                : undefined
            }
            mediaSettings={showVideoUI ? <MediaSettings voiceOnly={voiceOnly} /> : undefined}
          />
        </div>
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
    case 'ended': {
      // 비호스트가 ResultView 닫은 상태(ended+dismissed) → 대기 화면 (종료 후라 remount 무방)
      if (view.phase === 'ended' && ended.dismissed) {
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
      }
      // ⚠️ playing↔ended(비dismissed)를 동일 JSX 트리 하나로 렌더 → React가 GameView를
      // remount하지 않음 → 4-phase staging(lastProcessedRef)이 유지되어 AI 마지막 턴
      // 애니메이션이 정상 재생됨. (이전엔 case별 별도 return이라 phase 전환 시 remount되어
      // 종료 broadcast가 "첫 마운트 즉시 swap"으로 처리 → 애니 생략 + 종료 이펙트 중복 발화)
      // onEndedReady는 phase==='ended'일 때만 GameView 내부에서 호출됨.
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
            videoSidebar={showVideoUI ? <MediaTilesPanel view={view} /> : undefined}
            videoMobileModalRender={
              showVideoUI
                ? ({ open, onClose }) => (
                    <VideoMobileModal view={view} open={open} onClose={onClose} />
                  )
                : undefined
            }
            mediaSettings={showVideoUI ? <MediaSettings voiceOnly={voiceOnly} /> : undefined}
            onEndedReady={ended.triggerChoice}
          />
          {/* phase='waiting'에서 GameView 위에 컨트롤 모달 오버레이 */}
          {view.phase === 'waiting' && <RoomLobbyModal view={view} />}
        </LiveKitGameRoom>
      );
    }
    default:
      return null;
  }
}
