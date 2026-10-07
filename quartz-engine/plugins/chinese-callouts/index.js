import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

const parser = unified().use(remarkParse);
const aliases = new Map([
  ['笔记', 'note'], ['提示', 'tip'], ['警告', 'warning'], ['危险', 'danger'],
  ['成功', 'success'], ['失败', 'failure'], ['问题', 'question'], ['示例', 'example'],
  ['引用', 'quote'], ['摘要', 'abstract'], ['信息', 'info'],
]);

export default function ChineseCallouts() {
  return {
    name: 'ChineseCallouts',
    textTransform(_ctx, source) {
      // Only real blockquotes qualify; code blocks and inline examples stay literal.
      const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0] || '';
      const body = source.slice(frontmatter.length);
      const edits = [];
      visit(parser.parse(body), 'blockquote', node => {
        const first = node.children[0];
        if (first?.type !== 'paragraph') return;
        const start = first.position.start.offset;
        const rest = body.slice(start);
        const match = rest.match(/^\[!([\p{L}\p{N}_-]+)(\|[^\]\r\n]*)?\]([+-]?)/u);
        if (!match || !/\p{Script=Han}/u.test(match[1])) return;
        const [directive, type, metadata = '', collapse = ''] = match;
        const title = rest.slice(directive.length).split(/\r?\n/, 1)[0].trim();
        const englishType = aliases.get(type) || 'note';
        edits.push({
          start,
          end: start + directive.length,
          value: `[!${englishType}${metadata}]${collapse}${title ? '' : ' ' + type}`,
        });
      });
      let transformed = body;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        transformed = transformed.slice(0, edit.start) + edit.value + transformed.slice(edit.end);
      }
      return frontmatter + transformed;
    },
  };
}
