/* ============================================================
   小凉工作台 · 应用逻辑（纯前端 / localStorage / 离线 PWA）
   ============================================================ */
'use strict';

/* ---------- 本地存储封装 ---------- */
const DB = {
  get(k, def) { try { const v = localStorage.getItem('xl_' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { localStorage.setItem('xl_' + k, JSON.stringify(v)); }
};

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (s) => s || '—';
const num = (n) => (n == null || isNaN(n) ? 0 : Number(n));

/* ---------- 轻提示 ---------- */
let toastTimer;
function toast(msg) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}

/* ---------- 全局状态 ---------- */
const state = { view: 'amazon', growth: 'photo', plan: 'diet', play: 'douyin', amazon: 'news' };
let dailyCal = { year: new Date().getFullYear(), month: new Date().getMonth() };

/* ============================================================
   导航
   ============================================================ */
const NAV = [
  { id: 'amazon', ico: '📦', label: 'Amazon' },
  { id: 'growth', ico: '🌱', label: 'Growth' },
  { id: 'play', ico: '🎮', label: 'Play' },
  { id: 'plan', ico: '📋', label: 'Plan' },
  { id: 'daily', ico: '📝', label: 'Daily' }
];
function renderNav() {
  const side = $('#sidebar-nav');
  side.innerHTML = NAV.map(n =>
    `<div class="nav-item ${state.view === n.id ? 'active' : ''}" data-nav="${n.id}">
       <span class="ico">${n.ico}</span><span>${n.label}</span>
     </div>`).join('');
  const bot = $('#bottom-nav');
  bot.innerHTML = NAV.map(n =>
    `<div class="nav-item ${state.view === n.id ? 'active' : ''}" data-nav="${n.id}">
       <span class="ico">${n.ico}</span><span class="label">${n.label}</span>
     </div>`).join('');
}

/* ============================================================
   路由
   ============================================================ */
function go(view) {
  state.view = view;
  renderNav();
  renderView();
  window.scrollTo(0, 0);
}
function renderView() {
  const v = $('#view');
  const map = { amazon: viewAmazon, growth: viewGrowth, play: viewPlay, plan: viewPlan, daily: viewDaily };
  v.innerHTML = (map[state.view] || viewAmazon)();
  bindView();
}

/* ============================================================
   通用：条目渲染 + 增删
   ============================================================ */
function listItem(it, opts = {}) {
  let extra = '';
  if (opts.comments) extra = `<div class="comments">${opts.comments.map((c, i) => `<div class="comment">${esc(c)}</div>`).join('')}</div>`;
  if (opts.lyric) extra = `<div class="body" style="font-style:italic;color:var(--purple-d)">“${esc(opts.lyric)}”</div>` + extra;
  return `<div class="item">
    <div class="head"><span class="title">${esc(it.title || it.song || '')}</span>
      ${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}
      ${it.artist ? `<span class="meta">— ${esc(it.artist)}</span>` : ''}
      ${it.date ? `<span class="meta" style="margin-left:auto">${esc(it.date)}</span>` : ''}</div>
    <div class="body">${esc(it.body || it.summary || it.note || '')}</div>
    ${it.caseStudy ? `<div class="body" style="color:var(--text-soft)"><b>📌 案例：</b>${esc(it.caseStudy)}</div>` : ''}
    ${extra}
  </div>`;
}

/* ============================================================
   1. AMAZON
   ============================================================ */
function viewAmazon() {
  const S = window.SEED.amazon;
  const tabs = [['news', '📰 政策新闻'], ['sales', '📊 销量数据'], ['market', '🔍 市场分析'], ['interview', '💬 面试问答'], ['tips', '🎯 运营技巧']];
  const inner = {
    news: viewAmazonNews,
    sales: viewAmazonSales,
    market: viewAmazonMarket,
    interview: viewAmazonInterview,
    tips: viewAmazonTips
  }[state.amazon]();
  return `
  <div class="topbar"><h1>📦 Amazon 运营台</h1><span class="pill">美国站 · 紧固件 / 气动钉枪</span></div>
  <div class="subtabs">${tabs.map(t => `<div class="subtab ${state.amazon === t[0] ? 'active' : ''}" data-amz="${t[0]}">${t[1]}</div>`).join('')}</div>
  ${inner}`;
}
function viewAmazonNews() {
  const seed = window.SEED.amazon.news;
  const mine = DB.get('amz_news', []);
  const all = [...mine, ...seed];
  return `<div class="card">
    <h2>📰 每日政策 & 新闻速递</h2>
    <p class="desc">目标：每日 8 点前整理推送亚马逊美国站相关政策变化与简短新闻。（此处为示例内容，自动化推送需常驻服务器，详见交付说明）</p>
    <div class="note">💡 想真正"每日 8 点自动推送"：后端已就绪——每天 7:30 自动抓取并推送到手机。下方"🔄 自动简报"即实时数据。</div>
    <div id="amz-feed"><p class="muted">正在拉取每日自动简报…</p></div>
    <hr class="hr"/>
    <h2 style="font-size:15px">📌 我的补充 / 手动录入</h2>
    ${all.map(it => listItem(it)).join('')}
    <hr class="hr"/>
    <h2 style="font-size:15px">＋ 新增一条新闻/政策</h2>
    <div class="row">
      <div><label class="f">日期</label><input id="nw_date" type="date" value="${todayStr()}"></div>
      <div><label class="f">标签</label><input id="nw_tag" placeholder="政策/物流/广告/合规"></div>
    </div>
    <label class="f">标题</label><input id="nw_title" placeholder="标题">
    <label class="f">摘要</label><textarea id="nw_sum"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addNews">保存</button>
  </div>`;
}
function loadAmazonFeed() {
  const box = document.getElementById('amz-feed');
  if (!box) return;
  const cache = DB.get('amz_feed', null);
  if (cache && cache.items) box.innerHTML = renderFeed(cache);
  if (typeof fetch !== 'function') {
    if (!cache) box.innerHTML = '<p class="muted">当前环境不支持自动拉取，将显示示例内容。</p>';
    return;
  }
  // 优先后端 API；失败时回退到静态部署的 news.json（GitHub Pages 模式）
  fetch('./api/news?topic=amazon')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => { if (d && d.items && d.items.length) { DB.set('amz_feed', d); box.innerHTML = renderFeed(d); } else fallbackFeed(cache, box); })
    .catch(() => fetch('./backend/data/news.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.items && d.items.length) { DB.set('amz_feed', d); box.innerHTML = renderFeed(d); }
        else fallbackFeed(cache, box);
      })
      .catch(() => fallbackFeed(cache, box)));
}
function fallbackFeed(cache, box) {
  if (cache) return;
  box.innerHTML = '<p class="muted">自动简报暂不可用（离线或后端未启动），将显示示例内容。</p>';
}
function renderFeed(d) {
  const items = d.items || [];
  const head = `<div class="head" style="margin-bottom:8px"><span class="tag">🔄 自动抓取</span>
    <span class="meta" style="margin-left:auto">更新于 ${esc(d.updated || '—')} · 共 ${items.length} 条</span></div>`;
  if (!items.length) return head + '<p class="muted">暂无自动抓取内容。</p>';
  return head + items.map(it => `<div class="item">
    <div class="head"><span class="title"><a href="${esc(it.link)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(it.title)}</a></span>
      ${it.query ? `<span class="tag">${esc(it.query)}</span>` : ''}
      ${it.pubDate ? `<span class="meta" style="margin-left:auto">${esc(it.pubDate)}</span>` : ''}</div>
    ${it.summary ? `<div class="body" style="color:var(--purple-d);line-height:1.7">📝 ${esc(it.summary)}</div>` : ''}
    <div class="meta">来源：${esc(it.source || '—')} · <a href="${esc(it.link)}" target="_blank" rel="noopener">查看原文 ↗</a></div>
  </div>`).join('');
}
function viewAmazonInterview() {
  const seed = window.SEED.amazon.interview || [];
  return `<div class="card"><h2>💬 亚马逊运营面试问答</h2><p class="desc">常见面试题 + 回答思路，面试前过一遍。</p>${seed.map(it => listItem(it)).join('')}</div>`;
}
function viewAmazonTips() {
  const seed = window.SEED.amazon.tips || [];
  return `<div class="card"><h2>🎯 亚马逊美国站运营技巧</h2><p class="desc">选品、广告、转化、物流、合规、品牌实战技巧。</p>${seed.map(it => listItem(it)).join('')}</div>`;
}
function viewAmazonSales() {
  const owners = ['负责人A', '负责人B', '负责人C', '负责人D']; // 汇保 4 个 listing 负责人
  const today = todayStr();
  const rows = DB.get('amz_sales', []).filter(r => r.date === today);
  const byOwner = {}; owners.forEach(o => byOwner[o] = rows.find(r => r.owner === o) || {});
  const totQty = rows.reduce((s, r) => s + num(r.qty), 0);
  const totAmt = rows.reduce((s, r) => s + num(r.amount), 0);
  return `<div class="card">
    <h2>📊 领星 ERP · 今日销量（汇保 4 负责人）</h2>
    <p class="desc">每日 14:57 查看 首页&gt;排行榜&gt;汇保 &gt; 4 个 listing 负责人下的销量与销售额，填到这里自动汇总。</p>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="stat"><div class="k">今日总销量</div><div class="v">${totQty}</div></div>
      <div class="stat"><div class="k">今日总销售额</div><div class="v">$${totAmt.toFixed(2)}</div></div>
      <div class="stat"><div class="k">负责人数量</div><div class="v">4</div></div>
      <div class="stat"><div class="k">日期</div><div class="v" style="font-size:16px">${today}</div></div>
    </div>
    <div class="note">🔐 账号密码等敏感信息请勿写入前端代码。此处仅作"手动录入/粘贴"入口，安全合规。</div>
    <table style="margin-top:14px">
      <thead><tr><th>负责人</th><th>销量</th><th>销售额($)</th><th></th></tr></thead>
      <tbody>
        ${owners.map(o => `<tr>
          <td>${o}</td>
          <td><input id="sq_${o}" type="number" value="${byOwner[o].qty ?? ''}" placeholder="0"></td>
          <td><input id="sa_${o}" type="number" step="0.01" value="${byOwner[o].amount ?? ''}" placeholder="0"></td>
          <td><button class="btn ghost sm" data-act="saveSales" data-owner="${o}">存</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <hr class="hr"/>
    <h2 style="font-size:15px">📅 历史记录</h2>
    ${historySalesTable()}
  </div>`;
}
function historySalesTable() {
  const all = DB.get('amz_sales', []);
  if (!all.length) return `<p class="muted">暂无历史，先填上方今日数据。</p>`;
  const days = [...new Set(all.map(r => r.date))].sort().reverse().slice(0, 10);
  return `<table><thead><tr><th>日期</th><th>总销量</th><th>总销售额($)</th></tr></thead><tbody>
    ${days.map(d => {
      const rs = all.filter(r => r.date === d);
      const q = rs.reduce((s, r) => s + num(r.qty), 0), a = rs.reduce((s, r) => s + num(r.amount), 0);
      return `<tr><td>${d}</td><td>${q}</td><td>$${a.toFixed(2)}</td></tr>`;
    }).join('')}
  </tbody></table>`;
}
function viewAmazonMarket() {
  const m = window.SEED.amazon.market;
  const mine = DB.get('amz_market_notes', []);
  return `<div class="card">
    <h2>🔍 市场销售情况 · 钉子紧固件 / 气动钉枪</h2>
    <p class="desc">更新于 ${m.update} · 含 meite 等品牌、搜索词(ABA)、商机探测器方向</p>
    <div class="body" style="white-space:pre-wrap;line-height:1.8">${esc(m.summary)}</div>
    <h2 style="font-size:15px;margin-top:16px">✅ 每日动作清单</h2>
    ${m.tips.map(t => `<div class="item" style="margin-bottom:8px"><div class="body">${esc(t)}</div></div>`).join('')}
    <hr class="hr"/>
    <h2 style="font-size:15px">📌 我的市场备注</h2>
    ${mine.map((n, i) => `<div class="item" style="margin-bottom:8px"><div class="meta">${esc(n.date)}</div><div class="body">${esc(n.text)}</div>
      <button class="btn ghost sm" style="margin-top:6px" data-act="delMarket" data-i="${i}">删除</button></div>`).join('') || '<p class="muted">还没有备注。</p>'}
    <label class="f">添加今日市场观察</label><textarea id="mk_text" placeholder="例如：ABA 显示 brad nailer 搜索周环比 +12%…"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addMarket">保存备注</button>
  </div>`;
}

/* ============================================================
   2. GROWTH
   ============================================================ */
const GROWTH_TABS = [
  ['photo', '📷 摄影修图'], ['skincare', '💄 护肤化妆'], ['music', '🎵 歌曲分享'],
  ['finance', '💰 理财学习'], ['law', '⚖️ 法律知识'], ['books', '📚 书籍阅读'],
  ['quotes', '✍️ 句段记录'], ['career', '💼 职场成长'], ['film', '🎬 影视综艺']
, ['english', '🇬🇧 英语学习'], ['korean', '🇰🇷 韩语零基础'], ['japanese', '🇯🇵 日语零基础']
];
function viewGrowth() {
  const inner = {
    photo: gList('photo', '摄影修图', '每日拍照/修图/姿势/穿搭技巧'),
    skincare: gList('skincare', '护肤化妆', '混干皮科学护肤 · 化妆 · 编发'),
    music: gMusic(),
    finance: gList('finance', '理财学习', '基金热点 · 工资规划 · 金融知识'),
    law: gList('law', '法律知识', '每日普法 + 案例辅助'),
    books: gBooks(),
    quotes: gQuotes(),
    career: gList('career', '职场成长', '口才 · Excel 切片/透视表等'),
    film: gFilm(),
    english: gList('english', '英语学习', '专八词汇 · 口语跟读 · 影视句段'),
    korean: gList('korean', '韩语零基础', '发音 · 单词 · 实用句型'),
    japanese: gList('japanese', '日语零基础', '五十音 · 单词 · 实用句型')
  }[state.growth];
  return `<div class="topbar"><h1>🌱 Growth 成长台</h1><span class="pill">十二大板块 · 每日充电</span></div>
    <div class="subtabs">${GROWTH_TABS.map(t => `<div class="subtab ${state.growth === t[0] ? 'active' : ''}" data-grow="${t[0]}">${t[1]}</div>`).join('')}</div>
    ${inner}`;
}
function gList(key, name, desc) {
  const seed = window.SEED.growth[key] || [];
  const mine = DB.get('g_' + key, []);
  const all = [...mine, ...seed];
  return `<div class="card"><h2>${name}</h2><p class="desc">${desc}</p>
    ${all.map(it => listItem(it)).join('')}
    <hr class="hr"/><h2 style="font-size:15px">＋ 添加一条</h2>
    <div class="row"><div><label class="f">标签</label><input id="g_tag" placeholder="如 技巧/原理"></div></div>
    <label class="f">标题</label><input id="g_title" placeholder="标题">
    <label class="f">内容</label><textarea id="g_body"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addGrowth" data-key="${key}">保存</button>
  </div>`;
}
function gMusic() {
  const seed = window.SEED.growth.music;
  const mine = DB.get('g_music', []);
  const all = [...mine, ...seed];
  return `<div class="card"><h2>🎵 歌曲分享</h2><p class="desc">每日一首歌 + 歌词 + 网易云前 10 热评</p>
    ${all.map((s, idx) => `<div class="item">
      <div class="head"><span class="title">${esc(s.song)}</span><span class="meta">— ${esc(s.artist)}</span></div>
      <div class="body" style="font-style:italic;color:var(--purple-d)">“${esc(s.lyric)}”</div>
      <div class="comments"><b style="font-size:12px;color:var(--text-soft)">网易云热评 Top10</b>${s.comments.map(c => `<div class="comment">${esc(c)}</div>`).join('')}</div>
    </div>`).join('')}
    <hr class="hr"/><h2 style="font-size:15px">＋ 添加一首</h2>
    <div class="row"><div><label class="f">歌名</label><input id="m_song"></div><div><label class="f">歌手</label><input id="m_artist"></div></div>
    <label class="f">歌词(一句)</label><input id="m_lyric">
    <label class="f">热评(每行一条)</label><textarea id="m_comments" placeholder="第一行\n第二行"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addMusic">保存</button>
  </div>`;
}
function gBooks() {
  const seed = window.SEED.growth.books;
  const mine = DB.get('g_books', []);
  const all = [...mine, ...seed];
  return `<div class="card"><h2>📚 书籍阅读</h2><p class="desc">记录读过的书 + 与 AI 探讨（下方窗口）</p>
    ${all.map(b => `<div class="item"><div class="head"><span class="title">${esc(b.title)}</span><span class="meta">— ${esc(b.author)}</span></div><div class="body">${esc(b.note)}</div></div>`).join('')}
    <hr class="hr"/><h2 style="font-size:15px">＋ 读完/在读一本书</h2>
    <div class="row"><div><label class="f">书名</label><input id="b_title"></div><div><label class="f">作者</label><input id="b_author"></div></div>
    <label class="f">我的想法/笔记</label><textarea id="b_note"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addBook">保存</button>
    ${aiChat('books')}
  </div>`;
}
function gFilm() {
  const seed = window.SEED.growth.film;
  const mine = DB.get('g_film', []);
  const all = [...mine, ...seed];
  return `<div class="card"><h2>🎬 影视综艺</h2><p class="desc">追剧记录 + 与 AI 探讨 / 写影评</p>
    ${all.map(f => `<div class="item"><div class="head"><span class="title">${esc(f.title)}</span></div><div class="body">${esc(f.note)}</div></div>`).join('')}
    <hr class="hr"/><h2 style="font-size:15px">＋ 记录一部</h2>
    <label class="f">剧名</label><input id="f_title">
    <label class="f">我的评价/笔记</label><textarea id="f_note"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addFilm">保存</button>
    ${aiChat('film')}
  </div>`;
}
function gQuotes() {
  const seed = window.SEED.growth.quotes;
  const mine = DB.get('g_quotes', []);
  const all = [...mine, ...seed];
  return `<div class="card"><h2>✍️ 句段记录 · 个人知识库</h2>
    <p class="desc">随时记录各平台看到的有哲理/有意思的文案；下方每日推送也在这里沉淀。支持搜索。</p>
    <input id="q_search" placeholder="🔍 搜索句段…" style="margin-bottom:12px">
    <div id="q_list">${all.map((q, i) => `<div class="item" style="margin-bottom:8px"><div class="body">${esc(q.text || q)}</div>
      <button class="btn ghost sm" style="margin-top:4px" data-act="delQuote" data-i="${i}">删除</button></div>`).join('')}</div>
    <hr class="hr"/><h2 style="font-size:15px">＋ 记录一句</h2>
    <textarea id="q_text" placeholder="粘贴你喜欢的句子…"></textarea>
    <button class="btn sm" style="margin-top:10px" data-act="addQuote">保存</button>
  </div>`;
}

/* ---------- AI 探讨窗口（本地版） ---------- */
function aiChat(topic) {
  const hist = DB.get('chat_' + topic, []);
  return `<div class="hr"></div><h2 style="font-size:15px">🤖 AI 探讨窗口（${topic === 'books' ? '读书' : '影视'}）</h2>
    <p class="muted">提示：当前为离线本地版，会基于你的输入给引导式追问，帮你梳理想法。接入大模型 API 后即为真 AI（见交付说明）。</p>
    <div class="chat" id="chat_${topic}">${(hist.length ? hist : [{role:'ai', text:'聊聊你刚记录的内容吧～可以说说你的感受或疑惑 🙂'}]).map(m => `<div class="msg ${m.role}">${esc(m.text)}</div>`).join('')}</div>
    <div class="chat-input"><input id="chat_in_${topic}" placeholder="输入你的想法…"><button class="btn sm" data-act="chatSend" data-topic="${topic}">发送</button></div>`;
}
function aiReply(text) {
  const t = (text || '').toLowerCase();
  const pool = [
    '这个角度很有意思 👍 能再多说说你为什么这么想吗？',
    '听起来你挺有感触的。如果用一句话总结核心观点，会是什么？',
    '我喜欢这个切入点。它让你联想到生活/工作里的什么场景了吗？',
    '不错～ 如果反过来想，会有不同的结论吗？',
    '记下来很好。你打算怎么把这点用到实际里？',
    '嗯，有画面感了。你最被打动的是哪一部分？'
  ];
  if (/为什么|怎么|如何|why|how/.test(t)) return '好问题。先拆成小步：① 明确你真正想知道的点 ② 找 1-2 个例子验证 ③ 形成自己的判断。你先想从哪一步开始？';
  if (/喜欢|爱|感动|哭|泪/.test(t)) return '情绪是最真实的信号 💜 能把这份感受写进 Daily 日记里吗？日后回看会很有力量。';
  if (/不懂|困惑|迷茫|不会/.test(t)) return '迷茫很正常，说明你在突破舒适区。先接受一个"暂时不清楚"，再列 3 个可能的小行动试试？';
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ============================================================
   3. PLAY
   ============================================================ */
function renderObjCard(o) {
  return `<div class="item">
    <div class="head"><span class="title">${esc(o.title || '')}</span></div>
    <div class="body">${esc(o.body || '')}</div>
  </div>`;
}
function renderPlayItem(x) {
  if (typeof x === 'string') return `<div class="item"><div class="body">${esc(x)}</div></div>`;
  if (x.link) return `<a class="item play-link-card" href="${esc(x.link)}" target="_blank" rel="noopener">
    <div class="head"><span class="title">${esc(x.text || '链接')}</span><span class="meta">↗ 打开</span></div>
    ${x.body ? `<div class="body">${esc(x.body)}</div>` : ''}
  </a>`;
  return `<div class="item"><div class="head"><span class="title">${esc(x.text || '')}</span></div><div class="body">${esc(x.body || '')}</div></div>`;
}
function viewPlay() {
  const S = window.SEED.play;
  const tabs = [
    ['douyin', '🎵 抖音'], ['xhs', '📕 小红书'], ['positive', '✨ 正能量'],
    ['national', '🇨🇳 国家新闻'], ['ai', '🤖 AI资讯'], ['aitips', '💡 AI技巧'], ['werewolf', '🐺 狼人杀'],
    ['home', '🏠 家居收纳'], ['sing', '🎤 学唱歌'], ['dance', '💃 学跳舞'], ['posture', '🧘 体态']
  ];
  const cur = state.play;
  const curLabel = (tabs.find(t => t[0] === cur) || [,''])[1];
  const descMap = {
    douyin: '抖音热点整理：蹭热点、找选题、攒素材。',
    xhs: '小红书趋势：穿搭 / 护肤 / 旅行 / 摄影，收藏灵感。',
    positive: '正能量视频与 UP 主推荐，治愈自己。',
    national: '国家大事与民生政策，保持关注。',
    ai: 'AI 平台动态整合推送：精选摘要 + 每日实时快讯。',
    aitips: 'AI 使用技巧：把大模型用得更顺手。',
    werewolf: '狼人杀玩法技巧：从发言到归票的思路。',
    home: '家居收纳技巧：让小空间变好用。',
    sing: '零基础学唱歌：呼吸、音准、发声、情感表达。',
    dance: '零基础学跳舞：基本功、跟舞、录舞技巧。',
    posture: '体态改正：动作展示 + 日常习惯。'
  };
  let body = '';
  const STR = ['douyin', 'xhs', 'positive', 'national', 'home', 'sing', 'dance', 'posture'];
  if (STR.includes(cur)) {
    const key = cur === 'xhs' ? 'xiaohongshu' : cur;
    const seedArr = S[key] || [];
    const user = DB.get('play_' + cur, []);
    body = [...user, ...seedArr].map(renderPlayItem).join('');
  } else if (cur === 'ai') {
    const seedArr = (S.ai || []).map(x => ({ title: x.title, body: x.summary }));
    const user = DB.get('play_ai', []).map(x => ({ title: '📝 我的笔记', body: x }));
    body = [...user, ...seedArr].map(renderObjCard).join('');
    body += `<div id="ai_live" class="muted" style="margin-top:12px">正在加载实时快讯…</div>`;
  } else if (cur === 'aitips' || cur === 'werewolf') {
    const seedArr = (S[cur] || []).map(x => ({ title: x.title, body: x.body }));
    const user = DB.get('play_' + cur, []).map(x => ({ title: '📝 我的笔记', body: x }));
    body = [...user, ...seedArr].map(renderObjCard).join('');
  }
  setTimeout(() => { if (state.view === 'play' && state.play === 'ai') loadAiLive(); }, 30);
  return `<div class="topbar"><h1>🎮 Play 娱乐台</h1><span class="pill">抖音 · 小红书 · 正能量 · 要闻 · AI · 生活 · 兴趣</span></div>
    <div class="subtabs">${tabs.map(t => `<div class="subtab ${cur === t[0] ? 'active' : ''}" data-play="${t[0]}">${t[1]}</div>`).join('')}</div>
    <div class="card"><h2>${esc(curLabel)}</h2>
      <p class="desc">${esc(descMap[cur] || '')}</p>
      ${body || '<p class="muted">暂无内容。</p>'}
      <hr class="hr"/><h2 style="font-size:15px">＋ 添加一条</h2>
      <textarea id="play_text" placeholder="粘贴你看到的热点 / 技巧 / 新闻 / 链接…"></textarea>
      <button class="btn sm" style="margin-top:10px" data-act="addPlay" data-key="${cur}">保存</button>
    </div>`;
}function loadAiLive() {
  const box = document.getElementById('ai_live');
  if (!box) return;
  fetch('./backend/data/news_ai.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      const items = (d && d.items) || [];
      if (!items.length) { box.innerHTML = '<span class="muted">暂无实时快讯（每日自动更新）</span>'; return; }
      box.outerHTML = '<div class="live-wrap">' + items.slice(0, 12).map(it =>
        `<a class="live-item" href="${esc(it.link || '#')}" target="_blank" rel="noopener">
           <span class="live-src">${esc(it.source || 'AI快讯')}</span>
           <span class="live-title">${esc(it.title || '')}</span>
           <span class="live-date">${esc((it.pubDate || '').slice(0, 16))}</span>
         </a>`).join('') + '</div>';
    })
    .catch(() => { box.innerHTML = '<span class="muted">实时快讯加载失败（离线或尚未生成）</span>'; });
}

/* ============================================================
   4. PLAN（饮食 / 体重 / 财务 / 打卡）
   ============================================================ */
function viewPlan() {
  const inner = { diet: planDiet, weight: planWeight, finance: planFinance, overview: planOverview }[state.plan];
  const tabs = [['diet', '🍱 饮食'], ['weight', '⚖️ 体重'], ['finance', '💳 财务'], ['overview', '📈 打卡概览']];
  return `<div class="topbar"><h1>📋 Plan 计划台</h1><span class="pill">控饮食 · 减体重 · 理财务</span></div>
    <div class="subtabs">${tabs.map(t => `<div class="subtab ${state.plan === t[0] ? 'active' : ''}" data-plan="${t[0]}">${t[1]}</div>`).join('')}</div>
    ${inner()}`;
}
function planDiet() {
  const t = todayStr();
  const rec = (DB.get('diet', []).find(d => d.date === t)) || {};
  return `<div class="card">
    <h2>🍱 今日三餐 & 热量</h2><p class="desc">记录饮食，自动估算热量（可选填热量，留空则按常见值粗略估算）。</p>
    <div class="row">
      <div><label class="f">🌅 早餐</label><input id="d_break" value="${esc(rec.breakfast || '')}" placeholder="如 鸡蛋+全麦面包"></div>
      <div><label class="f">☀️ 午餐</label><input id="d_lunch" value="${esc(rec.lunch || '')}" placeholder="如 鸡胸+糙米+青菜"></div>
    </div>
    <div class="row">
      <div><label class="f">🌙 晚餐</label><input id="d_dinner" value="${esc(rec.dinner || '')}" placeholder="如 沙拉"></div>
      <div><label class="f">🍎 加餐</label><input id="d_snack" value="${esc(rec.snack || '')}" placeholder="如 苹果"></div>
    </div>
    <div class="row">
      <div><label class="f">🔥 总热量(kcal，可不填)</label><input id="d_kcal" type="number" value="${rec.kcal ?? ''}" placeholder="自动估算"></div>
      <div><label class="f">日期</label><input id="d_date" type="date" value="${t}"></div>
    </div>
    <button class="btn sm" style="margin-top:12px" data-act="saveDiet">保存今日饮食</button>
    <hr class="hr"/><h2 style="font-size:15px">📅 近期饮食</h2>
    ${dietTable()}
  </div>`;
}
function dietTable() {
  const all = DB.get('diet', []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  if (!all.length) return '<p class="muted">还没有记录。</p>';
  return `<table><thead><tr><th>日期</th><th>早餐</th><th>午餐</th><th>晚餐</th><th>加餐</th><th>热量</th></tr></thead><tbody>
    ${all.map(d => `<tr><td>${d.date}</td><td>${esc(d.breakfast)}</td><td>${esc(d.lunch)}</td><td>${esc(d.dinner)}</td><td>${esc(d.snack)}</td><td>${d.kcal ?? '—'}</td></tr>`).join('')}
  </tbody></table>`;
}
function planWeight() {
  const all = DB.get('weight', []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const t = todayStr();
  const rec = all.find(w => w.date === t) || {};
  const last = all[all.length - 1];
  return `<div class="card">
    <h2>⚖️ 体重记录</h2><p class="desc">记录每日早起 & 睡前体重，自动生成趋势图。</p>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="stat"><div class="k">最新体重</div><div class="v">${last ? (last.night || last.morning || '—') : '—'}<small> kg</small></div></div>
      <div class="stat"><div class="k">记录天数</div><div class="v">${all.length}<small> 天</small></div></div>
    </div>
    <div class="row">
      <div><label class="f">🌅 早起体重(kg)</label><input id="w_morning" type="number" step="0.1" value="${rec.morning ?? ''}"></div>
      <div><label class="f">🌙 睡前体重(kg)</label><input id="w_night" type="number" step="0.1" value="${rec.night ?? ''}"></div>
      <div><label class="f">日期</label><input id="w_date" type="date" value="${t}"></div>
    </div>
    <button class="btn sm" style="margin-top:12px" data-act="saveWeight">保存体重</button>
    <hr class="hr"/><h2 style="font-size:15px">📈 体重趋势</h2>
    ${weightChart(all)}
  </div>`;
}
function weightChart(all) {
  if (all.length < 2) return '<p class="muted">至少记录 2 天才能出趋势图。</p>';
  const W = 640, H = 240, pad = 36;
  const xs = all.map(d => d.date);
  const series = [
    { key: 'morning', color: '#a855f7', label: '早起' },
    { key: 'night', color: '#ec4899', label: '睡前' }
  ];
  const vals = all.flatMap(d => [num(d.morning), num(d.night)]).filter(v => v > 0);
  const min = Math.min(...vals) - 1, max = Math.max(...vals) + 1;
  const x = i => pad + i * (W - 2 * pad) / (all.length - 1);
  const y = v => H - pad - (v - min) / (max - min) * (H - 2 * pad);
  let paths = '';
  series.forEach(s => {
    const pts = all.map((d, i) => [x(i), y(num(d[s.key]))]).filter(p => num(all[0][s.key]) >= 0 || true);
    const line = all.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(num(d[s.key])).toFixed(1)}`).join(' ');
    const dots = all.map((d, i) => num(d[s.key]) ? `<circle cx="${x(i).toFixed(1)}" cy="${y(num(d[s.key])).toFixed(1)}" r="3" fill="${s.color}"/>` : '').join('');
    paths += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.5"/>${dots}`;
  });
  const grid = [0, .5, 1].map(f => `<line x1="${pad}" y1="${y(min + (max - min) * f)}" x2="${W - pad}" y2="${y(min + (max - min) * f)}" stroke="rgba(168,85,247,.12)"/>`).join('');
  const lbls = all.map((d, i) => (i % Math.ceil(all.length / 6) === 0) ? `<text x="${x(i)}" y="${H - 12}" font-size="9" fill="#7c6a93" text-anchor="middle">${d.date.slice(5)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
    ${grid}${paths}
    <text x="${pad}" y="14" font-size="10" fill="#7c6a93">${max.toFixed(1)}kg</text>
    <text x="${pad}" y="${H - pad + 2}" font-size="10" fill="#7c6a93">${min.toFixed(1)}kg</text>
    ${lbls}
    <g transform="translate(${W - 110},14)">
      <circle cx="0" cy="-4" r="4" fill="#a855f7"/><text x="10" y="0" font-size="10" fill="#7c6a93">早起</text>
      <circle cx="55" cy="-4" r="4" fill="#ec4899"/><text x="65" y="0" font-size="10" fill="#7c6a93">睡前</text>
    </g>
  </svg>`;
}
function planFinance() {
  const all = DB.get('finance', []);
  const t = todayStr();
  const month = t.slice(0, 7);
  const mRec = all.filter(r => r.date.slice(0, 7) === month);
  const income = mRec.filter(r => r.type === 'income').reduce((s, r) => s + num(r.amount), 0);
  const expense = mRec.filter(r => r.type === 'expense').reduce((s, r) => s + num(r.amount), 0);
  return `<div class="card">
    <h2>💳 个人财务</h2><p class="desc">记录每月收支、每日支出与各平台还款。</p>
    <div class="grid g3" style="margin-bottom:14px">
      <div class="stat"><div class="k">本月收入</div><div class="v" style="color:#16a34a">$${income.toFixed(2)}</div></div>
      <div class="stat"><div class="k">本月支出</div><div class="v" style="color:#dc2626">$${expense.toFixed(2)}</div></div>
      <div class="stat"><div class="k">结余</div><div class="v">$${(income - expense).toFixed(2)}</div></div>
    </div>
    <div class="row">
      <div><label class="f">类型</label><select id="f_type"><option value="expense">支出</option><option value="income">收入</option></select></div>
      <div><label class="f">分类</label><input id="f_cat" placeholder="餐饮/护肤/还款/工资…"></div>
    </div>
    <div class="row">
      <div><label class="f">金额($)</label><input id="f_amt" type="number" step="0.01"></div>
      <div><label class="f">平台/账户</label><input id="f_plat" placeholder="花呗/信用卡/支付宝…"></div>
      <div><label class="f">日期</label><input id="f_date" type="date" value="${t}"></div>
    </div>
    <label class="f">备注</label><input id="f_note" placeholder="如 花呗还款 500">
    <button class="btn sm" style="margin-top:10px" data-act="saveFinance">保存记录</button>
    <hr class="hr"/><h2 style="font-size:15px">📅 近期流水</h2>
    ${finTable()}
  </div>`;
}
function finTable() {
  const all = DB.get('finance', []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  if (!all.length) return '<p class="muted">还没有记录。</p>';
  return `<table><thead><tr><th>日期</th><th>类型</th><th>分类</th><th>平台</th><th>金额</th><th>备注</th></tr></thead><tbody>
    ${all.map(r => `<tr><td>${r.date}</td><td>${r.type === 'income' ? '收入' : '支出'}</td><td>${esc(r.cat)}</td><td>${esc(r.platform || '—')}</td><td style="color:${r.type === 'income' ? '#16a34a' : '#dc2626'}">${r.type === 'income' ? '+' : '-'}$${num(r.amount).toFixed(2)}</td><td>${esc(r.note || '—')}</td></tr>`).join('')}
  </tbody></table>`;
}
function planOverview() {
  const checkins = getCheckinDates();
  return `<div class="card">
    <h2>📈 打卡概览 & 热力图</h2>
    <p class="desc">凡记录饮食 / 体重 / 日记 / 财务，即视为当日打卡。坚持看得见 ✨</p>
    <div class="grid g3" style="margin-bottom:14px">
      <div class="stat"><div class="k">累计打卡</div><div class="v">${checkins.size}<small> 天</small></div></div>
      <div class="stat"><div class="k">连续打卡</div><div class="v">${streak(checkins)}<small> 天</small></div></div>
      <div class="stat"><div class="k">本月打卡</div><div class="v">${checkinsMonth(checkins)}<small> 天</small></div></div>
    </div>
    ${heatmap(checkins)}
  </div>`;
}
function getCheckinDates() {
  const set = new Set();
  const push = (arr, key) => (arr || []).forEach(d => set.add(d[key] || d.date));
  push(DB.get('diet', []), 'date');
  push(DB.get('weight', []), 'date');
  push(DB.get('journal', []), 'date');
  push(DB.get('finance', []), 'date');
  return set;
}
function streak(set) {
  let c = 0; const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { c++; d.setDate(d.getDate() - 1); }
  // 若今天还没打卡，从昨天算
  if (c === 0) { d.setDate(d.getDate() - 1); while (set.has(d.toISOString().slice(0, 10))) { c++; d.setDate(d.getDate() - 1); } }
  return c;
}
function checkinsMonth(set) { const m = new Date().toISOString().slice(0, 7); let c = 0; set.forEach(d => { if (d.slice(0, 7) === m) c++; }); return c; }
function heatmap(set) {
  const days = 364, cells = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const lvl = set.has(ds) ? Math.min(4, 1 + Math.floor(Math.random() * 4)) : 0; // 打卡日记强度随机可视化
    const cls = lvl === 0 ? '' : 'lv' + lvl;
    cells.push(`<div class="cell ${cls}" title="${ds}${set.has(ds) ? ' · 已打卡' : ''}"></div>`);
  }
  return `<div class="heat">${cells.join('')}</div>
    <div class="heat-legend">少 <span class="cell"></span><span class="cell lv1"></span><span class="cell lv2"></span><span class="cell lv3"></span><span class="cell lv4"></span> 多</div>`;
}

/* ============================================================
   5. DAILY
   ============================================================ */
function viewDaily() {
  const all = DB.get('journal', []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const t = todayStr();
  const rec = all.find(j => j.date === t) || {};
  return `<div class="topbar"><h1>📝 Daily 日记</h1><span class="pill">每日一图 · 一心情 · 一记录</span></div>
  <div class="card">
    <h2>✍️ 今日记录</h2><p class="desc">每天拍一张图 + 写点文字，留住此刻心情。</p>
    <div class="mood" id="moodpick">
      ${['😀', '😊', '😐', '😟', '😢', '😡', '🥰', '😴'].map(e => `<span class="${rec.mood === e ? 'on' : ''}" data-mood="${e}">${e}</span>`).join('')}
    </div>
    <label class="f">今日一图</label>
    <input id="j_img" type="file" accept="image/*">
    ${rec.img ? `<img src="${rec.img}" style="max-width:160px;border-radius:12px;margin-top:8px;display:block">` : ''}
    <label class="f">文字</label><textarea id="j_text" placeholder="今天发生了什么？心情如何？">${esc(rec.text || '')}</textarea>
    <button class="btn sm" style="margin-top:10px" data-act="saveJournal">保存今日日记</button>
  </div>
  <div class="card">
    <h2>📅 照片日历</h2>
    <p class="desc">点击日期查看当天日记；有图的格子会显示照片。</p>
    <div class="cal-header">
      <button class="btn ghost sm" data-act="calPrev">← 上月</button>
      <span class="cal-title">${dailyCal.year} 年 ${dailyCal.month + 1} 月</span>
      <button class="btn ghost sm" data-act="calNext">下月 →</button>
    </div>
    <div class="cal-grid">
      <div class="cal-weekday">一</div><div class="cal-weekday">二</div><div class="cal-weekday">三</div><div class="cal-weekday">四</div><div class="cal-weekday">五</div><div class="cal-weekday">六</div><div class="cal-weekday">日</div>
      ${renderCalCells(dailyCal.year, dailyCal.month, all)}
    </div>
    <div id="cal-detail"></div>
  </div>
  <div class="card">
    <h2>📔 日记墙</h2>
    <div class="journal-grid">
      ${all.map(j => `<div class="jcard">
        ${j.img ? `<img src="${j.img}">` : `<div style="height:130px;background:var(--grad-soft);display:grid;place-items:center;font-size:30px">${j.mood || '📝'}</div>`}
        <div class="jt"><div class="jd">${j.date} ${j.mood || ''}</div><div class="jm">${esc(j.text || '')}</div></div>
      </div>`).join('') || '<p class="muted">还没有日记，记下今天吧～</p>'}
    </div>
  </div>`;
}
function renderCalCells(year, month, journals) {
  const map = {};
  journals.forEach(j => map[j.date] = j);
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7; // Monday start
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const j = map[date];
    let content = '';
    if (j?.img) content = `<img src="${j.img}" loading="lazy">`;
    else if (j?.mood) content = `<span style="font-size:22px">${j.mood}</span>`;
    html += `<div class="cal-cell ${j ? 'has' : ''}" data-act="calCell" data-date="${date}"><span class="cal-num">${d}</span>${content ? `<div class="cal-content">${content}</div>` : ''}</div>`;
  }
  return html;
}

/* ============================================================
   图片压缩（存 base64，控制体积）
   ============================================================ */
function readImage(file) {
  return new Promise((res) => {
    if (!file) return res(null);
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 700, scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = img.width * scale; cv.height = img.height * scale;
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', 0.6));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ============================================================
   事件绑定
   ============================================================ */
function bindView() {
  // 子标签
  $$('[data-amz]').forEach(el => el.onclick = () => { state.amazon = el.dataset.amz; renderView(); });
  $$('[data-grow]').forEach(el => el.onclick = () => { state.growth = el.dataset.grow; renderView(); });
  $$('[data-play]').forEach(el => el.onclick = () => { state.play = el.dataset.play; renderView(); });
  $$('[data-plan]').forEach(el => el.onclick = () => { state.plan = el.dataset.plan; renderView(); });

  // 通用动作
  $$('[data-act]').forEach(el => el.onclick = () => handleAct(el));

  // 心情选择
  $$('#moodpick [data-mood]').forEach(el => el.onclick = () => {
    $$('#moodpick [data-mood]').forEach(s => s.classList.remove('on'));
    el.classList.add('on');
  });

  // 亚马逊自动简报拉取
  loadAmazonFeed();

  // 句段搜索
  const qs = $('#q_search');
  if (qs) qs.oninput = () => {
    const v = qs.value.trim().toLowerCase();
    const all = [...DB.get('g_quotes', []), ...window.SEED.growth.quotes];
    $('#q_list').innerHTML = all.filter(q => (q.text || q).toLowerCase().includes(v))
      .map((q, i) => `<div class="item" style="margin-bottom:8px"><div class="body">${esc(q.text || q)}</div></div>`).join('') || '<p class="muted">无匹配。</p>';
  };
}
function handleAct(el) {
  const act = el.dataset.act;
  switch (act) {
    case 'addNews': {
      const a = DB.get('amz_news', []);
      a.unshift({ date: $('#nw_date').value, tag: $('#nw_tag').value || '新闻', title: $('#nw_title').value, summary: $('#nw_sum').value });
      DB.set('amz_news', a); toast('已保存新闻'); renderView(); break;
    }
    case 'saveSales': {
      const owner = el.dataset.owner, date = todayStr();
      const arr = DB.get('amz_sales', []).filter(r => !(r.date === date && r.owner === owner));
      arr.push({ date, owner, qty: num($('#sq_' + owner).value), amount: num($('#sa_' + owner).value) });
      DB.set('amz_sales', arr); toast(owner + ' 已保存'); renderView(); break;
    }
    case 'addMarket': {
      const a = DB.get('amz_market_notes', []); a.unshift({ date: todayStr(), text: $('#mk_text').value }); DB.set('amz_market_notes', a); toast('已保存'); renderView(); break;
    }
    case 'delMarket': { const a = DB.get('amz_market_notes', []); a.splice(el.dataset.i, 1); DB.set('amz_market_notes', a); renderView(); break; }
    case 'addGrowth': {
      const a = DB.get('g_' + el.dataset.key, []); a.unshift({ tag: $('#g_tag').value || '技巧', title: $('#g_title').value, body: $('#g_body').value }); DB.set('g_' + el.dataset.key, a); toast('已添加'); renderView(); break;
    }
    case 'addMusic': {
      const a = DB.get('g_music', []); a.unshift({ song: $('#m_song').value, artist: $('#m_artist').value, lyric: $('#m_lyric').value, comments: $('#m_comments').value.split('\n').filter(Boolean) }); DB.set('g_music', a); toast('已添加'); renderView(); break;
    }
    case 'addBook': {
      const a = DB.get('g_books', []); a.unshift({ title: $('#b_title').value, author: $('#b_author').value || '佚名', note: $('#b_note').value }); DB.set('g_books', a); toast('已记录'); renderView(); break;
    }
    case 'addFilm': {
      const a = DB.get('g_film', []); a.unshift({ title: $('#f_title').value, note: $('#f_note').value }); DB.set('g_film', a); toast('已记录'); renderView(); break;
    }
    case 'addQuote': {
      const a = DB.get('g_quotes', []); a.unshift({ text: $('#q_text').value }); DB.set('g_quotes', a); toast('已收藏'); renderView(); break;
    }
    case 'delQuote': { const a = DB.get('g_quotes', []); a.splice(el.dataset.i, 1); DB.set('g_quotes', a); renderView(); break; }
    case 'chatSend': {
      const topic = el.dataset.topic, box = $('#chat_' + topic), inp = $('#chat_in_' + topic);
      const txt = inp.value.trim(); if (!txt) return;
      const hist = DB.get('chat_' + topic, []);
      hist.push({ role: 'user', text: txt }); hist.push({ role: 'ai', text: aiReply(txt) });
      DB.set('chat_' + topic, hist);
      box.innerHTML += `<div class="msg user">${esc(txt)}</div><div class="msg ai">${esc(hist[hist.length - 1].text)}</div>`;
      inp.value = ''; box.scrollTop = box.scrollHeight; break;
    }
    case 'addPlay': {
      const a = DB.get('play_' + el.dataset.key, []); a.unshift($('#play_text').value); DB.set('play_' + el.dataset.key, a); toast('已添加'); renderView(); break;
    }
    case 'saveDiet': {
      const date = $('#d_date').value || todayStr();
      const arr = DB.get('diet', []).filter(d => d.date !== date);
      let kcal = num($('#d_kcal').value);
      if (!kcal) kcal = estimateKcal($('#d_break').value, $('#d_lunch').value, $('#d_dinner').value, $('#d_snack').value);
      arr.push({ date, breakfast: $('#d_break').value, lunch: $('#d_lunch').value, dinner: $('#d_dinner').value, snack: $('#d_snack').value, kcal });
      DB.set('diet', arr); toast('饮食已保存'); renderView(); break;
    }
    case 'saveWeight': {
      const date = $('#w_date').value || todayStr();
      const arr = DB.get('weight', []).filter(d => d.date !== date);
      arr.push({ date, morning: num($('#w_morning').value), night: num($('#w_night').value) });
      DB.set('weight', arr); toast('体重已保存'); renderView(); break;
    }
    case 'saveFinance': {
      const arr = DB.get('finance', []);
      arr.push({ date: $('#f_date').value || todayStr(), type: $('#f_type').value, cat: $('#f_cat').value, amount: num($('#f_amt').value), platform: $('#f_plat').value, note: $('#f_note').value });
      DB.set('finance', arr); toast('财务已记录'); renderView(); break;
    }
    case 'saveJournal': {
      const date = todayStr();
      const mood = ($('#moodpick .on') || {}).dataset?.mood || '';
      const file = $('#j_img').files[0];
      const finish = (img) => {
        const arr = DB.get('journal', []).filter(d => d.date !== date);
        arr.push({ date, mood, text: $('#j_text').value, img });
        DB.set('journal', arr); toast('日记已保存 💜'); renderView();
      };
      if (file) readImage(file).then(finish); else finish(recImg(date));
      break;
    }
    case 'calPrev': { dailyCal.month--; if (dailyCal.month < 0) { dailyCal.month = 11; dailyCal.year--; } renderView(); break; }
    case 'calNext': { dailyCal.month++; if (dailyCal.month > 11) { dailyCal.month = 0; dailyCal.year++; } renderView(); break; }
    case 'calCell': {
      const date = el.dataset.date;
      const j = DB.get('journal', []).find(x => x.date === date);
      const box = $('#cal-detail');
      if (!box) return;
      if (!j) { box.innerHTML = '<p class="muted" style="margin-top:10px">这一天还没有日记。</p>'; break; }
      box.innerHTML = `<div class="item" style="margin-top:10px">
        <div class="head"><span class="title">${j.date}</span><span class="meta">${j.mood || ''}</span></div>
        ${j.img ? `<img src="${j.img}" style="max-width:140px;border-radius:10px;margin-top:6px">` : ''}
        <div class="body">${esc(j.text || '')}</div>
      </div>`;
      break;
    }
  }
}
function recImg(date) { const j = DB.get('journal', []).find(x => x.date === date); return j ? j.img : null; }
function estimateKcal(a, b, c, d) {
  const cnt = [a, b, c, d].filter(Boolean).length;
  return cnt * 380; // 粗略：每餐约 380kcal
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  renderNav();
  renderView();
  // PWA 注册
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  // 顶部安装提示
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#install-pill').classList.remove('hidden'); });
  const ip = $('#install-pill');
  if (ip) ip.onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; ip.classList.add('hidden'); } else toast('用手机浏览器打开后点 ⋮ > 添加到主屏幕'); };
  // 导航点击
  document.body.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) go(nav.dataset.nav);
  });
}
document.addEventListener('DOMContentLoaded', init);
