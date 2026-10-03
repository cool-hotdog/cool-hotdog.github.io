# 个人主页与 Obsidian 公开笔记：参考调研

本文件保留实施前的参考调研；其中“当前”“暂不修改”“视觉待定”等表述属于调研阶段。现已执行重建并完成视觉设计，最终架构、运行和发布方式见 [README](../README.md)。

核验日期：2026 年 10 月 3 日。依据作者网站、作者 GitHub 仓库及官方文档；不按 Star 数量排名。本文区分已核实事实、借鉴建议和本次已经确定的方向，暂不确定视觉设计。

## 当前确定的方向

根据本次讨论，采用「展示主页 + `/notes/` 下的 Quartz 笔记站」：主页负责介绍自己、展示项目和精选内容；Obsidian 作为写作来源，逐篇使用 `publish: true` 选择公开笔记。当前仅开展参考调研，不修改主页仓库或 Vault。

配色、字体、照片、动效和具体版式仍待讨论。以下参考主要用于决定信息组织与阅读方式；不是直接套用某个站点的外观。

## 参考站点

| 参考 | 在线网站 | 第一方 GitHub | 最适合借鉴 |
| --- | --- | --- | --- |
| Anthony Fu | [antfu.me](https://antfu.me/) | [antfu/antfu.me](https://github.com/antfu/antfu.me) | 简洁个人介绍、自然连接项目与文章 |
| al-folio | [官方演示](https://alshedivat.github.io/al-folio/) | [alshedivat/al-folio](https://github.com/alshedivat/al-folio) | 学术栏目、近况与成果的层次 |
| Brittany Chiang v4 | [v4.brittanychiang.com](https://v4.brittanychiang.com/) | [bchiang7/v4](https://github.com/bchiang7/v4) | 精选项目的完整呈现 |
| Jacky Zhao | [jzhao.xyz](https://jzhao.xyz/) | [jackyzha0/jackyzha0.github.io](https://github.com/jackyzha0/jackyzha0.github.io) | 精选写作与持续生长的笔记并存 |

### 1. Anthony Fu：让主页成为清晰的入口

**已核实。** 首页导航包含 Blog、Projects、Talks、Sponsors；正文用短介绍串联作者身份、代表项目、写作与兴趣。[首页](https://antfu.me/)；[项目页](https://antfu.me/projects)则按 Current Focus 及不同领域分组，每个项目有简短解释与链接。仓库明确区分代码的 MIT 许可和文字、图片的 CC BY-NC-SA 4.0 许可。[仓库说明](https://github.com/antfu/antfu.me)

**对你的借鉴建议。** 首页用简短介绍说明「北大经济学院本科生，关注经济学、数学与计算机的交叉问题」，随后给出项目与公开笔记入口。项目可以按经济与数据研究、数学与机器学习、编程工具分组，但应随真实内容增长，先保留少量有内容的分类。羽毛球与粤协经历可以作为简短的个人侧面；成绩、健康目标等私人背景不自动转成公开文案。

**适用边界。** 作者拥有大量长期维护项目，你的网站初期更适合少量精选，避免出现空分类；Sponsors、Talks 等栏目需要真实内容后再增加。

### 2. al-folio：借鉴学术成果组织

**已核实。** 官方演示首页包含个人简介、照片、news、latest posts、selected publications；论文项目提供摘要、DOI、HTML、PDF 等入口。[演示首页](https://alshedivat.github.io/al-folio/) 项目有独立索引页，[项目页](https://alshedivat.github.io/al-folio/projects/)还可进入具体项目。官方仓库描述其为 Jekyll 学术网站起始项目，并列出数学排版、图表、搜索、CV、BibTeX 论文等功能。[仓库功能说明](https://github.com/alshedivat/al-folio#features)

**对你的借鉴建议。** 保留「近期进展—精选项目—近期笔记」的层次。未来有课程研究、实证复现、研究助理经历或论文时，能够自然扩充为 Research 与 CV。数学和计量内容的阅读标准可参考其[公式示例](https://alshedivat.github.io/al-folio/blog/2015/math/)：公式与正文应共同构成论证，而非作为装饰。

**适用边界。** 现阶段建议使用「项目与研究练习」，没有正式论文时不设置空的 Publications。采用其信息组织不意味着把现有架构改成 Jekyll。

### 3. Brittany Chiang v4：把项目讲完整

**已核实。** 本次对应的是第四版网站，在线地址为 [v4.brittanychiang.com](https://v4.brittanychiang.com/)，不是当前主域名可能呈现的其他版本。其首页代码依次组合 Hero、About、Jobs、Featured、Projects、Contact。[首页源码](https://github.com/bchiang7/v4/blob/main/src/pages/index.js) 精选项目组件包含图片、说明、技术标签、GitHub 与外部链接；其他项目区域有归档入口。[精选项目源码](https://github.com/bchiang7/v4/blob/main/src/components/sections/featured.js)、[其他项目源码](https://github.com/bchiang7/v4/blob/main/src/components/sections/projects.js)

**对你的借鉴建议。** 每个精选项目应回答：研究了什么问题、用了什么方法、得到什么结果、读者在哪里查看代码或报告。对经济与 Quant 方向，可展示实证问题、数据来源、模型、验证方法及局限；图像优先采用有解释价值的图表或应用截图。项目可链接到 `/notes/` 内的推导与复盘，让主页提供概览、笔记提供深度。

**适用边界。** 它适合展示作品，但首页栏目本身不提供知识库组织方案。其 README 说明它不是通用 starter，并要求复用代码时保留作者署名；本次建议借鉴项目叙述层次。[仓库说明](https://github.com/bchiang7/v4#readme)

### 4. Jacky Zhao：与本次笔记框架最直接相关

**已核实。** 首页区分 Selected Writing 与 Recent Notes，同时提供作者介绍、作品入口和书架入口。[首页](https://jzhao.xyz/) 单篇笔记展示日期、阅读时长、成熟度标签，并通过文中及文末相关链接连接其他概念。[OPFS 笔记示例](https://jzhao.xyz/thoughts/OPFS)

已经找到真实网站仓库：[jackyzha0/jackyzha0.github.io](https://github.com/jackyzha0/jackyzha0.github.io)。仓库 About 指向 `jzhao.xyz`，配置的 `pageTitle` 和 `baseUrl` 也对应该域名；它不是通用 Quartz 引擎仓库。[站点配置](https://github.com/jackyzha0/jackyzha0.github.io/blob/v4/quartz.config.ts) 在线页脚显示 Quartz v4.5.1。

**对你的借鉴建议。** 首页分别展示「精选笔记」与「最近更新」：前者帮助初访者快速认识你的兴趣与思考质量，后者体现持续学习。笔记站提供数学、经济与金融、计算机与机器学习等主题入口；课程笔记、概念解释、项目复盘可互相链接。成熟度标签是可选的阅读提示，不应改变 `publish: true` 的发布开关。

**适用边界。** Jacky 当前配置采用 `RemoveDrafts()`，并不能据此认为它采用逐篇 `publish: true`。你的公开选择规则需要单独实现与验证，不能原样照搬他的过滤配置。[站点配置](https://github.com/jackyzha0/jackyzha0.github.io/blob/v4/quartz.config.ts)

## 推荐组合与内容关系

建议以 **Anthony Fu 的首页组织 + Jacky Zhao 的笔记入口 + Brittany v4 的项目展示** 为主；al-folio 用于未来学术内容扩展。这个组合是针对你的需求的设计判断，不是各站作者的推荐。

建议的内容关系如下，栏目名称和数量可在盘点实际内容后收敛：

```text
个人主页 /
├── 简介与联系方式
├── 精选项目 → 项目说明、代码、报告
├── 精选笔记 → /notes/ 中的代表文章
└── 最近更新 → /notes/ 中最近更新的公开笔记

公开笔记 /notes/
├── 主题与课程索引
├── 概念、推导和学习笔记
└── 项目复盘 ↔ 项目说明页
```

建议先形成一条完整访客路径：「首页认识你 → 查看一个真实项目 → 阅读相关方法笔记 → 打开代码或报告」。能走通这条路径，比初期填满所有栏目更有价值。项目尚未完成时，应准确标识进展，避免将学习计划写成已经具备的成果。

## 实施前需要保留的边界

- **发布规则已经确定：** 逐篇 `publish: true`。建议发布过程仅导出获准笔记及其所需附件，再进入公开仓库与站点构建；未公开笔记的内容、标题和附件不因链接或搜索索引被带出。这里是实施建议，当前没有操作 Vault。
- **版本需要固定：** 本次访问的 [Quartz 官方首页](https://quartz.jzhao.xyz/)已显示 Quartz 5，而 Jacky 的个人站仍显示 v4.5.1。实施时应固定选用版本并核对对应文档，不混用 v4 配置与 v5 插件流程。
- **视觉仍未确定：** 本报告不锁定浅色或深色、学术或作品集视觉、字体、色板、头像及动效。
- **验收重点建议：** 首页能直达项目和笔记；中文、公式、代码及图片在手机与桌面可读；双链和附件正确；公开索引只包含选择发布的内容；`/notes/` 子路径和返回主页链接正常。

本轮产物为参考研究文档。主页仓库、Obsidian Vault 与部署配置均未在本研究任务中修改。
