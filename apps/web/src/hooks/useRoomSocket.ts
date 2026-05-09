import { useEffect } from 'react';
import type { RoomRules } from '@gostop/shared';
import { getSocket } from '../lib/socket.ts';
import { useChatStore } from '../stores/chatStore.ts';
import { useRoomStore } from '../stores/roomStore.ts';
import { useSessionStore } from '../stores/sessionStore.ts';
import { toast } from '../stores/toastStore.ts';

type ReactionListener = (payload: { fromUserId: string; emoji: string }) => void;
const reactionListeners = new Set<ReactionListener>();

export function subscribeReaction(fn: ReactionListener): () => void {
  reactionListeners.add(fn);
  return () => reactionListeners.delete(fn);
}

/**
 * 소켓 이벤트를 roomStore에 연결.
 * 앱 최상위에서 한 번만 호출하면 됨.
 */
export function useRoomSocket(): void {
  const setView = useRoomStore((s) => s.setView);
  const setError = useRoomStore((s) => s.setError);
  const clear = useRoomStore((s) => s.clear);

  useEffect(() => {
    const socket = getSocket();

    const onState = (view: Parameters<typeof setView>[0]) => setView(view);
    const onClosed = ({ reason }: { reason: string }) => {
      setError(reason);
      clear();
    };
    const onErr = ({ message }: { message: string }) => setError(message);

    const onReaction = (payload: { fromUserId: string; emoji: string }) => {
      for (const fn of reactionListeners) fn(payload);
    };

    const onChat = (payload: {
      fromUserId: string;
      fromNickname: string;
      fromEmoji: string;
      text: string;
      timestamp: number;
    }) => {
      const myUserId = useSessionStore.getState().profile?.userId;
      useChatStore.getState().pushMessage({
        fromUserId: payload.fromUserId,
        fromNickname: payload.fromNickname,
        fromEmoji: payload.fromEmoji,
        text: payload.text,
        timestamp: payload.timestamp,
        mine: payload.fromUserId === myUserId,
      });
    };

    const onRulesChanged = ({
      byNickname,
      changes,
    }: {
      byNickname: string;
      changes: Partial<RoomRules>;
    }) => {
      const summary = formatRuleChanges(changes);
      if (summary) toast.info(`⚙️ ${byNickname}님이 룰 변경 — ${summary}`);
    };

    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('error', onErr);
    socket.on('reaction:received', onReaction);
    socket.on('chat:received', onChat);
    socket.on('room:rules-changed', onRulesChanged);

    return () => {
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('error', onErr);
      socket.off('reaction:received', onReaction);
      socket.off('chat:received', onChat);
      socket.off('room:rules-changed', onRulesChanged);
    };
  }, [setView, setError, clear]);
}

const RULE_LABEL: Partial<Record<keyof RoomRules, string>> = {
  winScore: '시작 점수',
  allowMyungttadak: '멍따',
  turnTimeLimitSec: '턴 시간',
  jokerCount: '조커',
  shakeBonusType: '흔들기 처리',
  bombStealCount: '폭탄 피',
  allowGukJoon: '국준',
};

function formatRuleChanges(changes: Partial<RoomRules>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(changes)) {
    const label = RULE_LABEL[k as keyof RoomRules] ?? k;
    parts.push(`${label} ${formatRuleValue(k as keyof RoomRules, v)}`);
  }
  return parts.join(', ');
}

function formatRuleValue(key: keyof RoomRules, value: unknown): string {
  if (key === 'winScore') return `${value}점`;
  if (key === 'turnTimeLimitSec') return value === 0 ? '없음' : `${value}초`;
  if (key === 'jokerCount') return value === 0 ? '없음' : `${value}장`;
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (key === 'shakeBonusType')
    return value === 'multiplier' ? '×2' : '+1점';
  if (key === 'bombStealCount') return `${value}장`;
  return String(value);
}
