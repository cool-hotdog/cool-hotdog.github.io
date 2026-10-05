const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const markerName = '.homepage-publisher-source.json';

function sourceError(message) { const error = new Error(message); error.code = 'SOURCE_UNAVAILABLE'; return error; }
function allowed(folder) {
  return folder && !path.isAbsolute(folder) && !folder.split(/[\\/]/).some(p => p.startsWith('.') || p === 'Templates');
}
async function readMarker(directory) {
  try {
    const marker = JSON.parse(await fs.readFile(path.join(directory, markerName), 'utf8'));
    if (typeof marker.id !== 'string' || !marker.id) throw sourceError('源目录身份标记无效，请在插件设置中重新选择目录。');
    return marker.id;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function resolveSource({ vaultRoot, sourceFolder, sourceId, initialize = false }) {
  const root = await fs.realpath(vaultRoot);
  let id = sourceId;
  if (!id) {
    if (!initialize || !allowed(sourceFolder)) throw sourceError('找不到源目录身份，请在插件设置中选择源目录。');
    const selected = path.resolve(root, sourceFolder);
    let real;
    try { real = await fs.realpath(selected); } catch (error) { if (error.code === 'ENOENT') throw sourceError('源目录不存在，请重新选择。'); throw error; }
    if (!real.startsWith(root + path.sep) || real !== selected || !(await fs.stat(real)).isDirectory()) throw sourceError('源目录必须是当前 Obsidian 仓库内的普通文件夹。');
    id = await readMarker(real);
    if (!id) {
      id = randomUUID();
      try { await fs.writeFile(path.join(real, markerName), JSON.stringify({ id }, null, 2) + '\n', { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; id = await readMarker(real); }
    }
  }
  const matches = [];
  async function scan(directory) {
    if (await readMarker(directory) === id) matches.push(directory);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'Templates') await scan(path.join(directory, entry.name));
    }
  }
  await scan(root);
  if (matches.length !== 1) throw sourceError(matches.length ? '发现多个相同身份的源目录，请在插件设置中选择并重新绑定。' : '源目录已删除或移出当前仓库，请在插件设置中重新选择。');
  const vaultPath = matches[0];
  return { sourceId: id, sourceFolder: path.relative(root, vaultPath).split(path.sep).join('/'), vaultPath };
}

async function bindSource(vaultRoot, sourceFolder) {
  if (!allowed(sourceFolder)) throw sourceError('请选择仓库内的普通文件夹。');
  const root = await fs.realpath(vaultRoot), selected = path.resolve(root, sourceFolder);
  const real = await fs.realpath(selected);
  if (real !== selected || !real.startsWith(root + path.sep) || !(await fs.stat(real)).isDirectory()) throw sourceError('源目录必须位于当前 Obsidian 仓库内。');
  const id = randomUUID();
  await fs.writeFile(path.join(real, markerName), JSON.stringify({ id }, null, 2) + '\n');
  return resolveSource({ vaultRoot: root, sourceFolder, sourceId: id });
}

module.exports = { resolveSource, bindSource, markerName };
