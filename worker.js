// Cloudflare Worker - Tech Daily API
// Fetches tech news from GitHub and Hacker News, caches for 1 hour

const CATEGORY_KEYWORDS = {
  ai: ['ai', 'machine', 'llm', 'gpt', 'neural', 'deep', 'model', 'openai', 'claude', 'gemini', 'agent', 'embedding', 'transformer', 'diffusion', 'llama', 'mistral', 'anthropic'],
  frontend: ['react', 'vue', 'angular', 'svelte', 'css', 'html', 'ui', 'frontend', 'web', 'javascript', 'typescript', 'browser', 'dom', 'webpack', 'vite', 'tailwind', 'nextjs', 'nuxt'],
  backend: ['server', 'api', 'database', 'sql', 'rust', 'go', 'golang', 'python', 'java', 'node', 'backend', 'grpc', 'redis', 'postgres', 'mysql', 'mongodb', 'django', 'flask', 'spring'],
  cloud: ['cloud', 'kubernetes', 'k8s', 'docker', 'aws', 'azure', 'gcp', 'infra', 'terraform', 'serverless', 'lambda', 'ecs', 'container', 'nginx', 'kafka'],
  devops: ['ci/cd', 'pipeline', 'deploy', 'git', 'github', 'action', 'jenkins', 'argo', 'helm', 'prometheus', 'grafana', 'observability', 'monitoring', 'logging'],
  security: ['security', 'vulnerability', 'exploit', 'crypto', 'hack', 'cve', 'penetration', 'xss', 'csrf', 'oauth', 'encryption', 'firewall', 'malware']
};

const CATEGORY_LABELS = {
  ai: '人工智能',
  frontend: '前端开发',
  backend: '后端架构',
  cloud: '云计算',
  devops: 'DevOps',
  security: '网络安全'
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
    { lang: 'typescript', zh: 'TypeScript' },
    { lang: 'python', zh: 'Python' },
    { lang: 'rust', zh: 'Rust' },
    { lang: 'go', zh: 'Go' },
    { lang: 'javascript', zh: 'JavaScript' },
    { lang: 'vue', zh: 'Vue' }
  ];

  const articles = [];
  for (const item of languages) {
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=stars:>500+language:${item.lang}&sort=updated&order=desc&per_page=2`,
        { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Tech-Daily-Worker' } }
      );
      if (!response.ok) continue;
      const data = await response.json();
      for (const repo of data.items || []) {
        const cat = classifyArticle(repo.name, repo.description || '');
        articles.push({
          id: `gh-${repo.id}`,
          title: repo.name,
          desc: generateChineseDesc(cat, repo.name, repo.description),
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat],
          source: `GitHub · ${item.zh}`,
          date: repo.updated_at ? repo.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
          url: repo.html_url,
          stars: repo.stargazers_count || 0
        });
      }
    } catch (e) {
      console.error('GitHub API error:', e);
    }
  }
  return articles;
}

async function fetchHackerNews() {
  try {
    const response = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10');
    if (!response.ok) return [];
    const data = await response.json();
    return (data.hits || []).map(hit => {
      const cat = classifyArticle(hit.title, '');
      return {
        id: `hn-${hit.objectID}`,
        title: hit.title,
        desc: `【${CATEGORY_LABELS[cat]}】Hacker News 热门讨论：${hit.title}`,
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat],
        source: 'Hacker News',
        date: hit.created_at ? hit.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        points: hit.points || 0,
        comments: hit.num_comments || 0
      };
    });
  } catch (e) {
    console.error('HN API error:', e);
    return [];
  }
}

function getFallbackArticles() {
  return [
    { id: 'fb-1', title: 'AI Agent 进入 L3 自治时代', desc: '【人工智能】行业彻底告别问答式被动大模型，进入主动规划、自主执行、长期记忆、多智能体协同的 L3 自治时代。OpenAI GPT Agents、微软 AutoDev 等头部产品已落地，预计 2030 年替代 30% 移动端 App 交互。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006', featured: true },
    { id: 'fb-2', title: '统一原生多模态大模型发布', desc: '【人工智能】GPT-5.2 / Gemini 3 / Claude 3.5 统一基座模型发布，全部模态共享一套底层编码器。阿里 Qwen3.7-Max 全球盲测国产第一，火山引擎 Seedance2.5 支持原生 30 秒连贯高清视频生成。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006', featured: true },
    { id: 'fb-3', title: '华为 Atlas 950 超节点发布', desc: '【云计算】华为 Atlas 950 超节点单柜 64 卡，最大扩展 8192 张 NPU，总算力、互联带宽、内存容量大幅领先海外方案，专为万亿参数大模型训练设计。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006', featured: true },
    { id: 'fb-4', title: '具身智能量产元年开启', desc: '【人工智能】2026 年为人形机器人量产元年，国内全年产量有望突破 10 万台。LingBot-VLA2.0 一套模型兼容 20 款机器人硬件，单 4090 即可低延迟实时控制。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-5', title: '端侧原生离线 AI 成为消费级卖点', desc: '【人工智能】2026 消费电子核心卖点是不上云、本地运行大模型。苹果折叠屏 iPhone 内置端侧多模态基座，车载端侧大模型交互延迟低于 500ms，数据不离开设备保护隐私。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-6', title: 'AI Coding 全栈开发智能体', desc: '【DevOps】GitHub Copilot 新增图像 / PDF 识图写代码；豆包、Qwen 代码智能体可独立完成完整工程、自测迭代、部署上线，程序员效率提升 50% 以上。', category: 'devops', categoryLabel: 'DevOps', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-7', title: '绿色低碳 AI 能碳智算中枢', desc: '【云计算】低功耗近存芯片、液冷集群降低数据中心能耗，解决 AI 算力高耗电痛点。能碳智算中枢一体化管理算力、电力、碳排放，实现可持续 AI 发展。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-8', title: 'WAIC 2026 世界人工智能大会', desc: '【人工智能】2026 世界人工智能大会将于 7 月 17 日至 20 日在上海举办，超 300 款产品将全球首发，包括近存 3D 芯片、Agent 操作系统、人形机器人量产方案。', category: 'ai', categoryLabel: '人工智能', source: '头条新闻', date: '2026-07-07', url: 'https://m.toutiao.com/group/7659698839352115753/' },
    { id: 'fb-9', title: '云计算算力订单加码景气升温', desc: '【云计算】云计算成为大模型训练、智能推理、AI Agent 运行的核心基础设施。算力订单加码、云厂商涨价，产业景气度加速验证。', category: 'cloud', categoryLabel: '云计算', source: '头条新闻', date: '2026-07-09', url: 'https://m.toutiao.com/group/7660126621034086921/' },
    { id: 'fb-10', title: '无标注自监督数据生成突破', desc: '【人工智能】AI 自动生成仿真训练数据，无需人工标注。解决医疗影像、工业缺陷样本稀缺痛点，国内模型登顶 Nature 子刊临床验证。', category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-11', title: 'Token 工厂革新算力商业模式', desc: '【云计算】算力厂商告别按算力时长收费，改为按 AI 产出 Token 计价，算力厂商与模型企业收益分成，适配 Agent、多模态海量调用需求。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' },
    { id: 'fb-12', title: 'AI 芯片三大路线并行发展', desc: '【云计算】近存计算 3D 堆叠芯片成为颠覆性架构，OpenAI 自研推理芯片 Jalapeno 即将规模化商用。英伟达、国产 NPU、自研芯片三足鼎立。', category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09', url: 'https://blog.51cto.com/u_10819805/14749006' }
  ];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname !== '/api/articles') {
      return new Response(JSON.stringify({ error: 'Not found' }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Try to get from cache
    const cache = caches.default;
    const cacheKey = new Request('https://tech-daily-worker/articles', request);
    let response = await cache.match(cacheKey);

    if (response) {
      return response;
    }

    // Fetch fresh data
    const [githubData, hnData] = await Promise.allSettled([
      fetchGitHub(),
      fetchHackerNews()
    ]);

    let articles = [];
    const fallback = getFallbackArticles();
    articles.push(...fallback);

    if (githubData.status === 'fulfilled') {
      articles.push(...githubData.value);
    }

    if (hnData.status === 'fulfilled') {
      articles.push(...hnData.value);
    }

    articles = articles.slice(0, 30);

    response = new Response(JSON.stringify({ 
      articles, 
      updatedAt: new Date().toISOString(),
      source: 'Cloudflare Worker' 
    }), { 
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600'
      }
    });

    // Cache for 1 hour
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  }
};
