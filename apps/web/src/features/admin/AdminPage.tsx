import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase.ts';
import { useAuthStore } from '../../stores/authStore.ts';

interface ErrorLog {
  id: number;
  room_id: string;
  ts: number;
  payload: {
    source?: string;
    message?: string;
    context?: Record<string, unknown>;
    userId?: string;
    fromClient?: boolean;
    env?: string;
  };
  created_at: string;
}

interface GameLog {
  id: number;
  room_id: string;
  game_instance_id: number;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ProfileRow {
  id: string;
  nickname: string;
  emoji_avatar: string;
  email: string | null;
}

type Tab = 'errors' | 'games' | 'users';

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('errors');

  useEffect(() => {
    if (!supabase || !user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (isAdmin === null) {
    return <Loading />;
  }
  if (!isAdmin) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-xl font-bold text-amber-400">Admin</h1>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-slate-400 hover:text-white"
        >
          로비로 돌아가기
        </button>
      </header>

      <div className="flex border-b border-slate-800">
        {(['errors', 'games', 'users'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium transition ${
              tab === t
                ? 'border-b-2 border-amber-400 text-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'errors' ? '에러 로그' : t === 'games' ? '게임 로그' : '유저 관리'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'errors' && <ErrorLogPanel />}
        {tab === 'games' && <GameLogPanel />}
        {tab === 'users' && <UserPanel />}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className="text-slate-400">확인 중...</p>
    </div>
  );
}

function ErrorLogPanel() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('all');

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    let query = supabase
      .from('game_logs')
      .select('*')
      .eq('type', 'error')
      .order('created_at', { ascending: false })
      .limit(100);
    if (source !== 'all') {
      query = query.ilike('payload->>source', `%${source}%`);
    }
    query.then(({ data, error }) => {
      if (error) console.warn('[admin] error logs query failed:', error.message);
      setLogs((data as ErrorLog[]) ?? []);
      setLoading(false);
    });
  }, [source]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-bold">에러 로그</h2>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          <option value="all">전체</option>
          <option value="server">서버</option>
          <option value="client">클라이언트</option>
        </select>
        <span className="text-sm text-slate-500">{logs.length}건</span>
      </div>
      {loading ? (
        <p className="text-slate-500">로딩 중...</p>
      ) : logs.length === 0 ? (
        <p className="text-slate-500">에러 로그가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <ErrorLogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorLogCard({ log }: { log: ErrorLog }) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.created_at).toLocaleString('ko-KR');
  const isClient = log.payload.fromClient;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              isClient
                ? 'bg-blue-900/50 text-blue-300'
                : 'bg-red-900/50 text-red-300'
            }`}
          >
            {isClient ? 'CLIENT' : 'SERVER'}
          </span>
          <span className="text-sm font-medium text-white">
            {log.payload.source ?? 'unknown'}
          </span>
          {log.room_id !== 'no-room' && (
            <span className="font-mono text-xs text-slate-500">
              {log.room_id}
            </span>
          )}
          <span className="text-sm text-slate-400">
            {log.payload.message?.slice(0, 80)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {log.payload.env === 'production' ? 'PROD' : 'DEV'}
          </span>
          <span className="text-xs text-slate-500">{time}</span>
          <span className="text-slate-500">{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <pre className="mt-3 max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">
          {JSON.stringify(log.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function GameLogPanel() {
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    let query = supabase
      .from('game_logs')
      .select('*')
      .neq('type', 'error')
      .order('created_at', { ascending: false })
      .limit(100);
    if (typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }
    query.then(({ data, error }) => {
      if (error) console.warn('[admin] game logs query failed:', error.message);
      setLogs((data as GameLog[]) ?? []);
      setLoading(false);
    });
  }, [typeFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-bold">게임 로그</h2>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          <option value="all">전체</option>
          <option value="game-start">game-start</option>
          <option value="play-card">play-card</option>
          <option value="game-end">game-end</option>
        </select>
        <span className="text-sm text-slate-500">{logs.length}건</span>
      </div>
      {loading ? (
        <p className="text-slate-500">로딩 중...</p>
      ) : logs.length === 0 ? (
        <p className="text-slate-500">게임 로그가 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-400">
              <th className="px-3 py-2">시간</th>
              <th className="px-3 py-2">방</th>
              <th className="px-3 py-2">인스턴스</th>
              <th className="px-3 py-2">타입</th>
              <th className="px-3 py-2">상세</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <GameLogRow key={log.id} log={log} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function GameLogRow({ log }: { log: GameLog }) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.created_at).toLocaleString('ko-KR');
  const turnShift = log.payload.turnShift as { orderValid?: boolean } | undefined;
  const cardCheck = log.payload.cardCheck as { valid?: boolean } | undefined;
  const hasIssue =
    turnShift?.orderValid === false ||
    cardCheck?.valid === false ||
    log.payload.stealValid === false;

  return (
    <>
      <tr
        className={`cursor-pointer border-b border-slate-800/50 hover:bg-slate-800/30 ${
          hasIssue ? 'bg-red-950/20' : ''
        }`}
        onClick={() => setOpen(!open)}
      >
        <td className="px-3 py-2 text-xs text-slate-400">{time}</td>
        <td className="px-3 py-2 font-mono text-xs">{log.room_id}</td>
        <td className="px-3 py-2 text-center text-xs">{log.game_instance_id}</td>
        <td className="px-3 py-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs">
            {log.type}
          </span>
          {hasIssue && (
            <span className="ml-2 rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-300">
              이상
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-slate-500">
          {open ? '▲' : '▼'}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-slate-950 px-3 py-2">
            <pre className="max-h-60 overflow-auto text-xs text-slate-300">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function UserPanel() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('profiles')
      .select('id, nickname, emoji_avatar, email')
      .order('nickname')
      .then(({ data, error }) => {
        if (error) console.warn('[admin] users query failed:', error.message);
        setUsers((data as ProfileRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-bold">유저 관리</h2>
        <span className="text-sm text-slate-500">{users.length}명</span>
      </div>
      {loading ? (
        <p className="text-slate-500">로딩 중...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-400">
              <th className="px-3 py-2">아바타</th>
              <th className="px-3 py-2">닉네임</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/50">
                <td className="px-3 py-2 text-2xl">{u.emoji_avatar}</td>
                <td className="px-3 py-2 font-medium text-white">{u.nickname}</td>
                <td className="px-3 py-2 text-slate-400">{u.email ?? '-'}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {u.id.slice(0, 8)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
