const { Plugin, Modal, Notice } = require('obsidian');
const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

class PublishModal extends Modal {
  constructor(app, projectPath, checkOnly) {
    super(app);
    this.projectPath = projectPath;
    this.checkOnly = checkOnly;
  }
  onOpen() {
    const script = path.join(this.projectPath, 'scripts/publish-notes.mjs');
    this.contentEl.createEl('h2', { text: this.checkOnly ? '检查公开笔记' : '发布公开笔记' });
    const status = this.contentEl.createEl('p', { text: '正在处理，请稍候…关闭窗口不会中止任务。' });
    const output = this.contentEl.createEl('pre');
    Object.assign(output.style, { maxHeight: '55vh', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '12px' });
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}` };
    const child = spawn('node', [script, ...(this.checkOnly ? ['--check'] : [])], { cwd: this.projectPath, env });
    const append = chunk => {
      output.textContent = (output.textContent + chunk.toString()).slice(-150000);
      output.scrollTop = output.scrollHeight;
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    let failed = false;
    child.on('error', error => { failed = true; append(error.message); status.textContent = '启动失败，请查看下方原因。'; });
    child.on('close', code => {
      if (failed) return;
      status.textContent = code === 0 ? (this.checkOnly ? '检查完成，没有提交或推送。' : '处理完成，请查看下方结果及部署状态。') : '发布停止，请查看下方原因。';
      new Notice(status.textContent, 6000);
    });
  }
}

module.exports = class HomepagePublisher extends Plugin {
  async onload() {
    this.settings = (await this.loadData()) || {};
    const execute = checkOnly => {
      const projectPath = this.settings.projectPath;
      if (!projectPath || !existsSync(path.join(projectPath, 'scripts/publish-notes.mjs'))) {
        new Notice('找不到个人网站发布程序，请检查插件配置。');
        return;
      }
      new PublishModal(this.app, projectPath, checkOnly).open();
    };
    this.addCommand({ id: 'publish-notes', name: '发布公开笔记', callback: () => execute(false) });
    this.addCommand({ id: 'check-notes', name: '检查公开笔记（不发布）', callback: () => execute(true) });
    this.registerObsidianProtocolHandler('homepage-publisher', params => {
      if (params.action === 'publish') execute(false);
      else if (params.action === 'check') execute(true);
    });
  }
};
