import fs from 'node:fs';

const OWNER  = process.env.OWNER || process.env.GITHUB_REPOSITORY_OWNER;
const TOPIC  = process.env.TOPIC || 'android-lab';
const TOKEN  = process.env.GH_TOKEN;

const headers = {
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${path} → ${await res.text()}`);
  return res.json();
}

// 关键：用 /users/{owner}/repos，不用 /search/repositories
// 有些账号在 GitHub 搜索索引里不可搜，会稳定返回 422
async function listAllRepos() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(`/users/${encodeURIComponent(OWNER)}/repos?per_page=100&page=${page}&sort=updated`);
    if (!Array.isArray(batch)) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function row(e) {
  const note = (e.note || '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return `| [${e.title}](${e.url}) | ${note} | ${e.lang || '—'} | ${e.updated || '—'} |`;
}

let entries = [];
let source = '';

if (fs.existsSync('labs.json')) {
  // 模式 A：显式列表（推荐，命名不统一时最省事）
  const list = JSON.parse(fs.readFileSync('labs.json', 'utf8'));
  for (const item of list) {
    const full = `${OWNER}/${item.repo}`;
    try {
      const r = await gh(`/repos/${full}`);
      entries.push({
        title: item.title || r.name,
        url: r.html_url,
        note: item.note || r.description || '',
        lang: r.language || '',
        updated: (r.pushed_at || r.updated_at || '').slice(0, 10),
      });
    } catch (e) {
      console.warn(`跳过 ${full}: ${e.message}`);
      entries.push({
        title: item.title || item.repo,
        url: `https://github.com/${full}`,
        note: '⚠️ 读取失败（检查仓库名是否正确）',
        lang: '', updated: '',
      });
    }
  }
  source = `labs.json，${entries.length} 项`;
} else {
  // 模式 B：按 topic 过滤
  const repos = await listAllRepos();
  entries = repos
    .filter((r) => Array.isArray(r.topics) && r.topics.includes(TOPIC))
    .map((r) => ({
      title: r.name,
      url: r.html_url,
      note: r.description || '',
      lang: r.language || '',
      updated: (r.pushed_at || r.updated_at || '').slice(0, 10),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }));
  source = `topic: ${TOPIC}，${entries.length} 个`;
}

const body = entries.length
  ? entries.map(row).join('\n')
  : '| — | 还没有匹配的仓库，见文末说明 | — | — |';

const md = `# Android 课程实验索引

共 **${entries.length}** 个实验 · 最后更新 ${new Date().toISOString().slice(0, 10)}

| 实验 | 说明 | 语言 | 最近提交 |
| --- | --- | --- | --- |
${body}

---

> 本文件由 GitHub Actions 自动生成，请勿手动编辑。
> 数据来源：${source}
`;

fs.writeFileSync('README.md', md);
console.log(`✅ 生成完成：${entries.length} 个仓库（${source}）`);