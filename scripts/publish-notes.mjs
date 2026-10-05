import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { root, exportVault, exportFingerprint, sourceFingerprint, replaceExport, vaultSettings } from './sync-notes.mjs';
const { resolveSource } = createRequire(import.meta.url)('../integrations/obsidian-homepage-publisher/source-root.cjs');

function command(file, args, { cwd, capture = false, env = {} }) {
  const result = spawnSync(file, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} ${args.join(' ')} 失败。请处理上方错误后重新运行；已生成的笔记和提交会保留。`);
  return result.stdout || '';
}

export async function publishNotes({ cwd = root, checkOnly = false, run = command, log = console.log, sourceIdentity = { id: process.env.HOMEPAGE_SOURCE_ID, vaultRoot: process.env.HOMEPAGE_VAULT_ROOT } } = {}) {
  const git = (...args) => run('git', args, { cwd, capture: true }).trim();
  if (git('branch', '--show-current') !== 'main') throw new Error('请先回到 main 分支，再发布笔记。');
  if (git('diff', '--cached', '--name-only')) throw new Error('暂存区中有其他改动。请先完成或取消暂存，再发布笔记。');
  const modified = git('diff', '--name-only', '-z').split('\0').filter(Boolean);
  if (modified.some(name => !name.startsWith('content/'))) throw new Error('网站代码有未提交修改。请先处理这些修改，再发布笔记。');

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
      run('git', ['fetch', 'origin', 'main'], { cwd });
      const [ahead, behind] = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split(/\s+/).map(Number);
      if (ahead && behind) throw new Error('本机与 GitHub 的版本已经分叉，请先处理 Git 冲突，再发布笔记。');
      if (behind) run('git', ['merge', '--ff-only', 'origin/main'], { cwd });
      changed = digest !== await exportFingerprint(destination);
    }
    log('3/4 验证候选快照和网站构建…');
    const env = { HOMEPAGE_CONTENT_DIR: candidate, HOMEPAGE_DIST_DIR: path.join(temporary, 'dist') };
    for (const args of [['test'], ['run', 'build'], ['run', 'verify']]) run('npm', args, { cwd, env });
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
    run('git', ['push', 'origin', 'main'], { cwd });
    log('推送成功，等待网站部署完成。');
    log('部署状态：https://github.com/cool-hotdog/cool-hotdog.github.io/actions');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('用法：npm run notes:publish [-- --check]');
  const local = path.join(root, '.local');
  await fs.mkdir(local, { recursive: true });
  const lock = path.join(local, 'publish-notes.lock');
  let handle;
  try {
    handle = await fs.open(lock, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await fs.readFile(lock, 'utf8'));
    if (!pid) throw new Error('另一个发布程序正在启动，请稍后再试。');
    try { process.kill(pid, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw error;
      await fs.unlink(lock);
      return main();
    }
    throw new Error('已有发布程序正在运行，请等它结束。');
  }
  try {
    await handle.writeFile(String(process.pid));
    await publishNotes({ checkOnly: args.includes('--check') });
  } finally {
    await handle.close();
    await fs.unlink(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\n发布停止：${error.message}`); process.exitCode = 1; });
}
