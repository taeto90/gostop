-- game_logs: 매 게임 액션 로그 (서버 측 NODE_ENV 무관 활성)
-- Supabase Studio → SQL Editor에서 실행하거나 supabase CLI로 적용.

create table if not exists public.game_logs (
  id bigserial primary key,
  room_id text not null,
  game_instance_id integer not null default 0,
  ts bigint not null,             -- 액션 시점 (ms since epoch)
  type text not null,             -- 'game-start' | 'play-card' | 'game-end' | ...
  payload jsonb not null,         -- 전체 entry (validation 결과 + 카드 상태 등)
  created_at timestamptz not null default now()
);

-- 게임 단위 조회
create index if not exists game_logs_room_idx
  on public.game_logs(room_id, game_instance_id, ts);

-- 최근 게임 timeline
create index if not exists game_logs_created_idx
  on public.game_logs(created_at desc);

-- 액션 type별 필터링 (예: game-end 추출)
create index if not exists game_logs_type_idx
  on public.game_logs(type);

-- RLS: service role만 insert. 일반 anon은 접근 불가 (디버깅 도구는 admin DB 직접 접속).
alter table public.game_logs enable row level security;

-- (anon/public 권한 정책 명시 X — 기본 deny)
