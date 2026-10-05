#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "${0:A:h}" || exit 1
printf '\n开始发布 Obsidian 公开笔记…\n\n'
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  node scripts/publish-notes.mjs
  publish_status=$?
else
  printf '未找到 Node.js 和 npm，请先安装 Node.js 24 或更新版本。\n'
  publish_status=1
fi
printf '\n按回车关闭此窗口。'
read -r
exit "$publish_status"
