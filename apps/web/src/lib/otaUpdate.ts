import { Capacitor } from '@capacitor/core';
import pkg from '../../package.json';

/** Supabase Storage public 'ota' 버킷의 매니페스트 URL (VITE_SUPABASE_URL 기반). */
const MANIFEST_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1/object/public/ota/latest.json`;

interface OtaManifest {
  version: string;
  url: string;
}

/**
 * DIY OTA (Capgo Cloud 미사용) — 앱(Capacitor) 시작 시 1회 호출.
 *
 * 1) `notifyAppReady()` — 현재 번들 정상 로드 알림 (없으면 일정 시간 후 이전 번들로 자동 롤백)
 * 2) Supabase의 `latest.json` 확인 → `version`이 현재 번들보다 높으면
 *    `download` + `set` (다음 앱 실행 시 적용 — 게임 중 즉시 reload는 끊김 방지로 안 함)
 *
 * 웹/오프라인/오류면 조용히 패스(다음 실행에 재시도). 번들 zip 다운로드는 네이티브라 CORS 무관.
 */
export async function checkForOtaUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.notifyAppReady().catch(() => {});

  if (!import.meta.env.VITE_SUPABASE_URL) return;
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const manifest = (await res.json()) as OtaManifest;
    if (!manifest?.version || !manifest?.url) return;
    if (!isNewer(manifest.version, pkg.version)) return;

    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });
    await CapacitorUpdater.set(bundle); // 다음 실행 시 적용
  } catch {
    /* 네트워크 오류 등 — 다음 실행에 재시도 */
  }
}

/** semver(major.minor.patch) 비교 — a가 b보다 높으면 true (다운그레이드 방지). */
function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}
