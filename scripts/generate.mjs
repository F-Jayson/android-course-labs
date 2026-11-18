import fs from 'node:fs';

const OWNER = process.env.OWNER;
const TOPIC = process.env.TOPIC || 'android-lab';

const res = await fetch(
  `https://api.github.com/search/repositories?q=user:${OWNER}+topic:${TOPIC}&per_page=100`,
  {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
    },
  }
);
if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);

const { items } = await res.json();
items.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

const rows = items
  .map((r) => {
    const desc = (r.description || '—').replace(/\|/g, '\\|');
    const status = r.archived ? '📦 归档' : '✅';
    return `| [${r.name}](${r.html_url}) | ${desc} | ${r.language || '—'} | ${status} | ${r.updated_at.slice(0, 10)} |`;
  })
  .join('\n');

fs.writeFileSync(
  'README.md',
  `# Android 课程实验索引

共 **${items.length}** 个实验 · 最后更新 ${new Date().toISOString().slice(0, 10)}

| 实验仓库 | 说明 | 语言 | 状态 | 最近更新 |
| --- | --- | --- | --- | --- |
${rows}

> 🤖 本文件由 GitHub Actions 根据 \`android-lab\` 主题自动生成，请勿手动编辑。
> 新增实验只需给仓库打上 \`android-lab\` 标签，次日自动出现。
`
);