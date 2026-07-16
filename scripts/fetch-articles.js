// Tech Daily - Daily Article Fetcher
// Runs via GitHub Actions every morning at 8:00 AM
// Fetches from GitHub API and Hacker News API, generates articles.json

const fs = require('fs');
const path = require('path');

const CATEGORY_KEYWORDS = {
  ai: ['ai', 'machine', 'llm', 'gpt', 'neural', 'deep', 'model', 'openai', 'claude', 'gemini', 'agent', 'embedding', 'transformer', 'diffusion', 'llama', 'mistral', 'anthropic', 'chatgpt', 'copilot'],
  frontend: ['react', 'vue', 'angular', 'svelte', 'css', 'html', 'ui', 'frontend', 'web', 'javascript', 'typescript', 'browser', 'dom', 'webpack', 'vite', 'tailwind', 'nextjs', 'nuxt', 'node.js'],
  backend: ['server', 'api', 'database', 'sql', 'rust', 'go', 'golang', 'python', 'java', 'node', 'backend', 'grpc', 'redis', 'postgres', 'mysql', 'mongodb', 'django', 'flask', 'spring', 'graphql'],
  cloud: ['cloud', 'kubernetes', 'k8s', 'docker', 'aws', 'azure', 'gcp', 'infra', 'terraform', 'serverless', 'lambda', 'ecs', 'container', 'nginx', 'kafka', 'cncf'],
  devops: ['ci/cd', 'pipeline', 'deploy', 'git', 'github', 'action', 'jenkins', 'argo', 'helm', 'prometheus', 'grafana', 'observability', 'monitoring', 'logging', 'devops', 'ansible'],
  security: ['security', 'vulnerability', 'exploit', 'crypto', 'hack', 'cve', 'penetration', 'xss', 'csrf', 'oauth', 'encryption', 'firewall', 'malware', 'ransom', 'zero-day']
};

const CATEGORY_LABELS = {
  ai: '人工智能', frontend: '前端开发', backend: '后端架构',
  cloud: '云计算', devops: 'DevOps', security: '网络安全'
};

function classifyArticle(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0);
  }
  const bestCat = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return bestCat && bestCat[1] > 0 ? bestCat[0] : 'devops';
}

function generateChineseDesc(category, title, originalDesc) {
  const catName = CATEGORY_LABELS[category] || '技术';
  if (!originalDesc || originalDesc === 'No description available') {
    return `【${catName}】${title}`;
  }
  const shortDesc = originalDesc.length > 120 ? originalDesc.substring(0, 120) + '...' : originalDesc;
  return `【${catName}】${shortDesc}`;
}

async function fetchGitHub() {
  const languages = [
    { lang: 'typescript', name: 'TypeScript' },
    { lang: 'python', name: 'Python' },
    { lang: 'rust', name: 'Rust' },
    { lang: 'go', name: 'Go' },
    { lang: 'javascript', name: 'JavaScript' },
    { lang: 'vue', name: 'Vue' }
  ];

  const articles = [];
  for (const item of languages) {
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=stars:>500+language:${item.lang}&sort=updated&order=desc&per_page=2`,
        { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Tech-Daily-Action' } }
      );
      if (!response.ok) { console.log(`GitHub API ${item.lang}: ${response.status}`); continue; }
      const data = await response.json();
      for (const repo of data.items || []) {
        const cat = classifyArticle(repo.name, repo.description || '');
        articles.push({
          id: `gh-${repo.id}`, title: repo.name,
          desc: generateChineseDesc(cat, repo.name, repo.description),
          category: cat, categoryLabel: CATEGORY_LABELS[cat],
          source: `GitHub · ${item.name}`,
          date: repo.updated_at ? repo.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
          url: repo.html_url, stars: repo.stargazers_count || 0
        });
      }
      console.log(`GitHub ${item.lang}: ${data.items?.length || 0} repos fetched`);
    } catch (e) { console.error(`GitHub API error (${item.lang}):`, e.message); }
  }
  return articles;
}

async function fetchHackerNews() {
  try {
    const response = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10');
    if (!response.ok) { console.log('HN API:', response.status); return []; }
    const data = await response.json();
    console.log(`HN: ${data.hits?.length || 0} articles fetched`);
    return (data.hits || []).map(hit => {
      const cat = classifyArticle(hit.title, '');
      return {
        id: `hn-${hit.objectID}`, title: hit.title,
        desc: `【${CATEGORY_LABELS[cat]}】Hacker News 热门讨论：${hit.title}`,
        category: cat, categoryLabel: CATEGORY_LABELS[cat],
        source: 'Hacker News',
        date: hit.created_at ? hit.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        points: hit.points || 0, comments: hit.num_comments || 0
      };
    });
  } catch (e) { console.error('HN API error:', e.message); return []; }
}

function getFallbackArticles() {
  const today = new Date().toISOString().split('T')[0];
  return [
    { id: 'fb-1', title: 'AI Agent 进入 L3 自治时代', desc: '【人工智能】行业彻底告别问答式被动大模型，进入主动规划、自主执行、长期记忆、多智能体协同的 L3 自治时代。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006', featured: true },
    { id: 'fb-2', title: '统一原生多模态大模型发布', desc: '【人工智能】GPT-5.2 / Gemini 3 / Claude 3.5 统一基座模型发布，全部模态共享一套底层编码器。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006', featured: true },
    { id: 'fb-3', title: '华为 Atlas 950 超节点发布', desc: '【云计算】华为 Atlas 950 超节点单柜 64 卡，最大扩展 8192 张 NPU，总算力大幅领先海外方案。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006', featured: true },
    { id: 'fb-4', title: '具身智能量产元年开启', desc: '【人工智能】2026 年为人形机器人量产元年，国内全年产量有望突破 10 万台。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-5', title: '端侧原生离线 AI 成为消费级卖点', desc: '【人工智能】2026 消费电子核心卖点是不上云、本地运行大模型。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-6', title: 'AI Coding 全栈开发智能体', desc: '【DevOps】GitHub Copilot 新增图像/PDF 识图写代码，程序员效率提升 50% 以上。', category: 'devops', categoryLabel: 'DevOps', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-7', title: '绿色低碳 AI 能碳智算中枢', desc: '【云计算】低功耗近存芯片、液冷集群降低数据中心能耗，实现可持续 AI 发展。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-8', title: 'WAIC 2026 世界人工智能大会', desc: '【人工智能】2026 世界人工智能大会将于 7 月在上海举办，超 300 款产品全球首发。', category: 'ai', categoryLabel: '人工智能', source: '头条新闻', date: today, url: 'https://m.toutiao.com/group/7659698839352115753/' },
    { id: 'fb-9', title: '云计算算力订单加码景气升温', desc: '【云计算】云计算成为大模型训练、AI Agent 运行的核心基础设施，算力订单加码。', category: 'cloud', categoryLabel: '云计算', source: '头条新闻', date: today, url: 'https://m.toutiao.com/group/7660126621034086921/' },
    { id: 'fb-10', title: '无标注自监督数据生成突破', desc: '【人工智能】AI 自动生成仿真训练数据，无需人工标注，解决医疗影像稀缺痛点。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-11', title: 'Token 工厂革新算力商业模式', desc: '【云计算】算力厂商告别按算力时长收费，改为按 AI 产出 Token 计价。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-12', title: 'AI 芯片三大路线并行发展', desc: '【云计算】近存计算 3D 堆叠芯片成为颠覆性架构，英伟达、国产 NPU、自研芯片三足鼎立。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: today, url: 'https://blog.51cto.com/u_10819805/14749006' }
  ];
}

async function main() {
  console.log('🚀 Tech Daily - Fetching articles...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  const [githubData, hnData] = await Promise.allSettled([
    fetchGitHub(), fetchHackerNews()
  ]);

  let articles = [];
  articles.push(...getFallbackArticles());

  if (githubData.status === 'fulfilled') {
    articles.push(...githubData.value);
    console.log(`✅ GitHub: ${githubData.value.length} articles`);
  } else {
    console.log('⚠️ GitHub API failed, using fallback');
  }

  if (hnData.status === 'fulfilled') {
    articles.push(...hnData.value);
    console.log(`✅ HN: ${hnData.value.length} articles`);
  } else {
    console.log('⚠️ HN API failed, using fallback');
  }

  // Limit to 30 articles
  articles = articles.slice(0, 30);

  const output = {
    articles,
    updatedAt: new Date().toISOString(),
    totalCount: articles.length
  };

  const outputPath = path.join(__dirname, '..', 'articles.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ articles.json generated with ${articles.length} articles`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});