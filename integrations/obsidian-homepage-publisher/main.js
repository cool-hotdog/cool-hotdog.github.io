const { Plugin, Modal, Notice, PluginSettingTab, Setting } = require('obsidian');
const { spawn } = require('child_process');
const { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } = require('fs');
const path = require('path');

class ResultModal extends Modal {
  constructor(app, output) { super(app); this.output = output; }
  onOpen() {
    this.contentEl.createEl('h2', { text: '笔记自动发布结果' });
    const output = this.contentEl.createEl('pre', { text: this.output || '还没有执行记录。' });
    Object.assign(output.style, { maxHeight: '60vh', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '12px' });
  }
}
class PublisherSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    this.containerEl.empty();
    let selected = this.plugin.settings.sourceFolder;
    new Setting(this.containerEl).setName('公开笔记源目录').setDesc('选择当前 Obsidian 仓库内的文件夹。只发布 publish: true 的笔记和引用附件。重新绑定可解决目录身份冲突。')
      .addDropdown(dropdown => {
        dropdown.addOption('', '请选择源目录');
        const folders = this.app.vault.getAllLoadedFiles().filter(file => file.children && file.path && !file.path.split('/').some(part => part.startsWith('.') || part === 'Templates'));
        for (const folder of folders.sort((a, b) => a.path.localeCompare(b.path))) dropdown.addOption(folder.path, folder.path);
        dropdown.setValue(selected).onChange(value => { selected = value; });
      }).addButton(button => button.setButtonText('保存并检查').onClick(async () => {
        if (this.plugin.running) { new Notice('请等待当前检查结束后再切换源目录。'); return; }
        try {
          const resolved = await this.plugin.sourceRoots.bindSource(this.app.vault.adapter.getBasePath(), selected);
          await this.plugin.saveSource(resolved);
          this.plugin.sourceIssue = '';
          this.plugin.schedule();
          new Notice('源目录已保存，将检查完整公开快照。');
        } catch (error) { new Notice(error.message, 10000); }
      }));
    new Setting(this.containerEl).setName('同步频率').setDesc('停止编辑 15 秒后检查；每 60 秒补查一次。源目录移动或改名后自动跟踪。');
  }
}
module.exports = class HomepagePublisher extends Plugin {
  async onload() {
    this.sourceRoots = require(path.join(this.app.vault.adapter.getBasePath(), this.manifest.dir, 'source-root.cjs'));
    this.settings = { sourceFolder: 'James-Vault', debounceSeconds: 15, reconcileSeconds: 60, ...(await this.loadData()) };
    this.running = false;
    this.pending = false;
    this.failures = 0;
    this.stopped = false;
    this.timer = null;
    this.sourceIssue = '';
    this.lastOutput = '';
    this.status = this.addStatusBarItem();
    this.addSettingTab(new PublisherSettings(this.app, this));
    this.addCommand({ id: 'show-result', name: '查看自动发布结果', callback: () => new ResultModal(this.app, this.lastOutput).open() });
    this.registerEvent(this.app.metadataCache.on('changed', file => { if (this.affectsSource(file.path)) this.schedule(); }));
    for (const event of ['modify', 'create', 'delete']) this.registerEvent(this.app.vault.on(event, file => {
      if (this.affectsSource(file.path)) this.schedule();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (this.affectsSource(oldPath) || this.affectsSource(file.path)) this.schedule();
    }));
    this.app.workspace.onLayoutReady(() => {
      if (this.stopped) return;
      this.schedule();
      this.interval = setInterval(() => {
        // Periodic reconciliation must not reset an editing debounce or retry.
        if (!this.timer && !this.running && !this.stopped) this.publish();
      }, this.settings.reconcileSeconds * 1000);
    });
  }
  affectsSource(filePath) {
    if (!filePath) return false;
    const source = this.settings.sourceFolder.replace(/\/$/, '');
    if (filePath === source || source.startsWith(filePath + '/')) return true;
    if (!filePath.startsWith(source + '/')) return false;
    return !filePath.slice(source.length + 1).split('/').some(part => part.startsWith('.') || part === 'Templates');
  }
  async saveSource(resolved) {
    const configPath = path.join(this.settings.projectPath, 'notes.local.json');
    let config = {};
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (config.vaultPath !== resolved.vaultPath) {
      config.vaultPath = resolved.vaultPath;
      const temporary = configPath + '.publisher-tmp';
      writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n');
      renameSync(temporary, configPath);
    }
    if (this.settings.sourceId !== resolved.sourceId || this.settings.sourceFolder !== resolved.sourceFolder) {
      this.settings.sourceId = resolved.sourceId;
      this.settings.sourceFolder = resolved.sourceFolder;
      await this.saveData(this.settings);
    }
  }
  schedule() {
    if (this.stopped) return;
    if (this.running) { this.pending = true; return; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.publish(); }, this.settings.debounceSeconds * 1000);
  }
  finish(code, sourceUnavailable = false) {
    this.running = false;
    try {
      mkdirSync(path.join(this.settings.projectPath, '.local'), { recursive: true });
      writeFileSync(path.join(this.settings.projectPath, '.local/auto-publish.log'), this.lastOutput);
    } catch (error) { console.error('保存发布记录失败', error); }
    if (this.stopped) return;
    if (sourceUnavailable) {
      this.status.setText('笔记同步已暂停：请选择源目录');
      if (this.sourceIssue !== this.lastOutput) new Notice(this.lastOutput, 10000);
      this.sourceIssue = this.lastOutput;
    } else if (code !== 0) {
      this.failures += 1;
      this.status.setText('笔记同步失败，等待重试');
      if (this.failures === 1) new Notice('笔记自动发布失败，将自动重试。可在命令面板选择「个人网站发布：查看自动发布结果」。', 10000);
      this.timer = setTimeout(() => { this.timer = null; this.publish(); }, Math.min(300000, 30000 * 2 ** Math.min(this.failures - 1, 4)));
    } else {
      this.sourceIssue = '';
      this.failures = 0;
      const pushed = this.lastOutput.includes('推送成功');
      this.status.setText(pushed ? '笔记已推送，等待网站部署' : '公开笔记已检查');
      if (pushed) new Notice('公开笔记已推送，等待网站部署完成。', 6000);
    }
    if (this.pending) { this.pending = false; this.schedule(); }
  }
  async publish() {
    if (this.stopped || this.running) return;
    clearTimeout(this.timer); this.timer = null;
    this.running = true;
    this.pending = false;
    this.lastOutput = '';
    this.status.setText('公开笔记检查中…');
    const project = this.settings.projectPath;
    try {
      if (!project || !existsSync(path.join(project, 'scripts/publish-notes.mjs'))) throw new Error('自动发布未启动：找不到个人网站项目。');
      const vaultRoot = this.app.vault.adapter.getBasePath();
      const resolved = await this.sourceRoots.resolveSource({ vaultRoot, sourceFolder: this.settings.sourceFolder, sourceId: this.settings.sourceId, initialize: !this.settings.sourceId });
      await this.saveSource(resolved);
      if (this.stopped) { this.running = false; return; }
      const env = { ...process.env, OBSIDIAN_VAULT_PATH: resolved.vaultPath, HOMEPAGE_SOURCE_ID: resolved.sourceId, HOMEPAGE_VAULT_ROOT: vaultRoot,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}` };
      // Ignore candidate paths inherited from any parent process.
      delete env.HOMEPAGE_CONTENT_DIR; delete env.HOMEPAGE_DIST_DIR;
      const child = spawn('node', ['scripts/publish-notes.mjs'], { cwd: project, env });
      const append = chunk => {
        const text = chunk.toString(); this.lastOutput = (this.lastOutput + text).slice(-150000);
        if (!this.stopped && /3\/4|4\/4/.test(text)) this.status.setText('公开笔记发布中…');
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', error => append(error.message + '\n'));
      child.on('close', code => this.finish(code));
    } catch (error) {
      this.lastOutput = error.message;
      this.finish(1, error.code === 'SOURCE_UNAVAILABLE');
    }
  }
  onunload() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.interval);
  }
};
