import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { root, exportVault, exportFingerprint, sourceFingerprint, replaceExport, vaultSettings } from './sync-notes.mjs';
const { resolveSource } = createRequire(import.meta.url)('../integrations/obsidian-homepage-publisher/source-root.cjs');

function command(file, args, { cwd, capture = false, env = {} }) {
  const result = spawnSync(file, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${file} ${args.join(' ')} 失败。请处理上方错误后重新运行；已生成的笔记和提交会保留。${result.stderr ? `\n${result.stderr.trim()}` : ''}`);
    error.stderr = result.stderr || '';
    throw error;
  }
  return result.stdout || '';
}

// Network/credential failures heal via the plugin's automatic retry; anything
// else signals repository state that needs manual intervention.
const TRANSIENT_GIT_ERRORS = [
  /could not resolve hostname/i,
  /timed out/i,
  /connection (?:reset|refused)/i,
  /could not read username/i,
  /permission denied \(publickey\)/i,
  /authentication failed/i,
  /remote end hung up/i,
  /failed to connect/i,
  /ssl_error|ssl certificate/i,
];
export function isTransientGitError(text) {
  return TRANSIENT_GIT_ERRORS.some(re => re.test(text || ''));
}
function gitTransportError(verb, error) {
  const detail = String(error.stderr || error.message).trim();
  if (isTransientGitError(detail))
    return new Error(`git ${verb} 失败：无法连接 GitHub（网络或凭据问题）。请检查网络/VPN/代理或 GitHub 凭据；已生成的笔记和提交会保留，将自动重试。\n原始错误：${detail}`);
  return new Error(`git ${verb} 失败（仓库状态问题），需要手工处理；已生成的笔记和提交会保留。\n原始错误：${detail}`);
}

export async function publishNotes({ cwd = root, checkOnly = false, run = command, log = console.log, sourceIdentity = { id: process.env.HOMEPAGE_SOURCE_ID, vaultRoot: process.env.HOMEPAGE_VAULT_ROOT } } = {}) {
  const git = (...args) => run('git', args, { cwd, capture: true }).trim();
  const ensureRepository = () => {
    if (git('branch', '--show-current') !== 'main') throw new Error('请先回到 main 分支，再发布笔记。');
    const staged = git('diff', '--cached', '--name-only');
    if (staged) {
      // A publisher killed between `git add` and `git commit` leaves only content/ staged.
      const hint = staged.split('\n').every(name => name.startsWith('content/'))
        ? '（暂存的改动全部在 content/ 下，可能是上次发布中断的残留，可运行 `git restore --staged content` 后重试。）' : '';
      throw new Error('暂存区中有其他改动。请先完成或取消暂存，再发布笔记。' + hint);
    }
    const modified = git('diff', '--name-only', '-z').split('\0').filter(Boolean);
    if (modified.some(name => !name.startsWith('content/'))) throw new Error('网站代码有未提交修改。请先处理这些修改，再发布笔记。');
  };
  ensureRepository();

  const { vaultPath, destination } = await vaultSettings(cwd);
  async function validateSource() {
    if (!sourceIdentity?.id) return;
    const vaultRoot = sourceIdentity.vaultRoot;
    if (!vaultRoot) throw new Error('缺少 Obsidian 仓库根路径。');
    const resolved = await resolveSource({ vaultRoot, sourceFolder: path.relative(vaultRoot, vaultPath), sourceId: sourceIdentity.id });
    if (resolved.vaultPath !== path.resolve(vaultPath)) throw new Error('源目录已移动，请重新检查。');
  }
  await validateSource();
  log('1/4 检查完整公开快照…');
  const before = await sourceFingerprint(vaultPath);
  const local = path.join(cwd, '.local');
  await fs.mkdir(local, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(local, 'candidate-'));
  try {
    const candidate = path.join(temporary, 'content');
    const result = await exportVault({ vaultPath, destination: candidate });
    for (const warning of result.warnings) log(warning);
    const ensureStable = async () => {
      await validateSource();
      if (before !== await sourceFingerprint(vaultPath)) throw new Error('源文件发生变化，放弃当前候选，等待下一次检查。');
    };
    await ensureStable();
    const digest = await exportFingerprint(candidate);
    let changed = digest !== await exportFingerprint(destination);
    const pending = Number(git('rev-list', '--count', 'origin/main..HEAD'));
    if (!changed && !pending && !checkOnly) {
      log('公开快照没有变化，无需构建或推送。');
      return;
    }
    if (!checkOnly) {
      log('2/4 检查 GitHub 上的最新版本…');
      try { run('git', ['fetch', 'origin', 'main'], { cwd, capture: true }); }
      catch (error) { throw gitTransportError('fetch', error); }
      const [ahead, behind] = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split(/\s+/).map(Number);
      if (ahead && behind) throw new Error('本机与 GitHub 的版本已经分叉，请先处理 Git 冲突，再发布笔记。');
      if (behind) run('git', ['merge', '--ff-only', 'origin/main'], { cwd });
      changed = digest !== await exportFingerprint(destination);
    }
    log('3/4 验证候选快照和网站构建…');
    const env = { HOMEPAGE_CONTENT_DIR: candidate, HOMEPAGE_DIST_DIR: path.join(temporary, 'dist') };
    for (const args of [['test'], ['run', 'build'], ['run', 'verify']]) run('npm', args, { cwd, env });
    ensureRepository();
    await ensureStable();
    if (changed) await replaceExport(candidate, destination);
    if (checkOnly) {
      log('检查通过。公开笔记已同步到本机，没有提交或推送。');
      return;
    }
    // Only the validated public export is staged; untracked files stay local.
    run('git', ['add', '-A', '--', 'content'], { cwd });
    if (git('diff', '--cached', '--name-only')) run('git', ['commit', '-m', 'Update public Obsidian notes'], { cwd });
    if (!Number(git('rev-list', '--count', 'origin/main..HEAD'))) {
      log('公开快照没有变化，无需推送。');
      return;
    }
    log('4/4 推送公开笔记，触发网站部署…');
    try { run('git', ['push', 'origin', 'main'], { cwd, capture: true }); }
    catch (error) { throw gitTransportError('push', error); }
    log('推送成功，等待网站部署完成。');
    log('部署状态：https://github.com/cool-hotdog/cool-hotdog.github.io/actions');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

const STALE_LOCK_MS = 30 * 60 * 1000;
const EMPTY_LOCK_MS = 60 * 1000;
const CANDIDATE_TTL_MS = 60 * 60 * 1000;

// Lock format: `hostname:pid:startedAtMs`. Legacy locks hold only the pid.
function parseLock(content) {
  const parts = content.trim().split(':');
  if (parts.length === 1 && /^\d+$/.test(parts[0])) return { hostname: null, pid: Number(parts[0]), startedAt: null };
  if (parts.length >= 3) {
    const startedAt = Number(parts[parts.length - 1]);
    const pid = Number(parts[parts.length - 2]);
    const hostname = parts.slice(0, -2).join(':');
    if (hostname && pid > 0 && startedAt > 0) return { hostname, pid, startedAt };
  }
  return null;
}

export async function acquireLock(lock, { hostname = os.hostname(), now = () => Date.now(), kill = (pid, signal) => process.kill(pid, signal), staleMs = STALE_LOCK_MS, log = console.warn } = {}) {
  let handle;
  try {
    handle = await fs.open(lock, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let content;
    try { content = await fs.readFile(lock, 'utf8'); }
    catch (readError) {
      if (readError.code === 'ENOENT') return acquireLock(lock, { hostname, now, kill, staleMs, log }); // holder exited between open and read
      throw readError;
    }
    const info = parseLock(content);
    let reason = '';
    if (info?.pid) {
      if (info.hostname && info.hostname !== hostname) reason = `来自机器 ${info.hostname} 的残留锁`;
      else {
        try { kill(info.pid, 0); }
        catch (killError) {
          if (killError.code === 'ESRCH') reason = '持锁进程已退出';
          else if (killError.code !== 'EPERM') throw killError; // EPERM: another user's live process still counts as running
        }
        if (!reason && info.startedAt && now() - info.startedAt > staleMs) {
          // A live holder this old is stuck (e.g. a build frozen on iCloud I/O).
          // Kill it instead of just unlinking, or two publishers would run at once.
          try { kill(info.pid, 'SIGTERM'); } catch { /* already gone */ }
          reason = `持锁超过 ${Math.round(staleMs / 60000)} 分钟，判定为卡死`;
        }
      }
    } else if (!content.trim()) {
      // Empty lock: a publisher died between creating the file and writing it.
      const stat = await fs.stat(lock).catch(() => null);
      if (stat && now() - stat.mtimeMs > EMPTY_LOCK_MS) reason = '空锁文件已过期';
    }
    if (!reason) throw new Error(info?.pid ? '已有发布程序正在运行，请等它结束。' : '另一个发布程序正在启动，请稍后再试。');
    log(`回收过期锁（${reason}）`);
    await fs.unlink(lock);
    return acquireLock(lock, { hostname, now, kill, staleMs, log });
  }
  await handle.writeFile(`${hostname}:${process.pid}:${now()}`);
  return handle;
}

// Candidates survive only when a publisher was force-killed (its finally never
// ran). Holding the lock plus a generous TTL makes deletion safe.
export async function cleanStaleCandidates(local, { nowMs = Date.now(), ttlMs = CANDIDATE_TTL_MS, log = console.warn } = {}) {
  for (const entry of await fs.readdir(local, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('candidate-')) continue;
    try {
      const stat = await fs.stat(path.join(local, entry.name));
      if (nowMs - stat.mtimeMs > ttlMs) {
        await fs.rm(path.join(local, entry.name), { recursive: true, force: true });
        log(`清理过期候选目录 ${entry.name}`);
      }
    } catch (error) { log(`清理候选目录 ${entry.name} 失败：${error.message}`); }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('用法：npm run notes:publish [-- --check]');
  const local = path.join(root, '.local');
  await fs.mkdir(local, { recursive: true });
  const lock = path.join(local, 'publish-notes.lock');
  const handle = await acquireLock(lock);
  try {
    await cleanStaleCandidates(local);
    await publishNotes({ checkOnly: args.includes('--check') });
  } finally {
    await handle.close();
    await fs.unlink(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\n发布停止：${error.message}`); process.exitCode = 1; });
}
