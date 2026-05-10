import { create } from 'zustand';
import { supabase } from '../lib/supabase.ts';

export interface HistoryPlayerEntry {
  userId: string;
  nickname: string;
  emojiAvatar: string;
  finalScore: number;
  isWinner: boolean;
}

export interface GameHistoryEntry {
  id: string;
  timestamp: number;
  /** 'solo' = AI 대전, 'multi' = 친구 멀티 */
  mode: 'solo' | 'multi';
  myUserId: string;
  myFinalScore: number;
  amWinner: boolean;
  /** 모든 player (광팔이 spectator 제외) */
  players: HistoryPlayerEntry[];
  /** 박/특수 flag (있을 때만) */
  flags: {
    chongtong?: boolean;
    pibak?: boolean;
    gwangbak?: boolean;
    myungbak?: boolean;
    myungttadak?: boolean;
    gobak?: boolean;
    ppeoksCausedWin?: boolean;
    nagariMultiplier?: number;
    goCount?: number;
  };
}

const MAX_HISTORY = 50;
const STORAGE_KEY = 'gostop:history';

function load(): GameHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function save(entries: GameHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

interface HistoryState {
  entries: GameHistoryEntry[];
  /** 새 게임 결과 추가 (최신 50판만 유지) */
  pushEntry: (entry: Omit<GameHistoryEntry, 'id' | 'timestamp'>) => void;
  /** Supabase에서 본인 entries fetch — 다른 기기에서 쌓은 전적 끌어오기 */
  syncFromCloud: (myUserId: string) => Promise<void>;
  clear: () => void;
}

/** entry → Supabase row */
function toRow(e: GameHistoryEntry, myUserId: string) {
  return {
    id: e.id,
    user_id: myUserId,
    timestamp: e.timestamp,
    mode: e.mode,
    my_user_id: e.myUserId,
    my_final_score: e.myFinalScore,
    am_winner: e.amWinner,
    players: e.players,
    flags: e.flags,
  };
}

/** Supabase row → entry */
interface DbRow {
  id: string;
  timestamp: number;
  mode: 'solo' | 'multi';
  my_user_id: string;
  my_final_score: number;
  am_winner: boolean;
  players: HistoryPlayerEntry[];
  flags: GameHistoryEntry['flags'];
}
function fromRow(r: DbRow): GameHistoryEntry {
  return {
    id: r.id,
    timestamp: r.timestamp,
    mode: r.mode,
    myUserId: r.my_user_id,
    myFinalScore: r.my_final_score,
    amWinner: r.am_winner,
    players: r.players,
    flags: r.flags,
  };
}

/** 두 entries 병합 — id 기준 dedupe, timestamp 내림차순. 최대 MAX_HISTORY */
function mergeEntries(
  a: GameHistoryEntry[],
  b: GameHistoryEntry[],
): GameHistoryEntry[] {
  const map = new Map<string, GameHistoryEntry>();
  for (const e of [...a, ...b]) map.set(e.id, e);
  return Array.from(map.values())
    .sort((x, y) => y.timestamp - x.timestamp)
    .slice(0, MAX_HISTORY);
}

export const useGameHistoryStore = create<HistoryState>((set, get) => ({
  entries: load(),
  pushEntry: (entry) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const full: GameHistoryEntry = { ...entry, id, timestamp: Date.now() };
    set((state) => {
      const next = [full, ...state.entries].slice(0, MAX_HISTORY);
      save(next);
      return { entries: next };
    });
    // Supabase에도 mirror — 본인 myUserId 키로 저장. 실패 시 silently 무시 (offline OK)
    if (supabase) {
      void supabase
        .from('game_history')
        .insert(toRow(full, entry.myUserId))
        .then(({ error }) => {
          if (error) console.warn('[history] supabase insert 실패:', error.message);
        });
    }
  },
  syncFromCloud: async (myUserId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('user_id', myUserId)
      .order('timestamp', { ascending: false })
      .limit(MAX_HISTORY);
    if (error) {
      console.warn('[history] supabase select 실패:', error.message);
      return;
    }
    if (!data) return;
    const cloudEntries = data.map((r) => fromRow(r as DbRow));
    set((state) => {
      const merged = mergeEntries(state.entries, cloudEntries);
      save(merged);
      return { entries: merged };
    });
  },
  clear: () => {
    save([]);
    set({ entries: [] });
    // Supabase도 정리 (현재 entries의 user_id로) — fetch + delete
    if (supabase) {
      const myId = get().entries[0]?.myUserId;
      if (myId) {
        void supabase
          .from('game_history')
          .delete()
          .eq('user_id', myId)
          .then(({ error }) => {
            if (error) console.warn('[history] supabase delete 실패:', error.message);
          });
      }
    }
  },
}));

/** 친구별 (userId → 누적 통계) */
export interface PlayerStats {
  userId: string;
  nickname: string;
  emojiAvatar: string;
  rounds: number;
  wins: number;
  totalScore: number;
  bestScore: number;
}

export function aggregatePlayerStats(entries: GameHistoryEntry[]): PlayerStats[] {
  const map = new Map<string, PlayerStats>();
  for (const e of entries) {
    for (const p of e.players) {
      const existing = map.get(p.userId);
      if (existing) {
        existing.rounds += 1;
        if (p.isWinner) existing.wins += 1;
        existing.totalScore += p.finalScore;
        if (p.finalScore > existing.bestScore) existing.bestScore = p.finalScore;
      } else {
        map.set(p.userId, {
          userId: p.userId,
          nickname: p.nickname,
          emojiAvatar: p.emojiAvatar,
          rounds: 1,
          wins: p.isWinner ? 1 : 0,
          totalScore: p.finalScore,
          bestScore: p.finalScore,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.wins - a.wins);
}
