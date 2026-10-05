import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { root } from './sync-notes.mjs';

function command(file, args, { cwd, capture = false }) {
  const result = spawnSync(file, args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} ${args.join(' ')} 失败。请处理上方错误后重新运行；已生成的笔记和提交会保留。`);
  return result.stdout || '';
}

export async function publishNotes({ cwd = root, checkOnly = false, run = command, log = console.log } = {}) {
  const git = (...args) => run('git', args, { cwd, capture: true }).trim();
  if (git('branch', '--show-current') !== 'main') throw new Error('请先回到 main 分支，再发布笔记。');
  if (git('diff', '--cached', '--name-only')) throw new Error('暂存区中有其他改动。请先完成或取消暂存，再发布笔记。');
  const modified = git('diff', '--name-only', '-z').split('\0').filter(Boolean);
  if (modified.some(name => !name.startsWith('content/'))) throw new Error('网站代码有未提交修改。请先处理这些修改，再发布笔记。');

  if (!checkOnly) {
    log('1/4 检查 GitHub 上的最新版本…');
    run('git', ['fetch', 'origin', 'main'], { cwd });
    const [ahead, behind] = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split(/\s+/).map(Number);
    if (ahead && behind) throw new Error('本机与 GitHub 的版本已经分叉，请先处理 Git 冲突，再发布笔记。');
    if (behind) run('git', ['merge', '--ff-only', 'origin/main'], { cwd });
  }
  log('2/4 同步 Obsidian 中的公开笔记…');
  run('npm', ['run', 'notes:sync'], { cwd });
  log('3/4 检查笔记和网站构建…');
  for (const args of [['test'], ['run', 'build'], ['run', 'verify']]) run('npm', args, { cwd });
  if (checkOnly) {
    log('检查通过。公开笔记已同步到本机，没有提交或推送。');
    return;
  }
  // Only the public export is staged; other untracked files remain local.
  run('git', ['add', '-A', '--', 'content'], { cwd });
  if (git('diff', '--cached', '--name-only')) {
    run('git', ['commit', '-m', 'Update public Obsidian notes'], { cwd });
  }
  const ahead = Number(git('rev-list', '--count', 'origin/main..HEAD'));
  if (!ahead) {
    log('公开笔记没有变化，无需更新网站。');
    return;
  }
  log('4/4 推送公开笔记，触发网站部署…');
  run('git', ['push', 'origin', 'main'], { cwd });
  log('推送成功，GitHub 正在自动构建和部署。部署完成后刷新 https://cool-hotdog.github.io/notes/ 查看。');
  log('部署状态：https://github.com/cool-hotdog/cool-hotdog.github.io/actions');
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
