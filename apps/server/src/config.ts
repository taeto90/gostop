export const config = {
  PORT: Number(process.env.PORT ?? 4000),
  HOST: process.env.HOST ?? '0.0.0.0',
  // dev 환경 — localhost / 127.0.0.1 둘 다 허용 (playwright 호환).
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  LIVEKIT_URL: process.env.LIVEKIT_URL ?? '',
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ?? '',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? '',
  // Supabase — game_logs 테이블 batch insert용 (server-side, service role key 필요)
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? '',
} as const;
