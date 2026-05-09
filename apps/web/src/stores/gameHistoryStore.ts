import { create } from 'zustand';

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
  clear: () => void;
}

export const useGameHistoryStore = create<HistoryState>((set) => ({
  entries: load(),
  pushEntry: (entry) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const full: GameHistoryEntry = { ...entry, id, timestamp: Date.now() };
    set((state) => {
      const next = [full, ...state.entries].slice(0, MAX_HISTORY);
      save(next);
      return { entries: next };
    });
  },
  clear: () => {
    save([]);
    set({ entries: [] });
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
