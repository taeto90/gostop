/**
 * Windows 포트 점유 프로세스 강제 종료.
 * pnpm dev 시 이전 좀비 node 프로세스가 포트를 점유하고 있으면 자동 종료.
 *
 * Usage: node scripts/kill-port.js 4000
 */
const { execSync } = require('child_process');

const port = process.argv[2] || '4000';

try {
  const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
    encoding: 'utf8',
  });
  const pids = new Set();
  for (const line of out.trim().split('\n')) {
    const pid = line.trim().split(/\s+/).pop();
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`[kill-port] port ${port} — killed PID ${pid}`);
    } catch {
      // already dead
    }
  }
} catch {
  // no process listening — ok
}
