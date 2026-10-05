const { Plugin, Modal, Notice } = require('obsidian');
const { spawn } = require('child_process');
const { existsSync, readFileSync, mkdirSync, writeFileSync } = require('fs');
const path = require('path');

class ResultModal extends Modal {
  constructor(app, output) { super(app); this.output = output; }
  onOpen() {
    this.contentEl.createEl('h2', { text: '笔记自动发布结果' });
    const output = this.contentEl.createEl('pre', { text: this.output || '还没有执行记录。' });
    Object.assign(output.style, { maxHeight: '60vh', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '12px' });
  }
}

module.exports = class HomepagePublisher extends Plugin {
  async onload() {
    this.settings = { sourceFolder: 'James-Vault', debounceSeconds: 15, ...(await this.loadData()) };
    this.publicNotes = new Set();
    this.publicAssets = new Set();
    this.running = false;
    this.pending = false;
    this.failures = 0;
    this.stopped = false;
    this.lastOutput = '';
    this.status = this.addStatusBarItem();
    this.refreshManifest();
    this.addCommand({ id: 'show-result', name: '查看自动发布结果', callback: () => new ResultModal(this.app, this.lastOutput).open() });
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      if (this.shouldSync(file, cache)) this.schedule();
    }));
    this.registerEvent(this.app.vault.on('modify', file => {
      if (this.shouldSync(file, this.app.metadataCache.getFileCache(file))) this.schedule();
    }));
    this.registerEvent(this.app.vault.on('create', file => {
      if (this.shouldSync(file, this.app.metadataCache.getFileCache(file))) this.schedule();
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      if (this.publicNotes.has(file.path) || this.publicAssets.has(file.path)) this.schedule();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (this.publicNotes.has(oldPath) || this.publicAssets.has(oldPath) || this.shouldSync(file, this.app.metadataCache.getFileCache(file))) this.schedule();
    }));
    this.app.workspace.onLayoutReady(() => { if (!this.stopped) this.schedule(); });
  }

  isSource(file) {
    const prefix = this.settings.sourceFolder.replace(/\/$/, '') + '/';
    return file.path.startsWith(prefix) && !file.path.split('/').some(part => part.startsWith('.') || part === 'Templates');
  }

  shouldSync(file, cache) {
    if (!this.isSource(file)) return false;
    if (this.publicNotes.has(file.path) || this.publicAssets.has(file.path)) return true;
    return file.extension === 'md' && cache?.frontmatter?.publish === true && cache.frontmatter.draft !== true;
  }

  refreshManifest() {
    const project = this.settings.projectPath;
    if (!project) return;
    try {
      const manifest = JSON.parse(readFileSync(path.join(project, 'content/manifest.json'), 'utf8'));
      const prefix = this.settings.sourceFolder.replace(/\/$/, '') + '/';
      this.publicNotes = new Set(manifest.notes.map(note => prefix + note.path));
      this.publicAssets = new Set(manifest.assets.map(asset => prefix + asset));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('无法读取公开笔记清单', error);
    }
  }

  schedule() {
    if (this.stopped) return;
    if (this.running) { this.pending = true; return; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.publish(), this.settings.debounceSeconds * 1000);
  }

  publish() {
    if (this.stopped || this.running) return;
    const project = this.settings.projectPath;
    if (!project || !existsSync(path.join(project, 'scripts/publish-notes.mjs'))) {
      new Notice('自动发布未启动：找不到个人网站项目。', 8000);
      return;
    }
    this.running = true;
    this.pending = false;
    this.status.setText('公开笔记同步中…');
    this.lastOutput = '';
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}` };
    const child = spawn('node', ['scripts/publish-notes.mjs'], { cwd: project, env });
    const append = chunk => { this.lastOutput = (this.lastOutput + chunk.toString()).slice(-150000); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', error => append(error.message + '\n'));
    child.on('close', code => {
      this.running = false;
      if (code === 0) this.refreshManifest();
      try {
        mkdirSync(path.join(project, '.local'), { recursive: true });
        writeFileSync(path.join(project, '.local/auto-publish.log'), this.lastOutput);
      } catch (error) { console.error('保存发布记录失败', error); }
      if (!this.stopped) {
        this.status.setText(code === 0 ? '' : '笔记自动发布失败');
        if (code !== 0) {
          this.failures += 1;
          if (this.failures === 1) new Notice('笔记自动发布失败，将自动重试。可在命令面板选择「个人网站发布：查看自动发布结果」。', 10000);
          this.timer = setTimeout(() => this.publish(), Math.min(300000, 30000 * 2 ** Math.min(this.failures - 1, 4)));
        } else {
          this.failures = 0;
          if (this.lastOutput.includes('推送成功')) new Notice('公开笔记已推送，等待网站部署完成。', 6000);
        }
        if (this.pending) this.schedule();
      }
    });
  }

  onunload() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
};
