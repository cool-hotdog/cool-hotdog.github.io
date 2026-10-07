# James Liang · Cool Hotdog

个人主页与 Obsidian 公开笔记库：[中文首页](https://cool-hotdog.github.io/) · [English](https://cool-hotdog.github.io/en/) · [公开笔记](https://cool-hotdog.github.io/notes/)

## 网站结构

| 路径 | 内容 |
| --- | --- |
| `/`、`/en/` | 双语主页，学习方向、精选笔记和最近更新 |
| `/projects/`、`/en/projects/` | 暂不展示项目；旧地址跳转到对应语言的首页 |
| `/about/`、`/en/about/` | 自我介绍与学习方向 |
| `/notes/` | 单一 Quartz 知识库，笔记保留原语言 |

展示页由 `site/render.mjs` 生成，文案集中在 `site/content.mjs`。笔记使用锁定版本的 Quartz 5；来源、提交和许可证见 `quartz-engine/UPSTREAM.md`。`dist/` 是构建输出，不提交。

视觉设计采用暖白纸面、森林绿与少量赤陶色，搭配中文宋体/英文衬线标题、原生系统正文和代码字体。首页的节点插图和标识均为可维护的 SVG。支持手机、键盘操作、减少动画偏好和明暗主题。

## 本地运行

安装 Node.js 24 或更新版本，然后：

```bash
npm ci
npm run setup
npm run preview
```

浏览器打开 `http://localhost:4321`。只修改展示页无需访问 Obsidian；仓库中的 `content/` 已包含公开笔记快照。

## 从 Obsidian 发布

网站通过本地插件 `quartz-engine/plugins/chinese-callouts/` 支持中文提示块类型：`> [!工具和环境]` 显示为以“工具和环境”为标题的 note 提示块；`[!警告]`、`[!提示]` 等常见名称使用对应样式。已有标题、折叠符号和元数据保留，英文类型、代码示例和高亮语法保持现有行为。插件仅在构建时转换，不改写 Obsidian 笔记。

### 自动发布（Mac）

本地 Obsidian 插件「个人网站发布」把 `James-Vault` 中的公开笔记及引用附件同步为完整网站快照。源目录内任意内容、文件或文件夹的增删、移动、重命名都会触发检查；停止操作约 15 秒后扫描一次，启动时检查一次，运行期间每 60 秒补查遗漏事件与 iCloud 更新。只有公开快照发生变化才构建和推送；私人笔记的普通编辑和空目录调整不创建网站提交。

笔记首页与目录导航根据公开笔记的实际相对路径生成，不使用固定课程分类，不展示只有私人笔记的目录。移动或重命名后旧页面撤下，新网址对应新路径；搜索、图谱、反向链接、站点地图、精选与最近更新均从新快照重建。插件不改写笔记正文；整理目录时请让 Obsidian 更新内部链接，无法解析的引用继续按下方规则处理。

插件首次运行会在源目录创建不公开的 `.homepage-publisher-source.json` 身份标记，并把标识保存到插件设置。源目录及父目录在当前 Obsidian 仓库内移动或改名后自动跟踪，关闭应用期间的移动也能在下次启动时重新定位。源目录缺失、移出仓库或存在多个相同身份副本时暂停发布并保留网站；在「设置 → 个人网站发布 → 公开笔记源目录」选择目录并点击「保存并检查」可重新绑定。身份标记和其他隐藏文件不导出。

发布先在本机 `.local/` 创建候选快照，验证构建、公开范围和站内链接，确认源文件在处理期间没有变化后才替换正式公开导出、提交和推送。失败保留上一份有效导出与线上网站，网络失败自动退避重试；发布期间的新修改排队检查，不并发运行。无变化时不重复构建、提交或推送，之前未成功推送的提交仍会重试。可通过命令面板的「个人网站发布：查看自动发布结果」查看输出，日志保存在 `.local/auto-publish.log`。状态中的「已推送，等待网站部署」仅表示上传成功，网站在 GitHub Pages 部署完成后更新。

插件源码在 `integrations/obsidian-homepage-publisher/`。将 `main.js`、`source-root.cjs` 和 `manifest.json` 安装到当前打开笔记库的 `.obsidian/plugins/homepage-publisher/` 后启用。`data.json` 的 `projectPath` 为网站项目绝对路径，`sourceFolder` 为源目录相对路径，`sourceId` 为自动生成的身份，`debounceSeconds` 默认为 15，`reconcileSeconds` 默认为 60。插件将当前源路径显式传入发布程序，并同步更新本机 `notes.local.json`。Mac 上的 Obsidian 需要保持运行，上传和部署需要网络。

底层发布程序要求使用 `main` 分支、暂存区为空、网站代码没有未提交修改。只提交 `content/` 中经过验证的公开快照，其他未跟踪文件不会一起上传。可运行 `npm run notes:publish -- --check`，在临时目录完成验证后更新本机公开导出，不提交或推送。构建和验证程序支持 `HOMEPAGE_CONTENT_DIR` 与 `HOMEPAGE_DIST_DIR` 环境变量，用于检查候选快照，默认仍使用 `content/` 和 `dist/`。

### 手动同步

在本机新建 **不提交 Git 的** `notes.local.json`，填写自己的 Vault 绝对路径：

```json
{ "vaultPath": "/absolute/path/to/your/Obsidian-Vault" }
```

也可以使用环境变量 `OBSIDIAN_VAULT_PATH`，其优先级更高。无需把整座 Vault 放入这个仓库。

在需要公开的笔记顶部加入 YAML：

```yaml
---
title: CPP刷题经验
publish: true
featured: true
tags: [cpp]
description: 这篇笔记的简短介绍。
---
```

只有 **布尔值** `publish: true` 会被导出。`publish: "true"` 不会发布；`draft: true` 优先阻止发布。`featured`、`description` 为可选项。可设置 `created`、`modified` 或 `updated`，否则使用本地文件修改时间。

```bash
npm run notes:sync
npm test
npm run build
npm run verify
```

检查 `git diff -- content`，确认公开内容后提交并推送。同步仅替换 `content/` 的公开快照；不批量更改原 Vault。GitHub Actions 使用这份快照，无法读取本机的私人笔记。

- `[[笔记]]`、`[[笔记#标题|显示文字]]` 和公开笔记嵌入保留关联；重名时请用 Vault 相对路径。
- 指向未公开笔记的普通链接转为显示文字，并在本地提示。未公开笔记嵌入会停止同步。
- 只复制公开笔记实际引用的图片、PDF 等附件；`.obsidian`、隐藏目录、`Templates` 和符号链接不导出。
- Obsidian 的 `%% 注释 %%` 不公开；代码块中的链接样例不作为实际链接处理。
- 缺失附件、重名链接、网址冲突或 Vault 读取失败时停止同步，保留上一次有效快照。
- 复杂 HTML 嵌入、Canvas、Bases 和执行脚本不支持发布；公式、代码、Markdown 图片/PDF、双链已通过集成测试。

撤下笔记：将 `publish` 改为 `false` 或删除该字段，重新同步、检查、提交并推送。未被其他公开笔记引用的附件会随之撤下。**公开仓库的 Git 历史仍保留曾发布的内容**，因此发布前应确认笔记和引用附件适合公开。

首页精选和最近更新从公开清单自动生成；搜索、反向链接和图谱仅包含构建后的公开内容。

## 部署与验证

GitHub Pages 使用 `.github/workflows/deploy.yml`：拉取请求运行测试、构建与站内链接验证；合并至 `main` 后部署 `dist/`。Pages 设置中的 Source 应为 **GitHub Actions**。旧 `/about-cn.html` 自动跳转到中文关于页。

`npm test` 检查公开筛选、撤下、失败保护、链接/附件解析，并以独立临时笔记验证 Quartz 公式、代码、标题链接、图片和 PDF。`npm run verify` 检查所有生成页面的站内链接/资源及公开搜索清单。

若需要回滚，恢复 Git 中之前的提交并推送即可触发重新部署。更新 Quartz 时同时更新 `UPSTREAM.md` 和锁文件，再运行全部验证；不要混用 Quartz 4 的配置方式。

## 设计参考

参考页面的组织方式与阅读体验，重新编写本网站的视觉和代码：

- [Anthony Fu](https://github.com/antfu/antfu.me)：克制的个人入口与项目组织。
- [Jacky Zhao](https://github.com/jackyzha0/jackyzha0.github.io)：主页与持续更新的知识库连接。
- [Brittany Chiang](https://github.com/bchiang7/v4)：清楚呈现项目内容与个人贡献。
- [al-folio](https://github.com/alshedivat/al-folio)：为未来学术经历、研究成果留出扩展空间。

详细参考调研见 [docs/design-references.md](docs/design-references.md)。
