// Tech Daily - Dynamic Data Application
// Fetches real-time tech news from multiple public APIs with Chinese descriptions

// DOM Elements
const articlesGrid = document.getElementById('articlesGrid');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const currentDateEl = document.getElementById('currentDate');
const statCountEl = document.getElementById('statCount');
const filterBtns = document.querySelectorAll('.filter-btn');
const themeToggle = document.getElementById('themeToggle');
const retryBtn = document.getElementById('retryBtn');

let allArticles = [];
let currentCategory = 'all';
let displayCount = 6;

// Category mapping for auto-classification
const categoryKeywords = {
  ai: ['ai', 'machine learning', 'llm', 'gpt', 'neural', 'deep learning', 'model', 'openai', 'claude', 'gemini', 'autogpt', 'agent', 'embedding', 'transformer', 'diffusion', 'llama', 'mistral', 'anthropic'],
  frontend: ['react', 'vue', 'angular', 'svelte', 'css', 'html', 'ui', 'frontend', 'web', 'javascript', 'typescript', 'browser', 'dom', 'webpack', 'vite', 'tailwind', 'nextjs', 'nuxt'],
  backend: ['server', 'api', 'database', 'sql', 'rust', 'go', 'golang', 'python', 'java', 'node', 'backend', 'grpc', 'redis', 'postgres', 'mysql', 'mongodb', 'django', 'flask', 'spring'],
  cloud: ['cloud', 'kubernetes', 'k8s', 'docker', 'aws', 'azure', 'gcp', 'infra', 'terraform', 'serverless', 'lambda', 'ecs', 'container', 'nginx', 'kafka'],
  devops: ['ci/cd', 'pipeline', 'deploy', 'git', 'github', 'action', 'jenkins', 'argo', 'helm', 'prometheus', 'grafana', 'observability', 'monitoring', 'logging'],
  security: ['security', 'vulnerability', 'exploit', 'crypto', 'hack', 'cve', 'penetration', 'xss', 'csrf', 'oauth', 'encryption', 'firewall', 'malware']
};

const categoryLabels = {
  ai: '人工智能',
  frontend: '前端开发',
  backend: '后端架构',
  cloud: '云计算',
  devops: 'DevOps',
  security: '网络安全'
};

const categoryColors = {
  ai: '#818cf8',
  frontend: '#38bdf8',
  backend: '#4ade80',
  cloud: '#c084fc',
  devops: '#fb923c',
  security: '#f87171'
};

// Auto-classify article
function classifyArticle(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    scores[cat] = keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0);
  }
  const bestCat = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return bestCat && bestCat[1] > 0 ? bestCat[0] : 'devops';
}

// Generate Chinese description
function generateChineseDesc(category, title, originalDesc) {
  const catName = categoryLabels[category] || '技术';

  // If already Chinese
  if (originalDesc && /[\u4e00-\u9fa5]/.test(originalDesc)) {
    return originalDesc;
  }

  if (!originalDesc || originalDesc === 'No description available') {
    const templates = {
      ai: `【${catName}】${title} — 专注于大模型、智能体或机器学习相关的开源项目`,
      frontend: `【${catName}】${title} — 前端框架、UI 组件或 Web 开发工具`,
      backend: `【${catName}】${title} — 后端服务、数据库或 API 开发方案`,
      cloud: `【${catName}】${title} — 云原生基础设施或容器化部署工具`,
      devops: `【${catName}】${title} — 开发运维自动化、CI/CD 或监控方案`,
      security: `【${catName}】${title} — 安全工具、漏洞检测或加密方案`
    };
    return templates[category] || `【${catName}】${title}`;
  }

  const shortDesc = originalDesc.length > 120
    ? originalDesc.substring(0, 120) + '...'
    : originalDesc;

  return `【${catName}】${shortDesc}`;
}

// Initialize
function init() {
  renderDate();
  setupEventListeners();
  loadTheme();
  fetchArticles();
}

function renderDate() {
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  currentDateEl.textContent = now.toLocaleDateString('zh-CN', options);
}

// Fetch articles from multiple sources
async function fetchArticles() {
  showLoading();

  try {
    const [githubData, hnData] = await Promise.allSettled([
      fetchGitHubTrending(),
      fetchHackerNews()
    ]);

    let articles = [];

    // Add fallback Chinese articles first (as featured content)
    const fallback = getFallbackArticles();
    articles.push(...fallback);

    if (githubData.status === 'fulfilled') {
      articles.push(...githubData.value);
    }

    if (hnData.status === 'fulfilled') {
      articles.push(...hnData.value);
    }

    allArticles = articles;
    displayCount = 6;

    statCountEl.textContent = allArticles.length;
    renderFeatured();
    renderArticles(currentCategory);
    showArticles();
  } catch (error) {
    console.error('Fetch error:', error);
    allArticles = getFallbackArticles();
    displayCount = 6;
    statCountEl.textContent = allArticles.length;
    renderFeatured();
    renderArticles(currentCategory);
    showArticles();
  }
}

// Fetch GitHub trending
async function fetchGitHubTrending() {
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
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
      );
      if (!response.ok) continue;
      const data = await response.json();

      for (const repo of data.items || []) {
        const cat = classifyArticle(repo.name, repo.description || '');
        articles.push({
          id: `gh-${repo.id}`,
          title: repo.name,
          desc: generateChineseDesc(cat, repo.name, repo.description),
          originalDesc: repo.description || '',
          category: cat,
          categoryLabel: categoryLabels[cat],
          source: `GitHub · ${item.zh}`,
          date: repo.updated_at ? repo.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
          url: repo.html_url,
          stars: repo.stargazers_count || 0,
          lang: 'en'
        });
      }
    } catch (e) {
      console.warn('GitHub API error:', e);
    }
  }

  return articles;
}

// Fetch Hacker News
async function fetchHackerNews() {
  try {
    const response = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10');
    if (!response.ok) return [];
    const data = await response.json();
    const articles = [];

    for (const hit of data.hits || []) {
      const cat = classifyArticle(hit.title, '');
      articles.push({
        id: `hn-${hit.objectID}`,
        title: hit.title,
        desc: `【${categoryLabels[cat]}】Hacker News 热门讨论：${hit.title}`,
        originalDesc: hit.title,
        category: cat,
        categoryLabel: categoryLabels[cat],
        source: 'Hacker News',
        date: hit.created_at ? hit.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        points: hit.points || 0,
        comments: hit.num_comments || 0,
        lang: 'en'
      });
    }

    return articles;
  } catch (e) {
    console.warn('HN API error:', e);
    return [];
  }
}

// Fallback Chinese articles
function getFallbackArticles() {
  return [
    {
      id: 'fb-1', title: 'AI Agent 进入 L3 自治时代',
      desc: '【人工智能】行业彻底告别问答式被动大模型，进入主动规划、自主执行、长期记忆、多智能体协同的 L3 自治时代。OpenAI GPT Agents、微软 AutoDev 等头部产品已落地，预计 2030 年替代 30% 移动端 App 交互。',
      category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006', featured: true
    },
    {
      id: 'fb-2', title: '统一原生多模态大模型发布',
      desc: '【人工智能】GPT-5.2 / Gemini 3 / Claude 3.5 统一基座模型发布，全部模态共享一套底层编码器。阿里 Qwen3.7-Max 全球盲测国产第一，火山引擎 Seedance2.5 支持原生 30 秒连贯高清视频生成。',
      category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006', featured: true
    },
    {
      id: 'fb-3', title: '华为 Atlas 950 超节点发布',
      desc: '【云计算】华为 Atlas 950 超节点单柜 64 卡，最大扩展 8192 张 NPU，总算力、互联带宽、内存容量大幅领先海外方案，专为万亿参数大模型训练设计。',
      category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006', featured: true
    },
    {
      id: 'fb-4', title: '具身智能量产元年开启',
      desc: '【人工智能】2026 年为人形机器人量产元年，国内全年产量有望突破 10 万台。LingBot-VLA2.0 一套模型兼容 20 款机器人硬件，单 4090 即可低延迟实时控制。',
      category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    },
    {
      id: 'fb-5', title: '端侧原生离线 AI 成为消费级卖点',
      desc: '【人工智能】2026 消费电子核心卖点是不上云、本地运行大模型。苹果折叠屏 iPhone 内置端侧多模态基座，车载端侧大模型交互延迟低于 500ms，数据不离开设备保护隐私。',
      category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    },
    {
      id: 'fb-6', title: 'AI Coding 全栈开发智能体',
      desc: '【DevOps】GitHub Copilot 新增图像 / PDF 识图写代码；豆包、Qwen 代码智能体可独立完成完整工程、自测迭代、部署上线，程序员效率提升 50% 以上。',
      category: 'devops', categoryLabel: 'DevOps', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    },
    {
      id: 'fb-7', title: '绿色低碳 AI 能碳智算中枢',
      desc: '【云计算】低功耗近存芯片、液冷集群降低数据中心能耗，解决 AI 算力高耗电痛点。能碳智算中枢一体化管理算力、电力、碳排放，实现可持续 AI 发展。',
      category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    },
    {
      id: 'fb-8', title: 'WAIC 2026 世界人工智能大会',
      desc: '【人工智能】2026 世界人工智能大会将于 7 月 17 日至 20 日在上海举办，超 300 款产品将全球首发，包括近存 3D 芯片、Agent 操作系统、人形机器人量产方案。',
      category: 'ai', categoryLabel: '人工智能', source: '头条新闻', date: '2026-07-07',
      url: 'https://m.toutiao.com/group/7659698839352115753/'
    },
    {
      id: 'fb-9', title: '云计算算力订单加码景气升温',
      desc: '【云计算】云计算成为大模型训练、智能推理、AI Agent 运行的核心基础设施。算力订单加码、云厂商涨价，产业景气度加速验证。',
      category: 'cloud', categoryLabel: '云计算', source: '头条新闻', date: '2026-07-09',
      url: 'https://m.toutiao.com/group/7660126621034086921/'
    },
    {
      id: 'fb-10', title: '无标注自监督数据生成突破',
      desc: '【人工智能】AI 自动生成仿真训练数据，无需人工标注。解决医疗影像、工业缺陷样本稀缺痛点，国内模型登顶 Nature 子刊临床验证。',
      category: 'ai', categoryLabel: '人工智能', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    },
    {
      id: 'fb-11', title: 'Token 工厂革新算力商业模式',
      desc: '【云计算】算力厂商告别按算力时长收费，改为按 AI 产出 Token 计价，算力厂商与模型企业收益分成，适配 Agent、多模态海量调用需求。',
      category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    },
    {
      id: 'fb-12', title: 'AI 芯片三大路线并行发展',
      desc: '【云计算】近存计算 3D 堆叠芯片成为颠覆性架构，OpenAI 自研推理芯片 Jalapeno 即将规模化商用。英伟达、国产 NPU、自研芯片三足鼎立。',
      category: 'cloud', categoryLabel: '云计算', source: '51CTO', date: '2026-07-09',
      url: 'https://blog.51cto.com/u_10819805/14749006'
    }
  ];
}

// Render featured section (Today\'s picks)
function renderFeatured() {
  // Prioritize featured articles, then fill with latest articles from all sources
  let featured = allArticles.filter(a => a.featured).slice(0, 3);

  if (featured.length < 3) {
    const usedIds = new Set(featured.map(a => a.id));
    const remaining = allArticles.filter(a => !usedIds.has(a.id));
    // Shuffle remaining articles for variety
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    featured = [...featured, ...remaining.slice(0, 3 - featured.length)];
  }

  if (featured.length === 0) return;

  const featuredSection = document.getElementById('featuredSection');
  if (!featuredSection) return;

  featuredSection.innerHTML = featured.map((article, index) => `
    <a href="${article.url}" class="featured-card" data-external="true" style="animation-delay: ${index * 0.1}s">
      <div class="featured-badge">今日推荐</div>
      <div class="featured-category category-${article.category}">${article.categoryLabel}</div>
      <h3 class="featured-title">${escapeHtml(article.title)}</h3>
      <p class="featured-desc">${escapeHtml(article.desc.replace(/【.*?】/, ''))}</p>
      <div class="featured-footer">
        <span class="featured-source">${article.source}</span>
        <span class="featured-date">${article.date}</span>
      </div>
    </a>
  `).join('');
}

// Render articles with pagination
function renderArticles(category) {
  let filtered = category === 'all'
    ? allArticles
    : allArticles.filter(a => a.category === category);

  const totalCount = filtered.length;
  const displayed = filtered.slice(0, displayCount);

  if (displayed.length === 0) {
    articlesGrid.innerHTML = '<div class="no-data">该分类暂无文章</div>';
    return;
  }

  let html = displayed.map((article, index) => `
    <article class="article-card" style="animation-delay: ${index * 0.05}s" data-id="${article.id}">
      <div class="article-header">
        <span class="article-category category-${article.category}">${article.categoryLabel}</span>
        <span class="article-date">${article.date}</span>
      </div>
      <h3 class="article-title">${escapeHtml(article.title)}</h3>
      <p class="article-desc">${escapeHtml(article.desc)}</p>
      <div class="article-footer">
        <div class="article-source">
          <span class="source-dot"></span>
          <span>${article.source}</span>
          ${article.stars ? `<span class="article-meta">⭐ ${formatNumber(article.stars)}</span>` : ''}
          ${article.points ? `<span class="article-meta">▲ ${article.points}</span>` : ''}
        </div>
        <a href="${article.url}" class="article-link" data-external="true">
          阅读全文
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
      </div>
    </article>
  `).join('');

  // Add load more button
  if (totalCount > displayCount) {
    html += `
      <div class="load-more-wrapper">
        <button class="load-more-btn" id="loadMoreBtn">
          <span>查看更多</span>
          <span class="load-more-count">还有 ${totalCount - displayCount} 条</span>
        </button>
      </div>
    `;
  }

  articlesGrid.innerHTML = html;

  // Attach load more listener
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      displayCount += 6;
      renderArticles(currentCategory);
    });
  }
}

function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  loadingState.style.display = 'flex';
  articlesGrid.style.display = 'none';
  errorState.style.display = 'none';
}

function showArticles() {
  loadingState.style.display = 'none';
  articlesGrid.style.display = 'grid';
  errorState.style.display = 'none';
}

function setupEventListeners() {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      displayCount = 6;
      renderArticles(currentCategory);
    });
  });

  themeToggle.addEventListener('click', toggleTheme);
  retryBtn.addEventListener('click', fetchArticles);

  // Handle all external link clicks via event delegation (fixes Chrome popup blocker)
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[data-external="true"]');
    if (link && link.href) {
      e.preventDefault();
      e.stopPropagation();
      // Use location.href as fallback if window.open is blocked
      const newWin = window.open(link.href, '_blank', 'noopener,noreferrer');
      if (!newWin || newWin.closed) {
        window.location.href = link.href;
      }
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    });
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'light' ? 'dark' : 'light');
}

function setTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

init();
