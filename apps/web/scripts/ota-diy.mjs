// DIY OTA 배포 — dist를 zip으로 압축해 Supabase Storage public 'ota' 버킷에 업로드.
//   실행: pnpm --filter @gostop/web ota:diy   (= pnpm build:app && node --env-file=.env scripts/ota-diy.mjs)
//   필요 env (apps/web/.env, gitignored): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   - SERVICE 키는 VITE_ 접두사가 없어 앱 번들에 노출 안 됨 (이 스크립트=Node에서만 사용).
//   사전 준비: Supabase에 public 버킷 'ota' 1개 생성.
import { readFileSync, existsSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

// archiver는 CommonJS — .mjs에서 default import 안 되므로 createRequire로 로드.
const archiver = createRequire(import.meta.url)('archiver');

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(webRoot, 'dist');
const version = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8')).version;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'ota';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 apps/web/.env 에 필요합니다.');
  process.exit(1);
}
if (!existsSync(distDir)) {
  console.error('❌ dist 없음 — `pnpm build:app` 먼저 (ota:diy 스크립트가 자동 실행합니다).');
  process.exit(1);
}

// 1) dist 내용을 zip (index.html이 zip 루트에 오도록 contents만 담음)
const zipPath = resolve(tmpdir(), `gostop-bundle-${version}.zip`);
await new Promise((res, rej) => {
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', res);
  archive.on('error', rej);
  archive.pipe(output);
  archive.directory(distDir, false);
  archive.finalize();
});
console.log(`📦 zip 생성: gostop-bundle-${version}.zip`);

// 2) Supabase Storage 업로드 (upsert)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const zipKey = `bundle-${version}.zip`;

const zipUp = await supabase.storage.from(BUCKET).upload(zipKey, readFileSync(zipPath), {
  contentType: 'application/zip',
  upsert: true,
});
if (zipUp.error) {
  console.error('❌ 번들 zip 업로드 실패:', zipUp.error.message);
  console.error('   → Supabase에 public 버킷 "ota" 가 있는지 확인하세요.');
  process.exit(1);
}

const publicZipUrl = supabase.storage.from(BUCKET).getPublicUrl(zipKey).data.publicUrl;
const manifest = JSON.stringify({ version, url: publicZipUrl });
const manUp = await supabase.storage.from(BUCKET).upload('latest.json', Buffer.from(manifest), {
  contentType: 'application/json',
  upsert: true,
});
if (manUp.error) {
  console.error('❌ latest.json 업로드 실패:', manUp.error.message);
  process.exit(1);
}

console.log(`✅ DIY OTA 배포 완료 — v${version}`);
console.log(`   manifest: ${SUPABASE_URL}/storage/v1/object/public/ota/latest.json`);
