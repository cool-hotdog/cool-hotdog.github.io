import test from 'node:test';
import assert from 'node:assert/strict';
import ChineseCallouts from '../quartz-engine/plugins/chinese-callouts/index.js';

const transform = source => ChineseCallouts().textTransform({}, source);
test('Chinese callouts retain titles, folding, metadata and nesting', () => {
  const source = '> [!工具和环境]\n> **工具**\n\n >[!什么是编程]\n> 正文\n\n> [!警告|custom]- 标题\n> 风险\n\n> > [!CS学习]+\n> > 内容\n';
  const expected = '> [!note] 工具和环境\n> **工具**\n\n >[!note] 什么是编程\n> 正文\n\n> [!warning|custom]- 标题\n> 风险\n\n> > [!note]+ CS学习\n> > 内容\n';
  assert.equal(transform(source), expected);
  assert.equal(transform(expected), expected);
});
test('English callouts, frontmatter, code and highlight syntax are untouched', () => {
  const source = '---\nquote: |\n  > [!中文配置]\n---\n> [!note] 中文标题\n> 正文\n\n```markdown\n> [!中文代码]\n```\n\n    > [!缩进代码]\n\n`>[!行内代码]`\n\n==**高亮加粗**==\n';
  assert.equal(transform(source), source);
});
test('Chinese callouts preserve Windows line endings and Markdown titles', () => {
  assert.equal(transform('> [!警告]- **请留意**\r\n> 正文\r\n'), '> [!warning]- **请留意**\r\n> 正文\r\n');
});
