/* ==========================================================================
   FINKAIF OS (v8.0)
   Velvet Slate, Cashmere Jade & Warm Amber
   Ergonomic, Human-Friendly & High-End Personal Finance Architecture
   ========================================================================== */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Application State
let me = null;
let tab = 'home';
let mode = 'login';
let period = '7d';
let txFilter = 'all';
let txSearch = '';
let modalType = 'expense';

let data = {
  transactions: [],
  budgets: [],
  goals: [],
  chat: []
};

/* ==========================================================================
   API CLIENT
   ========================================================================== */
const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem('finkaif_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch('/api/' + endpoint, {
    ...options,
    headers,
    credentials: 'include'
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Ошибка сетевого соединения');
  }
  return json;
};

/* ==========================================================================
   HELPERS & FORMATTERS
   ========================================================================== */
const money = n => {
  const num = Math.round(Number(n) || 0);
  return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
};

const esc = s =>
  String(s || '').replace(/[&<>"']/g, x => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[x]));

const formatMarkdown = s => {
  if (!s) return '';
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 4px;">$1</code>')
    .replace(/\n/g, '<br>');
};

// Friendly Category Icons Map
const categoryIcons = {
  'Продукты': '🛒',
  'Рестораны': '🍽️',
  'Кафе': '☕',
  'Транспорт': '🚗',
  'Такси': '🚕',
  'Зарплата': '💰',
  'Дивиденды': '📈',
  'Инвестиции': '💎',
  'Подписки': '📱',
  'Здоровье': '🏥',
  'Спорт': '🏃',
  'Покупки': '🛍️',
  'Жилье': '🏠',
  'ЖКХ': '⚡',
  'Путешествия': '✈️',
  'Образование': '📚',
  'Развлечения': '🎉',
  'Подарки': '🎁',
  'Авто': '🚘'
};

const getCategoryIcon = cat => categoryIcons[cat] || '💳';

/* ==========================================================================
   MINIMAL SVG ICONS
   ========================================================================== */
function icon(name, size = 16) {
  const icons = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect>',
    transactions: '<line x1="7" y1="4" x2="7" y2="20"></line><polyline points="3 8 7 4 11 8"></polyline><line x1="17" y1="20" x2="17" y2="4"></line><polyline points="13 16 17 20 21 16"></polyline>',
    budgets: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="10" y1="7" x2="16" y2="7"></line><line x1="10" y1="11" x2="14" y2="11"></line>',
    goals: '<circle cx="12" cy="12" r="9"></circle><path d="m12 7 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"></path>',
    assistant: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"></line>',
    trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    trendUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
    trendDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>',
    search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    send: '<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>',
    close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    sparkle: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
  };

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
}

/* ==========================================================================
   AMBIENT BACKGROUND: SOOTHING FLUID AURORA (NO NOISE, NO CODE PARTICLES)
   ========================================================================== */
function initAmbientCanvas() {
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  let t = 0;
  let animId = null;

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Warm deep slate base
    ctx.fillStyle = '#0B0F15';
    ctx.fillRect(0, 0, w, h);

    // Orb 1: Soft Jade Glow (drifting smoothly in upper-right)
    const x1 = w * 0.7 + Math.sin(t * 0.0008) * (w * 0.15);
    const y1 = h * 0.25 + Math.cos(t * 0.0006) * (h * 0.1);
    const r1 = Math.min(w, h) * 0.65;
    const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
    g1.addColorStop(0, 'rgba(45, 212, 191, 0.09)');
    g1.addColorStop(0.5, 'rgba(13, 148, 136, 0.04)');
    g1.addColorStop(1, 'rgba(11, 15, 21, 0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, Math.PI * 2);
    ctx.fill();

    // Orb 2: Deep Midnight Navy Glow (drifting in lower-left)
    const x2 = w * 0.25 + Math.cos(t * 0.0007) * (w * 0.1);
    const y2 = h * 0.7 + Math.sin(t * 0.0009) * (h * 0.12);
    const r2 = Math.min(w, h) * 0.7;
    const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
    g2.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
    g2.addColorStop(0.6, 'rgba(30, 41, 59, 0.02)');
    g2.addColorStop(1, 'rgba(11, 15, 21, 0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x2, y2, r2, 0, Math.PI * 2);
    ctx.fill();

    // Orb 3: Subtle Warm Amber Tint (center)
    const x3 = w * 0.5 + Math.sin(t * 0.0005) * 60;
    const y3 = h * 0.45 + Math.cos(t * 0.0005) * 40;
    const r3 = Math.min(w, h) * 0.4;
    const g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
    g3.addColorStop(0, 'rgba(251, 191, 36, 0.03)');
    g3.addColorStop(1, 'rgba(11, 15, 21, 0)');
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.arc(x3, y3, r3, 0, Math.PI * 2);
    ctx.fill();

    t += 16;
    animId = requestAnimationFrame(draw);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animId) cancelAnimationFrame(animId);
    } else {
      animId = requestAnimationFrame(draw);
    }
  });

  draw();
}

/* ==========================================================================
   NAVIGATION / MASTHEAD
   ========================================================================== */
function renderMasthead() {
  const inc = data.transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const exp = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = inc - exp;

  const userName = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';

  return `
    <header class="masthead">
      <div class="brand" data-tab="home">
        <div class="brand-icon">
          ${icon('sparkle', 18)}
        </div>
        <div style="display: flex; align-items: center;">
          <span class="brand-name">FinKaif</span>
          <span class="brand-badge">8.0</span>
        </div>
      </div>

      <nav class="nav-controller" role="tablist">
        <button class="nav-item ${tab === 'home' ? 'active' : ''}" data-tab="home">
          ${icon('overview', 15)}
          <span>Обзор</span>
        </button>
        <button class="nav-item ${tab === 'transactions' ? 'active' : ''}" data-tab="transactions">
          ${icon('transactions', 15)}
          <span>Операции</span>
        </button>
        <button class="nav-item ${tab === 'budgets' ? 'active' : ''}" data-tab="budgets">
          ${icon('budgets', 15)}
          <span>Бюджеты</span>
        </button>
        <button class="nav-item ${tab === 'goals' ? 'active' : ''}" data-tab="goals">
          ${icon('goals', 15)}
          <span>Цели</span>
        </button>
        <button class="nav-item ${tab === 'assistant' ? 'active' : ''}" data-tab="assistant">
          ${icon('assistant', 15)}
          <span>Ассистент</span>
        </button>
      </nav>

      <div class="masthead-actions">
        <div class="balance-pill num">
          <span class="pulse-dot"></span>
          <span>${money(balance)}</span>
        </div>

        <button class="btn-primary" id="btn-quick-new">
          ${icon('plus', 14)}
          <span>Записать</span>
        </button>

        <div class="user-btn" id="user-menu-btn" title="Выйти из аккаунта">
          <div class="user-avatar">${userName.charAt(0).toUpperCase()}</div>
          <span>${esc(userName)}</span>
          <span style="color: var(--text-muted); font-size: 11px;">✕</span>
        </div>
      </div>
    </header>
  `;
}

/* ==========================================================================
   VIEW 1: OVERVIEW (HOME)
   CRITICAL RULE: "Добрый день" IS STRICTLY ALLOWED ONLY HERE!
   Clean, ergonomic balance card, income/expense stats, smooth trend chart.
   ZERO "аудит" and ZERO "срез 50/30/20".
   ========================================================================== */
function renderHomeView() {
  const userName = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';

  const inc = data.transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const exp = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = inc - exp;

  const savingsRate = inc > 0 ? Math.max(0, Math.round(((inc - exp) / inc) * 100)) : 0;

  // Build daily timeline points for smooth chart
  const numDays = period === '7d' ? 7 : period === '30d' ? 30 : 14;
  const now = new Date();
  const dayPoints = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const dayExp = data.transactions
      .filter(t => t.type === 'expense' && t.occurred_on === iso)
      .reduce((s, t) => s + Number(t.amount), 0);
    const dayInc = data.transactions
      .filter(t => t.type === 'income' && t.occurred_on === iso)
      .reduce((s, t) => s + Number(t.amount), 0);

    dayPoints.push({
      date: iso,
      dayNum: d.getDate(),
      dayLabel: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
      exp: dayExp,
      inc: dayInc
    });
  }

  const maxVal = Math.max(1000, ...dayPoints.map(p => Math.max(p.exp, p.inc)));
  const svgW = 760;
  const svgH = 110;

  const points = dayPoints.map((p, idx) => {
    const x = Math.round((idx / (dayPoints.length - 1 || 1)) * (svgW - 40) + 20);
    const y = Math.round(svgH - 20 - (p.exp / maxVal) * (svgH - 40));
    return { x, y, ...p };
  });

  const curvePath = points.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x},${pt.y}`;
    const prev = arr[idx - 1];
    const c1x = prev.x + (pt.x - prev.x) / 2;
    const c1y = prev.y;
    const c2x = prev.x + (pt.x - prev.x) / 2;
    const c2y = pt.y;
    return `${acc} C ${c1x},${c1y} ${c2x},${c2y} ${pt.x},${pt.y}`;
  }, '');

  const areaPath = `${curvePath} L ${points[points.length - 1].x},${svgH} L ${points[0].x},${svgH} Z`;

  const recentTransactions = [...data.transactions].slice(0, 6);

  return `
    <div class="view-header">
      <div>
        <div class="view-greeting">Добрый день, ${esc(userName)}</div>
        <h1 class="view-title">Финансовый баланс</h1>
        <p class="view-subtitle">Сводный обзор капитала, ежедневные потоки и операционные записи.</p>
      </div>
    </div>

    <!-- Main Capital Hero Card -->
    <div class="hero-balance-card">
      <div class="hero-topline">
        <span class="hero-label">Чистый свободный остаток</span>
        <div class="period-tabs">
          <button class="period-tab ${period === '7d' ? 'active' : ''}" data-period="7d">7 дней</button>
          <button class="period-tab ${period === '30d' ? 'active' : ''}" data-period="30d">30 дней</button>
          <button class="period-tab ${period === 'year' ? 'active' : ''}" data-period="year">Год</button>
        </div>
      </div>

      <div class="hero-balance-row">
        <div class="hero-balance-figure num">${money(balance)}</div>
        <div class="hero-balance-badge num">
          ${icon('trendUp', 13)}
          <span>${savingsRate}% норма накоплений</span>
        </div>
      </div>

      <!-- Clean Cashflow Curve (No weird pins, gentle gradient) -->
      <div class="hero-chart-container">
        <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#2DD4BF" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#chartGrad)" />
          <path d="${curvePath}" fill="none" stroke="#2DD4BF" stroke-width="2.5" stroke-linecap="round" />
          ${points.map(pt => `
            <circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#141A23" stroke="#2DD4BF" stroke-width="2"/>
          `).join('')}
        </svg>
      </div>
    </div>

    <!-- Stats Row (2 Cards) -->
    <div class="stats-strip">
      <div class="stat-card">
        <div class="stat-card-head">
          <span class="stat-card-title">Поступления за период</span>
          <div class="stat-icon inc">${icon('trendUp', 16)}</div>
        </div>
        <div class="stat-amount inc num">+${money(inc)}</div>
        <div class="stat-footnote">Все зафиксированные доходы</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-head">
          <span class="stat-card-title">Расходы за период</span>
          <div class="stat-icon exp">${icon('trendDown', 16)}</div>
        </div>
        <div class="stat-amount exp num">−${money(exp)}</div>
        <div class="stat-footnote">Списания по всем категориям</div>
      </div>
    </div>

    <!-- Ergonomic Quick Actions -->
    <div class="quick-actions-bar">
      <button class="quick-action-btn primary" id="quick-add-expense">
        ${icon('minus', 14)}
        <span>Записать расход</span>
      </button>
      <button class="quick-action-btn" id="quick-add-income">
        ${icon('plus', 14)}
        <span>Внести доход</span>
      </button>
      <button class="quick-action-btn" data-tab="goals">
        ${icon('goals', 14)}
        <span>Финансовые цели</span>
      </button>
      <button class="quick-action-btn" data-tab="assistant">
        ${icon('assistant', 14)}
        <span>Спросить ассистента</span>
      </button>
    </div>

    <!-- Recent Transactions Stream -->
    <div class="section-head">
      <h2 class="section-title">Последние операции</h2>
      <a class="section-link" data-tab="transactions">
        <span>Смотреть все (${data.transactions.length})</span>
        <span>→</span>
      </a>
    </div>

    <div class="tx-list">
      ${recentTransactions.length > 0 ? recentTransactions.map(t => renderTxCard(t)).join('') : `
        <div style="text-align: center; padding: 40px 20px; background: var(--bg-surface); border: 1px dashed var(--border-medium); border-radius: var(--r-lg);">
          <p style="color: var(--text-secondary); margin-bottom: 12px;">Пока нет зафиксированных операций.</p>
          <button class="btn-primary" id="btn-first-op">${icon('plus', 13)} Добавить первую операцию</button>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   VIEW 2: TRANSACTIONS (OPERATIONAL LEDGER)
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderTransactionsView() {
  const filtered = data.transactions.filter(t => {
    if (txFilter !== 'all' && t.type !== txFilter) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (t.category || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const groups = {};
  filtered.forEach(t => {
    const d = t.occurred_on || 'Не указана';
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">История операций</h1>
        <p class="view-subtitle">Полный журнал поступлений и списаний средств с быстрым поиском.</p>
      </div>
      <button class="btn-primary" id="btn-add-tx-view">
        ${icon('plus', 14)}
        <span>Новая операция</span>
      </button>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="filter-tab ${txFilter === 'all' ? 'active' : ''}" data-tx-filter="all">Все (${data.transactions.length})</button>
        <button class="filter-tab ${txFilter === 'expense' ? 'active' : ''}" data-tx-filter="expense">Расходы</button>
        <button class="filter-tab ${txFilter === 'income' ? 'active' : ''}" data-tx-filter="income">Доходы</button>
      </div>

      <div class="search-box">
        ${icon('search', 14)}
        <input id="tx-search-input" placeholder="Поиск по названию или статье..." value="${esc(txSearch)}">
      </div>
    </div>

    <div>
      ${sortedDates.length > 0 ? sortedDates.map(date => {
        const dayTotal = groups[date].reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
        return `
          <div>
            <div class="date-group-header">
              <span>${formatFriendlyDate(date)}</span>
              <span class="num ${dayTotal >= 0 ? 'pos' : 'neg'}" style="color: ${dayTotal >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)'}">
                ${dayTotal >= 0 ? '+' : '−'}${money(Math.abs(dayTotal))}
              </span>
            </div>
            <div class="tx-list">
              ${groups[date].map(t => renderTxCard(t)).join('')}
            </div>
          </div>
        `;
      }).join('') : `
        <div style="text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px dashed var(--border-medium); border-radius: var(--r-lg);">
          <p style="color: var(--text-secondary);">По данному запросу операций не найдено.</p>
        </div>
      `}
    </div>
  `;
}

function formatFriendlyDate(dateStr) {
  if (!dateStr || dateStr === 'Не указана') return 'Без даты';
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yest) return 'Вчера';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderTxCard(t) {
  const isInc = t.type === 'income';
  const catIcon = getCategoryIcon(t.category);

  return `
    <div class="tx-card" data-id="${t.id}">
      <div class="tx-left">
        <div class="category-icon">${catIcon}</div>
        <div class="tx-info">
          <div class="tx-title">${esc(t.description || t.category)}</div>
          <div class="tx-meta">
            <span>${esc(t.category)}</span>
            <span>•</span>
            <span>${t.occurred_on || ''}</span>
          </div>
        </div>
      </div>

      <div class="tx-right">
        <div class="tx-amount ${isInc ? 'pos' : 'neg'} num">
          ${isInc ? '+' : '−'}${money(t.amount)}
        </div>
        <button class="btn-icon delete-tx-btn" data-id="${t.id}" title="Удалить запись">
          ${icon('trash', 14)}
        </button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   VIEW 3: BUDGETS & LIMITS
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderBudgetsView() {
  const expenseByCat = {};
  data.transactions.filter(t => t.type === 'expense').forEach(t => {
    expenseByCat[t.category] = (expenseByCat[t.category] || 0) + Number(t.amount);
  });

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Лимиты и бюджеты</h1>
        <p class="view-subtitle">Контроль расходов по статьям и управление финансовой дисциплиной.</p>
      </div>
      <button class="btn-primary" id="btn-new-budget">
        ${icon('plus', 14)}
        <span>Установить лимит</span>
      </button>
    </div>

    <div class="budget-grid">
      ${data.budgets.length > 0 ? data.budgets.map(b => {
        const spent = expenseByCat[b.category] || 0;
        const limit = Number(b.limit_amount) || 1;
        const pct = Math.min(100, Math.round((spent / limit) * 100));
        const remain = limit - spent;

        let statusClass = 'normal';
        let statusText = `В норме · ${pct}%`;
        let barColor = 'var(--accent-emerald)';

        if (pct >= 90) {
          statusClass = 'danger';
          statusText = `Превышение · ${pct}%`;
          barColor = 'var(--accent-coral)';
        } else if (pct >= 70) {
          statusClass = 'warning';
          statusText = `Внимание · ${pct}%`;
          barColor = 'var(--accent-amber)';
        }

        return `
          <div class="budget-card" data-id="${b.id}">
            <div class="budget-head">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${getCategoryIcon(b.category)}</span>
                <span class="budget-category">${esc(b.category)}</span>
              </div>
              <span class="budget-badge ${statusClass}">${statusText}</span>
            </div>

            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%; background: ${barColor};"></div>
            </div>

            <div class="budget-meta-row num">
              <div>
                <span style="font-size: 11px; color: var(--text-muted); display: block;">ИЗРАСХОДОВАНО</span>
                <strong style="color: #FFFFFF; font-size: 15px;">${money(spent)}</strong>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">МЕСЯЧНЫЙ ЛИМИТ</span>
                <strong style="color: var(--text-secondary); font-size: 15px;">${money(limit)}</strong>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--border-subtle); font-size: 12px;">
              <span style="color: var(--text-secondary);">
                ${remain >= 0 ? `Осталось: <b class="num" style="color: #FFFFFF;">${money(remain)}</b>` : `Перерасход: <b class="num" style="color: var(--accent-coral);">${money(Math.abs(remain))}</b>`}
              </span>
              <button class="btn-icon delete-budget-btn" data-id="${b.id}" title="Удалить лимит">
                ${icon('trash', 13)}
              </button>
            </div>
          </div>
        `;
      }).join('') : `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px dashed var(--border-medium); border-radius: var(--r-lg);">
          <p style="color: var(--text-secondary); margin-bottom: 12px;">У вас пока нет установленных лимитов.</p>
          <button class="btn-primary" id="btn-new-budget-empty">${icon('plus', 13)} Создать лимит</button>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   VIEW 4: GOALS & WEALTH
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderGoalsView() {
  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Финансовые цели</h1>
        <p class="view-subtitle">Накопления, резервные фонды и инвестиционные рубежи с быстрым пополнением.</p>
      </div>
      <button class="btn-primary" id="btn-new-goal">
        ${icon('plus', 14)}
        <span>Создать цель</span>
      </button>
    </div>

    <div class="goals-grid">
      ${data.goals.length > 0 ? data.goals.map(g => {
        const saved = Number(g.saved_amount) || 0;
        const target = Number(g.target_amount) || 1;
        const pct = Math.min(100, Math.round((saved / target) * 100));
        const remain = Math.max(0, target - saved);

        return `
          <div class="goal-card" data-id="${g.id}">
            <div class="goal-head">
              <span class="goal-title">${esc(g.name)}</span>
              <span class="goal-percent num">${pct}%</span>
            </div>

            <div class="progress-track" style="height: 7px;">
              <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, var(--accent-amber), var(--accent-jade));"></div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div>
                <span style="font-size: 11px; color: var(--text-muted); display: block;">НАКОПЛЕНО</span>
                <strong class="num" style="font-size: 18px; color: #FFFFFF;">${money(saved)}</strong>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">ЦЕЛЬ</span>
                <strong class="num" style="font-size: 15px; color: var(--text-secondary);">${money(target)}</strong>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
              <span style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 6px;">Быстрое пополнение:</span>
              <div class="goal-deposit-bar">
                <button class="deposit-chip" data-goal-id="${g.id}" data-add="5000">+5 000 ₽</button>
                <button class="deposit-chip" data-goal-id="${g.id}" data-add="15000">+15 000 ₽</button>
                <button class="deposit-chip" data-goal-id="${g.id}" data-add="50000">+50 000 ₽</button>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary); padding-top: 4px;">
              <span>Осталось: <b class="num" style="color: #FFFFFF;">${money(remain)}</b></span>
              <button class="btn-icon delete-goal-btn" data-id="${g.id}" title="Удалить цель">
                ${icon('trash', 13)}
              </button>
            </div>
          </div>
        `;
      }).join('') : `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px dashed var(--border-medium); border-radius: var(--r-lg);">
          <p style="color: var(--text-secondary); margin-bottom: 12px;">У вас пока нет активных целей.</p>
          <button class="btn-primary" id="btn-new-goal-empty">${icon('plus', 13)} Добавить цель</button>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   VIEW 5: AI ASSISTANT (HELPFUL FINANCIAL MENTOR)
   CRITICAL RULE: NO "Добрый день" here!
   Human-friendly, conversational, zero fake audit jargon.
   ========================================================================== */
function renderAssistantView() {
  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Финансовый ассистент</h1>
        <p class="view-subtitle">Персональные финансовые советы, аналитика расходов и умные подсказки.</p>
      </div>
    </div>

    <div class="assistant-layout">
      <!-- Quick Prompts Sidebar -->
      <div class="assistant-sidebar">
        <div class="assistant-sidebar-title">ПОПУЛЯРНЫЕ ВОПРОСЫ</div>

        <button class="suggestion-chip" data-prompt="В каких категориях я трачу больше всего средств и как их сократить?">
          <span class="suggestion-tag">Анализ трат</span>
          <span>Где у меня наибольшие расходы?</span>
        </button>

        <button class="suggestion-chip" data-prompt="Сколько мне нужно откладывать ежемесячно, чтобы быстрее закрыть финансовые цели?">
          <span class="suggestion-tag">Накопления</span>
          <span>План достижения целей</span>
        </button>

        <button class="suggestion-chip" data-prompt="Посчитай мой средний дневной бюджет исходя из текущего свободного остатка">
          <span class="suggestion-tag">Дисциплина</span>
          <span>Безопасный расход в день</span>
        </button>

        <button class="suggestion-chip" data-prompt="Посоветуй, как сформировать надежную подушку безопасности">
          <span class="suggestion-tag">Безопасность</span>
          <span>Как создать резервный фонд?</span>
        </button>
      </div>

      <!-- Dialogue Panel -->
      <div class="assistant-chat-panel">
        <div class="chat-stream" id="chat-stream-box">
          ${data.chat.length > 0 ? data.chat.map(m => `
            <div class="chat-bubble ${m.role}">
              ${m.role === 'assistant' ? `
                <div class="chat-author">
                  ${icon('assistant', 13)}
                  <span>FinKaif Помощник</span>
                </div>
              ` : ''}
              <div>${formatMarkdown(m.content)}</div>
            </div>
          `).join('') : `
            <div style="text-align: center; margin: auto; max-width: 400px; color: var(--text-secondary);">
              <div style="width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 50%; background: var(--accent-jade-glow); display: flex; align-items: center; justify-content: center; color: var(--accent-jade);">
                ${icon('assistant', 24)}
              </div>
              <h3 style="color: #FFFFFF; font-size: 16px; margin-bottom: 6px;">Чем я могу помочь?</h3>
              <p style="font-size: 13px; line-height: 1.5;">Спросите об анализе ваших трат, оптимизации бюджета или выберите подсказку слева.</p>
            </div>
          `}
        </div>

        <form class="chat-input-bar" id="assistant-form">
          <input id="assistant-input" placeholder="Задайте вопрос о доходах, расходах, целях..." required autocomplete="off">
          <button type="submit" class="chat-send-btn" title="Отправить">
            ${icon('send', 14)}
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   MODAL WINDOW (NEW TRANSACTION)
   ========================================================================== */
function renderModal() {
  return `
    <div id="tx-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Новая операция</h3>
          <button class="btn-icon" id="btn-close-modal">${icon('close', 16)}</button>
        </div>

        <!-- Category Chips -->
        <div class="cat-chips-row">
          <span class="cat-chip selected" data-cat="Продукты" data-type="expense">🛒 Продукты</span>
          <span class="cat-chip" data-cat="Рестораны" data-type="expense">🍽️ Рестораны</span>
          <span class="cat-chip" data-cat="Транспорт" data-type="expense">🚗 Транспорт</span>
          <span class="cat-chip" data-cat="Подписки" data-type="expense">📱 Подписки</span>
          <span class="cat-chip" data-cat="Здоровье" data-type="expense">🏥 Здоровье</span>
          <span class="cat-chip" data-cat="Зарплата" data-type="income">💰 Зарплата</span>
          <span class="cat-chip" data-cat="Дивиденды" data-type="income">📈 Дивиденды</span>
        </div>

        <form id="tx-modal-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Тип</label>
              <select class="form-select" id="form-type">
                <option value="expense">Расход (−)</option>
                <option value="income">Поступление (+)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Категория</label>
              <input class="form-input" id="form-category" value="Продукты" placeholder="Напр. Кафе" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Сумма (₽)</label>
              <input class="form-input num" id="form-amount" type="number" min="1" step="any" placeholder="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input class="form-input" id="form-date" type="date" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Описание</label>
            <input class="form-input" id="form-desc" placeholder="Например: Супермаркет, заказ...">
          </div>

          <button type="submit" class="btn-submit">
            Сохранить операцию
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   AUTH SCREEN
   ========================================================================== */
function renderAuthScreen() {
  return `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 44px; height: 44px; margin: 0 auto 12px; border-radius: 12px; background: linear-gradient(135deg, var(--accent-jade) 0%, #0D9488 100%); display: flex; align-items: center; justify-content: center; color: #042F2E;">
            ${icon('sparkle', 22)}
          </div>
          <h2 style="font-size: 22px; font-weight: 800; color: #FFFFFF;">FinKaif OS</h2>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Управление личными финансами с комфортом</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" id="tab-auth-login">Вход</button>
          <button class="auth-tab ${mode === 'register' ? 'active' : ''}" id="tab-auth-reg">Регистрация</button>
        </div>

        <form id="auth-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="auth-email" type="email" placeholder="investor@finkaif.ru" required>
          </div>

          <div class="form-group">
            <label class="form-label">Пароль</label>
            <input class="form-input" id="auth-password" type="password" placeholder="Минимум 6 символов" minlength="6" required>
          </div>

          <button type="submit" class="btn-submit" id="auth-submit-btn">
            ${mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   MAIN RENDER ORCHESTRATION
   ========================================================================== */
function renderApp() {
  const container = document.getElementById('app');
  if (!container) return;

  if (!me) {
    container.innerHTML = renderAuthScreen();
    bindAuthEvents();
    return;
  }

  let viewHtml = '';
  if (tab === 'home') viewHtml = renderHomeView();
  else if (tab === 'transactions') viewHtml = renderTransactionsView();
  else if (tab === 'budgets') viewHtml = renderBudgetsView();
  else if (tab === 'goals') viewHtml = renderGoalsView();
  else if (tab === 'assistant') viewHtml = renderAssistantView();

  container.innerHTML = `
    <div class="app-container">
      ${renderMasthead()}
      <main>
        ${viewHtml}
      </main>
      ${renderModal()}
    </div>
  `;

  bindInteractiveEvents();
}

/* ==========================================================================
   INTERACTIVE EVENTS & EVENT BINDINGS
   ========================================================================== */
function bindAuthEvents() {
  const form = document.getElementById('auth-form');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-reg');

  if (tabLogin) tabLogin.onclick = () => { mode = 'login'; renderApp(); };
  if (tabReg) tabReg.onclick = () => { mode = 'register'; renderApp(); };

  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const email = $('#auth-email').value.trim();
      const password = $('#auth-password').value;
      const submitBtn = $('#auth-submit-btn');

      try {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Проверка...';

        const res = await api(`auth/${mode}`, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        if (res.token) {
          localStorage.setItem('finkaif_token', res.token);
        }
        me = res.user;
        await refreshAllData();
        renderApp();
      } catch (err) {
        alert(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
      }
    };
  }
}

function bindInteractiveEvents() {
  // Tab navigation
  $$('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      tab = btn.getAttribute('data-tab');
      window.location.hash = tab;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  // User menu / logout
  const userMenuBtn = document.getElementById('user-menu-btn');
  if (userMenuBtn) {
    userMenuBtn.onclick = async () => {
      if (confirm('Выйти из аккаунта?')) {
        await api('auth/logout', { method: 'POST' }).catch(() => {});
        localStorage.removeItem('finkaif_token');
        me = null;
        renderApp();
      }
    };
  }

  // Modal Open/Close
  const modal = document.getElementById('tx-modal');
  const openModal = (defaultType = 'expense') => {
    modalType = defaultType;
    if (modal) modal.style.display = 'flex';
    if ($('#form-type')) $('#form-type').value = defaultType;
  };
  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  const btnQuickNew = document.getElementById('btn-quick-new');
  const btnFirstOp = document.getElementById('btn-first-op');
  const btnAddTxView = document.getElementById('btn-add-tx-view');
  const quickAddExp = document.getElementById('quick-add-expense');
  const quickAddInc = document.getElementById('quick-add-income');
  const btnCloseModal = document.getElementById('btn-close-modal');

  if (btnQuickNew) btnQuickNew.onclick = () => openModal('expense');
  if (btnFirstOp) btnFirstOp.onclick = () => openModal('expense');
  if (btnAddTxView) btnAddTxView.onclick = () => openModal('expense');
  if (quickAddExp) quickAddExp.onclick = () => openModal('expense');
  if (quickAddInc) quickAddInc.onclick = () => openModal('income');
  if (btnCloseModal) btnCloseModal.onclick = closeModal;

  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) closeModal();
    };
  }

  // Quick category chips in modal
  $$('.cat-chip').forEach(chip => {
    chip.onclick = () => {
      $$('.cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      const cat = chip.getAttribute('data-cat');
      const type = chip.getAttribute('data-type');
      if ($('#form-category')) $('#form-category').value = cat;
      if ($('#form-type')) $('#form-type').value = type;
    };
  });

  // Transaction form submit
  const txForm = document.getElementById('tx-modal-form');
  if (txForm) {
    txForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const type = $('#form-type').value;
        const category = $('#form-category').value.trim();
        const amount = Number($('#form-amount').value);
        const occurred_on = $('#form-date').value;
        const description = $('#form-desc').value.trim();

        const created = await api('transactions', {
          method: 'POST',
          body: JSON.stringify({ type, category, amount, occurred_on, description })
        });

        data.transactions.unshift(created);
        closeModal();
        renderApp();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // Delete transaction
  $$('.delete-tx-btn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Удалить эту операцию?')) {
        await api(`transactions/${id}`, { method: 'DELETE' });
        data.transactions = data.transactions.filter(t => t.id !== id);
        renderApp();
      }
    };
  });

  // Period switcher on Overview
  $$('.period-tab').forEach(btn => {
    btn.onclick = () => {
      period = btn.getAttribute('data-period');
      renderApp();
    };
  });

  // Filter tabs on Transactions
  $$('.filter-tab').forEach(btn => {
    btn.onclick = () => {
      txFilter = btn.getAttribute('data-tx-filter');
      renderApp();
    };
  });

  // Instant Search
  const searchInput = document.getElementById('tx-search-input');
  if (searchInput) {
    searchInput.oninput = e => {
      txSearch = e.target.value;
      renderApp();
      const input = document.getElementById('tx-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(txSearch.length, txSearch.length);
      }
    };
  }

  // Budgets: Create & Delete
  const btnNewBudget = document.getElementById('btn-new-budget');
  const btnNewBudgetEmpty = document.getElementById('btn-new-budget-empty');
  const promptNewBudget = async () => {
    const category = prompt('Статья расходов (например: Продукты, Кафе, Транспорт):');
    if (!category) return;
    const limit_amount = prompt(`Месячный лимит для «${category}» (₽):`);
    if (!limit_amount || isNaN(Number(limit_amount))) return;

    try {
      const created = await api('budgets', {
        method: 'POST',
        body: JSON.stringify({ category, limit_amount: Number(limit_amount) })
      });
      data.budgets = data.budgets.filter(b => b.category !== category);
      data.budgets.push(created);
      renderApp();
    } catch (err) {
      alert(err.message);
    }
  };

  if (btnNewBudget) btnNewBudget.onclick = promptNewBudget;
  if (btnNewBudgetEmpty) btnNewBudgetEmpty.onclick = promptNewBudget;

  $$('.delete-budget-btn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Удалить этот лимит?')) {
        await api(`budgets/${id}`, { method: 'DELETE' });
        data.budgets = data.budgets.filter(b => b.id !== id);
        renderApp();
      }
    };
  });

  // Goals: Create, Deposit, Delete
  const btnNewGoal = document.getElementById('btn-new-goal');
  const btnNewGoalEmpty = document.getElementById('btn-new-goal-empty');
  const promptNewGoal = async () => {
    const name = prompt('Название финансовой цели (напр. Резервный фонд, Отпуск):');
    if (!name) return;
    const target_amount = prompt(`Сумма для достижения «${name}» (₽):`);
    if (!target_amount || isNaN(Number(target_amount))) return;

    try {
      const created = await api('goals', {
        method: 'POST',
        body: JSON.stringify({ name, target_amount: Number(target_amount), saved_amount: 0 })
      });
      data.goals.push(created);
      renderApp();
    } catch (err) {
      alert(err.message);
    }
  };

  if (btnNewGoal) btnNewGoal.onclick = promptNewGoal;
  if (btnNewGoalEmpty) btnNewGoalEmpty.onclick = promptNewGoal;

  $$('.deposit-chip').forEach(chip => {
    chip.onclick = async () => {
      const goalId = chip.getAttribute('data-goal-id');
      const addAmount = Number(chip.getAttribute('data-add'));
      const goal = data.goals.find(g => g.id === goalId);
      if (!goal) return;

      const newSaved = Number(goal.saved_amount) + addAmount;
      try {
        const updated = await api(`goals/${goalId}`, {
          method: 'PUT',
          body: JSON.stringify({ saved_amount: newSaved })
        });
        goal.saved_amount = updated.saved_amount;
        renderApp();
      } catch (err) {
        alert(err.message);
      }
    };
  });

  $$('.delete-goal-btn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Удалить эту цель?')) {
        await api(`goals/${id}`, { method: 'DELETE' });
        data.goals = data.goals.filter(g => g.id !== id);
        renderApp();
      }
    };
  });

  // Assistant Chat Form & Suggestions
  const assistantForm = document.getElementById('assistant-form');
  if (assistantForm) {
    assistantForm.onsubmit = async e => {
      e.preventDefault();
      const input = document.getElementById('assistant-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      data.chat.push({ role: 'user', content: text, created_at: new Date().toISOString() });
      renderApp();

      const chatBox = document.getElementById('chat-stream-box');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

      try {
        const res = await api('chat', {
          method: 'POST',
          body: JSON.stringify({ message: text })
        });
        data.chat.push({ role: 'assistant', content: res.answer || res.reply, created_at: new Date().toISOString() });
        renderApp();
        const chatBoxAfter = document.getElementById('chat-stream-box');
        if (chatBoxAfter) chatBoxAfter.scrollTop = chatBoxAfter.scrollHeight;
      } catch (err) {
        data.chat.push({ role: 'assistant', content: `⚠️ Ошибка: ${err.message}`, created_at: new Date().toISOString() });
        renderApp();
      }
    };
  }

  $$('.suggestion-chip').forEach(btn => {
    btn.onclick = () => {
      const promptText = btn.getAttribute('data-prompt');
      const input = document.getElementById('assistant-input');
      if (input) {
        input.value = promptText;
        const form = document.getElementById('assistant-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    };
  });
}

/* ==========================================================================
   INITIALIZATION & ROUTING
   ========================================================================== */
async function refreshAllData() {
  try {
    const [txs, bgs, gls, cht] = await Promise.all([
      api('transactions').catch(() => []),
      api('budgets').catch(() => []),
      api('goals').catch(() => []),
      api('chat').catch(() => [])
    ]);

    data.transactions = Array.isArray(txs) ? txs : [];
    data.budgets = Array.isArray(bgs) ? bgs : [];
    data.goals = Array.isArray(gls) ? gls : [];
    data.chat = Array.isArray(cht) ? cht : [];
  } catch (err) {
    console.warn('Sync notice:', err.message);
  }
}

function syncHash() {
  const h = window.location.hash.replace('#', '');
  if (['home', 'transactions', 'budgets', 'goals', 'assistant'].includes(h)) {
    tab = h;
    renderApp();
  }
}

async function boot() {
  initAmbientCanvas();

  const initHash = window.location.hash.replace('#', '');
  if (['home', 'transactions', 'budgets', 'goals', 'assistant'].includes(initHash)) {
    tab = initHash;
  }

  try {
    const userRes = await api('me');
    me = userRes.user;
    await refreshAllData();
  } catch {
    me = null;
  }

  renderApp();
}

window.addEventListener('hashchange', syncHash);
window.addEventListener('DOMContentLoaded', boot);
