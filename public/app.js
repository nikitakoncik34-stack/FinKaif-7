/* ==========================================================================
   FINKAIF OS (v8.1)
   Velvet Slate, Cashmere Jade & Warm Amber
   Full Analytics Engine (Donut, Cashflow Wave, Burn Rate) & Profile Customization
   ========================================================================== */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Application State
let me = null;
let tab = 'home';
let mode = 'login';
let period = '7d';
let analyticsPeriod = '30d';
let activeAnalyticsCat = null;
let hoveredAnalyticsCat = null;
let txFilter = 'all';
let txSearch = '';
let modalType = 'expense';
let profileModalOpen = false;

let profile = {
  display_name: localStorage.getItem('finkaif_name') || '',
  avatar: localStorage.getItem('finkaif_avatar') || '⚡',
  currency: localStorage.getItem('finkaif_currency') || 'RUB'
};

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
const currencySymbols = {
  'RUB': '₽',
  'USD': '$',
  'EUR': '€',
  'KZT': '₸'
};

const money = n => {
  const num = Math.round(Number(n) || 0);
  const sym = currencySymbols[profile.currency] || '₽';
  return new Intl.NumberFormat('ru-RU').format(num) + ' ' + sym;
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

// Local Date YYYY-MM-DD helper without UTC timezone distortion
const toDateIso = d => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Safe ISO Date extractor (YYYY-MM-DD) from string, Date or object
const getTxIso = t => {
  if (!t) return '';
  const val = t.occurred_on || t.date || '';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toDateIso(d);
  return s.slice(0, 10);
};

const defaultCategories = [
  'Продукты', 'Рестораны', 'Кафе', 'Транспорт', 'Такси',
  'Подписки', 'Здоровье', 'Спорт', 'Покупки', 'Жилье',
  'ЖКХ', 'Путешествия', 'Развлечения', 'Авто', 'Инвестиции'
];

const getAllCategories = () => {
  const cats = new Set(defaultCategories);
  (data.transactions || []).forEach(t => {
    if (t.category && String(t.category).trim()) {
      cats.add(String(t.category).trim());
    }
  });
  return Array.from(cats);
};

// Russian pluralization helper for categories
const pluralizeCats = n => {
  const num = Math.abs(Number(n) || 0) % 100;
  const num1 = num % 10;
  if (num > 10 && num < 20) return 'категорий';
  if (num1 > 1 && num1 < 5) return 'категории';
  if (num1 === 1) return 'категория';
  return 'категорий';
};

// Monotone Cubic Spline generator (Fritsch-Carlson) for natural, fluid financial curves
function pointsToSmoothPath(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) {
    pts.__splineSegments = [{
      x0: pts[0].x, y0: pts[0].y,
      cp1x: pts[0].x + (pts[1].x - pts[0].x) / 3, cp1y: pts[0].y + (pts[1].y - pts[0].y) / 3,
      cp2x: pts[1].x - (pts[1].x - pts[0].x) / 3, cp2y: pts[1].y - (pts[1].y - pts[0].y) / 3,
      x1: pts[1].x, y1: pts[1].y,
      bal0: pts[0].balance, bal1: pts[1].balance,
      pt0: pts[0], pt1: pts[1]
    }];
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  }

  const n = pts.length;
  const d = [];
  const dx = [];
  for (let i = 0; i < n - 1; i++) {
    const deltaX = pts[i + 1].x - pts[i].x;
    const deltaY = pts[i + 1].y - pts[i].y;
    dx.push(deltaX);
    d.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m.push(0);
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i]));
    }
  }
  m.push(d[n - 2]);

  const segments = [];
  let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const deltaX = dx[i];
    const cp1x = p1.x + deltaX / 3;
    const cp1y = p1.y + m[i] * (deltaX / 3);
    const cp2x = p2.x - deltaX / 3;
    const cp2y = p2.y - m[i + 1] * (deltaX / 3);
    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    segments.push({
      x0: p1.x,
      y0: p1.y,
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x1: p2.x,
      y1: p2.y,
      bal0: p1.balance,
      bal1: p2.balance,
      pt0: p1,
      pt1: p2
    });
  }
  pts.__splineSegments = segments;
  return path;
}

// Continuous Cubic Bezier evaluator along curve for smooth scrubbing
function evaluateBezierY(y0, cp1y, cp2y, y1, t) {
  const mt = 1 - t;
  return (mt * mt * mt * y0) + (3 * mt * mt * t * cp1y) + (3 * mt * t * t * cp2y) + (t * t * t * y1);
}

// Financial Rank Calculator
function getFinancialRank(balance, goals) {
  const totalSaved = (goals || []).reduce((s, g) => s + Number(g.saved_amount || 0), 0);
  const totalTarget = (goals || []).reduce((s, g) => s + Number(g.target_amount || 0), 0);
  const totalCapital = Math.max(0, balance) + totalSaved;

  if (totalCapital >= 300000 || (totalTarget > 0 && totalSaved >= totalTarget && goals.length >= 2)) {
    return { title: 'Финансовый стратег', badge: '👑', desc: 'Уверенный капитал и системный контроль над будущим' };
  }
  if (totalCapital >= 100000 || totalSaved >= 40000) {
    return { title: 'Капиталист', badge: '💎', desc: 'Стабильный рост сбережений и надежный инвестиционный резерв' };
  }
  if (totalCapital >= 25000 || (goals && goals.length > 0)) {
    return { title: 'Мастер бюджета', badge: '⚡', desc: 'Осознанные расходы и дисциплина лимитов' };
  }
  return { title: 'Первые шаги', badge: '🌱', desc: 'Начало построения финансовой свободы и подушки безопасности' };
}

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
    analytics: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
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
    sparkle: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    wallet: '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"></path>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>'
  };

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
}

/* ==========================================================================
   AMBIENT BACKGROUND: SOOTHING FLUID AURORA
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
    t += 0.003;
    ctx.clearRect(0, 0, w, h);

    const x1 = w * 0.25 + Math.sin(t) * 90;
    const y1 = h * 0.35 + Math.cos(t * 0.8) * 80;
    const g1 = ctx.createRadialGradient(x1, y1, 10, x1, y1, Math.max(w, h) * 0.6);
    g1.addColorStop(0, 'rgba(45, 212, 191, 0.045)');
    g1.addColorStop(1, 'rgba(10, 14, 20, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const x2 = w * 0.75 + Math.cos(t * 0.7) * 90;
    const y2 = h * 0.65 + Math.sin(t * 0.9) * 80;
    const g2 = ctx.createRadialGradient(x2, y2, 10, x2, y2, Math.max(w, h) * 0.55);
    g2.addColorStop(0, 'rgba(245, 158, 11, 0.035)');
    g2.addColorStop(1, 'rgba(10, 14, 20, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    animId = requestAnimationFrame(draw);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      draw();
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

  const rawUser = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';
  const userName = profile.display_name ? profile.display_name : rawUser;
  const userInitial = rawUser.charAt(0).toUpperCase();

  const avatarDisplay = profile.avatar && profile.avatar !== 'monogram'
    ? `<span class="emoji-avatar">${profile.avatar}</span>`
    : `<span class="monogram-avatar">${userInitial}</span>`;

  return `
    <header class="masthead">
      <div class="brand" data-tab="home">
        <div class="brand-icon">
          ${icon('sparkle', 18)}
        </div>
        <div style="display: flex; align-items: center;">
          <span class="brand-name">FinKaif</span>
          <span class="brand-badge">8.9</span>
        </div>
      </div>

      <nav class="nav-controller" role="tablist">
        <button class="nav-item ${tab === 'home' ? 'active' : ''}" data-tab="home" title="Главный обзор">
          ${icon('overview', 15)}
          <span>Обзор</span>
        </button>
        <button class="nav-item ${tab === 'analytics' ? 'active' : ''}" data-tab="analytics" title="Аналитика и графики">
          ${icon('analytics', 15)}
          <span>Аналитика</span>
        </button>
        <button class="nav-item ${tab === 'transactions' ? 'active' : ''}" data-tab="transactions" title="Журнал операций">
          ${icon('transactions', 15)}
          <span>Операции</span>
        </button>
        <button class="nav-item ${tab === 'budgets' ? 'active' : ''}" data-tab="budgets" title="Лимиты бюджета">
          ${icon('budgets', 15)}
          <span>Бюджеты</span>
        </button>
        <button class="nav-item ${tab === 'goals' ? 'active' : ''}" data-tab="goals" title="Финансовые цели">
          ${icon('goals', 15)}
          <span>Цели</span>
        </button>
        <button class="nav-item ${tab === 'assistant' ? 'active' : ''}" data-tab="assistant" title="ИИ-ментор">
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

        <div class="user-btn" id="user-profile-btn" title="Профиль, аватарка и настройки">
          <div class="user-avatar">${avatarDisplay}</div>
          <span class="user-name-text">${esc(userName)}</span>
          <span class="user-settings-icon">${icon('settings', 13)}</span>
        </div>
      </div>
    </header>
  `;
}

/* ==========================================================================
   VIEW 1: OVERVIEW (HOME)
   CRITICAL RULE: "Добрый день" IS STRICTLY ALLOWED ONLY HERE!
   ========================================================================== */
function renderHomeView() {
  const rawUser = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';
  const userName = profile.display_name ? profile.display_name : rawUser;

  const inc = data.transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const exp = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = inc - exp;

  const savingsRate = inc > 0 ? Math.max(0, Math.round(((inc - exp) / inc) * 100)) : 0;

  // Build daily timeline points for smooth capital balance chart
  const now = new Date();
  const dayPoints = [];

  if (period === 'year') {
    // 12 calendar month buckets
    for (let m = 11; m >= 0; m--) {
      const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = target.getFullYear();
      const monthNum = String(target.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${monthNum}`;

      const mExp = data.transactions
        .filter(t => t.type === 'expense' && getTxIso(t).startsWith(prefix))
        .reduce((s, t) => s + Number(t.amount), 0);
      const mInc = data.transactions
        .filter(t => t.type === 'income' && getTxIso(t).startsWith(prefix))
        .reduce((s, t) => s + Number(t.amount), 0);

      dayPoints.push({
        date: prefix,
        dayLabel: target.toLocaleDateString('ru-RU', { month: 'short' }),
        dayDisplay: target.toLocaleDateString('ru-RU', { month: 'short' }),
        fullDate: target.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        exp: mExp,
        inc: mInc
      });
    }
  } else {
    // 7 days or 30 days
    const numDays = period === '7d' ? 7 : 30;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = toDateIso(d);
      const dayExp = data.transactions
        .filter(t => t.type === 'expense' && getTxIso(t) === iso)
        .reduce((s, t) => s + Number(t.amount), 0);
      const dayInc = data.transactions
        .filter(t => t.type === 'income' && getTxIso(t) === iso)
        .reduce((s, t) => s + Number(t.amount), 0);

      const wkShort = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      const capWk = wkShort.charAt(0).toUpperCase() + wkShort.slice(1);

      dayPoints.push({
        date: iso,
        dayNum: d.getDate(),
        wkShort: capWk,
        dayLabel: period === '7d' ? capWk : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        dayDisplay: period === '7d' ? `${capWk} ${d.getDate()}` : `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dayExp,
        inc: dayInc
      });
    }
  }

  // True Cumulative Capital Trajectory
  const windowNet = dayPoints.reduce((s, p) => s + (p.inc - p.exp), 0);
  let runningBal = balance - windowNet;
  const pointsWithBal = dayPoints.map(p => {
    runningBal += (p.inc - p.exp);
    return {
      ...p,
      balance: runningBal
    };
  });

  const periodInc = dayPoints.reduce((s, p) => s + p.inc, 0);
  const periodExp = dayPoints.reduce((s, p) => s + p.exp, 0);
  const periodFootnote = period === '7d' ? 'За последние 7 дней' : (period === '30d' ? 'За последние 30 дней' : 'За последние 12 месяцев');

  const minVal = Math.min(...pointsWithBal.map(p => p.balance));
  const maxVal = Math.max(...pointsWithBal.map(p => p.balance));
  const balDiff = maxVal - minVal;
  const netDelta = pointsWithBal[pointsWithBal.length - 1].balance - pointsWithBal[0].balance;

  const isDeficit = balance < 0;
  const accentColor = isDeficit ? '#FB7185' : '#2DD4BF';
  const glowColor = isDeficit ? 'rgba(251, 113, 133, 0.45)' : 'rgba(45, 212, 191, 0.45)';

  const svgW = 760;
  const svgH = 120;
  const padX = 28;
  const padTop = 18;
  const padBottom = 16;
  const plotW = svgW - 2 * padX;
  const plotH = svgH - padTop - padBottom;

  const points = pointsWithBal.map((p, idx) => {
    const x = Math.round(padX + (idx / (pointsWithBal.length - 1 || 1)) * plotW);
    let y;
    if (balDiff === 0) {
      y = Math.round(padTop + plotH * 0.5);
    } else {
      const margin = Math.max(balDiff * 0.20, 100);
      const yMin = minVal - margin;
      const yMax = maxVal + margin;
      y = Math.round(svgH - padBottom - ((p.balance - yMin) / (yMax - yMin)) * plotH);
    }
    return { x, y, idx, ...p };
  });

  window.__homePoints = points;
  window.__homeCurrentBalance = balance;
  window.__homeSvgH = svgH;
  window.__homeAccentColor = accentColor;
  window.__homeIsDeficit = isDeficit;
  window.__homePeriod = period;

  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const curvePath = pointsToSmoothPath(points);
  const areaPath = `${curvePath} L ${lastPt.x},${svgH - padBottom} L ${firstPt.x},${svgH - padBottom} Z`;

  // Dynamic reference grid lines
  const gridLevels = [
    { y: Math.round(padTop + plotH * 0.15) },
    { y: Math.round(padTop + plotH * 0.55) },
    { y: Math.round(padTop + plotH * 0.95) }
  ];

  // Zero-line indicator if range crosses zero and doesn't clash with line
  let zeroLineHtml = '';
  if (balDiff > 0) {
    const margin = Math.max(balDiff * 0.20, 100);
    const yMin = minVal - margin;
    const yMax = maxVal + margin;
    if (yMin < -100 && yMax > 100) {
      const yZero = Math.round(svgH - padBottom - ((0 - yMin) / (yMax - yMin)) * plotH);
      if (Math.abs(yZero - firstPt.y) > 16 && Math.abs(yZero - lastPt.y) > 16) {
        zeroLineHtml = `
          <line class="home-grid-zero" x1="${padX}" y1="${yZero}" x2="${svgW - padX}" y2="${yZero}" stroke="rgba(255, 255, 255, 0.12)" stroke-dasharray="3 3" stroke-width="1" />
          <text x="${svgW - padX}" y="${yZero - 4}" fill="#64748B" font-size="9" text-anchor="end" font-family="var(--font-sans)" font-weight="600">0 ₽</text>
        `;
      }
    }
  }

  // HTML Executive Date Axis Items (Never distorted by SVG!)
  const axisItemsHtml = points.map((pt, idx) => {
    let show = false;
    if (period === '7d') show = true;
    else if (period === '30d') show = (idx % 5 === 0 || idx === points.length - 1);
    else show = (idx % 2 === 0 || idx === points.length - 1);

    if (!show) return '';
    const isLatest = (idx === points.length - 1);
    const leftPct = ((pt.x / svgW) * 100).toFixed(2);

    let badgeContent = '';
    if (period === '7d') {
      badgeContent = `
        <span class="axis-dow">${esc(pt.wkShort || '')}</span>
        <span class="axis-num">${esc(String(pt.dayNum || ''))}</span>
      `;
    } else {
      badgeContent = `<span class="axis-num">${esc(pt.dayDisplay || pt.dayLabel)}</span>`;
    }

    return `
      <div class="home-axis-item ${isLatest ? 'is-latest' : ''}" data-idx="${idx}" style="left: ${leftPct}%;">
        <div class="axis-tick-pip"></div>
        <div class="axis-date-badge">
          ${badgeContent}
        </div>
      </div>
    `;
  }).join('');

  // HTML-based live terminal beacon (100% round circle, zero SVG distortion)
  const terminalBeaconHtml = `
    <div id="home-terminal-beacon" class="home-terminal-beacon" style="left: ${((lastPt.x / svgW) * 100).toFixed(2)}%; top: ${((lastPt.y / svgH) * 100).toFixed(2)}%;">
      <div class="terminal-pulse-ring" style="border-color: ${accentColor}; background: ${isDeficit ? 'rgba(251, 113, 133, 0.15)' : 'rgba(45, 212, 191, 0.15)'};"></div>
      <div class="terminal-core-dot" style="background: ${accentColor}; box-shadow: 0 0 6px ${accentColor};"></div>
    </div>
  `;

  // HTML-based activity micro-pips (100% round circles, zero aspect distortion)
  const activityPipsHtml = points.slice(0, -1).filter(pt => pt.inc > 0 || pt.exp > 0).map(pt => {
    let pipColor = pt.inc > 0 && pt.exp === 0 ? '#34D399' : (pt.exp > 0 && pt.inc === 0 ? '#FB7185' : accentColor);
    const leftPct = ((pt.x / svgW) * 100).toFixed(2);
    const topPct = ((pt.y / svgH) * 100).toFixed(2);
    return `<div class="home-activity-pip" style="left: ${leftPct}%; top: ${topPct}%; background: ${pipColor};"></div>`;
  }).join('');

  // Quick categories breakdown for teaser
  const topCategories = {};
  data.transactions.filter(t => t.type === 'expense').forEach(t => {
    topCategories[t.category] = (topCategories[t.category] || 0) + Number(t.amount);
  });
  const topCatList = Object.entries(topCategories).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const recentTransactions = [...data.transactions].slice(0, 6);

  const badgeHtml = isDeficit
    ? `
      <div class="hero-balance-badge deficit num">
        ${icon('trendDown', 13)}
        <span>Дефицит остатка</span>
      </div>
    `
    : `
      <div class="hero-balance-badge num">
        ${icon('trendUp', 13)}
        <span>${savingsRate}% норма накоплений</span>
      </div>
    `;

  return `
    <div class="view-header">
      <div>
        <div class="view-greeting">Добрый день, ${esc(userName)}</div>
        <h1 class="view-title">Финансовый баланс</h1>
        <p class="view-subtitle">Сводный обзор капитала, ежедневные потоки и операционные записи.</p>
      </div>
    </div>

    <!-- Main Capital Hero Card -->
    <div class="hero-balance-card ${isDeficit ? 'deficit' : ''}">
      <div class="hero-topline">
        <span class="hero-label" id="hero-balance-lbl">Чистый свободный остаток</span>
        <div class="period-tabs">
          <button class="period-tab ${period === '7d' ? 'active' : ''}" data-period="7d">7 дней</button>
          <button class="period-tab ${period === '30d' ? 'active' : ''}" data-period="30d">30 дней</button>
          <button class="period-tab ${period === 'year' ? 'active' : ''}" data-period="year">Год</button>
        </div>
      </div>

      <div class="hero-balance-row">
        <div class="hero-balance-figure num" id="hero-balance-val" data-base="${money(balance)}">${money(balance)}</div>
        ${badgeHtml}
      </div>

      <!-- Contextual Meta Chips Strip -->
      <div class="hero-chart-meta">
        <div class="hero-meta-chip">
          <span class="hero-meta-dot" style="background: ${accentColor};"></span>
          <span class="hero-meta-lbl">Динамика:</span>
          <span class="hero-meta-val num ${netDelta >= 0 ? 'inc' : 'exp'}">${netDelta >= 0 ? '+' : ''}${money(netDelta)}</span>
        </div>
        <div class="hero-meta-chip muted">
          <span class="hero-meta-lbl">Старт:</span>
          <span class="hero-meta-val num">${money(pointsWithBal[0].balance)}</span>
        </div>
        <div class="hero-meta-chip muted">
          <span class="hero-meta-lbl">Текущий:</span>
          <span class="hero-meta-val num">${money(balance)}</span>
        </div>
      </div>

      <!-- Clean Dynamic Cashflow Curve -->
      <div class="hero-chart-container" id="home-chart-wrap">
        <div class="home-chart-plot" id="home-chart-plot">
          <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" id="home-chart-svg">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.14"/>
              <stop offset="70%" stop-color="${accentColor}" stop-opacity="0.02"/>
              <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.0"/>
            </linearGradient>
            <filter id="homeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="${accentColor}" flood-opacity="0.5"/>
            </filter>
          </defs>

          <!-- Horizontal Reference Grid Lines -->
          ${gridLevels.map(g => `
            <line class="home-grid-line" x1="${padX}" y1="${g.y}" x2="${svgW - padX}" y2="${g.y}" stroke="rgba(255, 255, 255, 0.04)" stroke-dasharray="4 4" stroke-width="1" />
          `).join('')}

          ${zeroLineHtml}

          <!-- Area & Smooth Trajectory -->
          <path d="${areaPath}" fill="url(#chartGrad)" />
          <path d="${curvePath}" fill="none" stroke="${accentColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#homeGlow)" />

            <!-- Full Width Interactive Hover Overlay -->
            <rect id="home-chart-overlay" class="home-chart-overlay" x="0" y="0" width="${svgW}" height="${svgH}" fill="transparent" />
          </svg>

          <!-- HTML-based Perfectly Circular Indicators & Fluid Scrubber (No SVG distortion) -->
          ${activityPipsHtml}
          ${terminalBeaconHtml}
          <div id="home-scrubber-laser" class="home-scrubber-laser" style="background: linear-gradient(180deg, transparent 0%, ${accentColor} 20%, ${accentColor} 80%, transparent 100%);"></div>
          <div id="home-scrubber-beacon" class="home-scrubber-beacon">
            <div class="scrubber-pulse-ring" style="border-color: ${accentColor}; background: ${isDeficit ? 'rgba(251, 113, 133, 0.20)' : 'rgba(45, 212, 191, 0.20)'}; box-shadow: 0 0 10px ${glowColor};"></div>
            <div class="scrubber-core-dot"></div>
          </div>

          <div id="home-chart-tooltip" class="chart-tooltip"></div>
        </div>

        <!-- HTML-based High-DPI Executive Date Axis Strip -->
        <div class="home-chart-axis-strip" id="home-chart-axis-strip">
          ${axisItemsHtml}
        </div>
      </div>
    </div>

    <!-- Stats Row (2 Cards) -->
    <div class="stats-strip">
      <div class="stat-card">
        <div class="stat-card-head">
          <span class="stat-card-title">Поступления за период</span>
          <div class="stat-icon inc">${icon('trendUp', 16)}</div>
        </div>
        <div class="stat-amount inc num">+${money(periodInc)}</div>
        <div class="stat-footnote">${periodFootnote}</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-head">
          <span class="stat-card-title">Расходы за период</span>
          <div class="stat-icon exp">${icon('trendDown', 16)}</div>
        </div>
        <div class="stat-amount exp num">−${money(periodExp)}</div>
        <div class="stat-footnote">${periodFootnote}</div>
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
      <button class="quick-action-btn" data-tab="analytics">
        ${icon('analytics', 14)}
        <span>Аналитика трат</span>
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

    ${topCatList.length > 0 ? `
      <!-- Teaser: Structure Pulse -->
      <div class="section-head" style="margin-top: 10px;">
        <h2 class="section-title">Главные статьи расходов</h2>
        <a class="section-link" data-tab="analytics">
          <span>Полный анализ и графики</span>
          <span>→</span>
        </a>
      </div>
      <div class="pulse-cats-grid">
        ${topCatList.map(([cat, amt]) => {
          const pct = exp > 0 ? Math.round((amt / exp) * 100) : 0;
          return `
            <div class="pulse-cat-card" data-tab="analytics" data-cat="${esc(cat)}">
              <div class="pulse-cat-icon">${getCategoryIcon(cat)}</div>
              <div class="pulse-cat-info">
                <div class="pulse-cat-name">${esc(cat)}</div>
                <div class="pulse-cat-amt num">${money(amt)}</div>
              </div>
              <div class="pulse-cat-badge">${pct}%</div>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}

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
   VIEW: ANALYTICS (DEEP FINANCIAL ANALYSIS & CHARTS)
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderAnalyticsView() {
  const now = new Date();

  // Filter transactions for chosen period
  let periodTxs = [...data.transactions];
  let daysCount = 30;

  if (analyticsPeriod === '7d') {
    daysCount = 7;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const since = toDateIso(d);
    periodTxs = data.transactions.filter(t => getTxIso(t) >= since);
  } else if (analyticsPeriod === '30d') {
    daysCount = 30;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const since = toDateIso(d);
    periodTxs = data.transactions.filter(t => getTxIso(t) >= since);
  } else if (analyticsPeriod === 'month') {
    const monthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
    periodTxs = data.transactions.filter(t => getTxIso(t) >= monthStart);
    daysCount = Math.max(1, now.getDate());
  } else {
    // all time
    periodTxs = [...data.transactions];
    daysCount = Math.max(30, Math.round((now.getTime() - new Date(periodTxs[periodTxs.length - 1]?.occurred_on || now).getTime()) / 86400000) || 30);
  }

  const pInc = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const pExp = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const pNet = pInc - pExp;
  const pSavingsRate = pInc > 0 ? Math.max(0, Math.round((pNet / pInc) * 100)) : 0;

  // Daily Burn Rate (Velocity)
  const dailyVelocity = Math.round(pExp / (daysCount || 1));

  // Current balance
  const totalInc = data.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = data.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const currentBalance = totalInc - totalExp;

  // Runway Calculation
  const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(1, daysInCurMonth - now.getDate());
  const projectedMonthEnd = currentBalance - (dailyVelocity * daysRemainingInMonth);

  let burnStatus = 'safe';
  let burnText = 'Комфортный темп';
  if (dailyVelocity > 0 && currentBalance < dailyVelocity * 7) {
    burnStatus = 'alert';
    burnText = 'Высокий темп расходов';
  } else if (dailyVelocity > 0 && currentBalance < dailyVelocity * 20) {
    burnStatus = 'warn';
    burnText = 'Умеренная нагрузка';
  }

  // Rank
  const userRank = getFinancialRank(currentBalance, data.goals);

  // Categories Breakdown
  const catMap = {};
  periodTxs.filter(t => t.type === 'expense').forEach(t => {
    const c = t.category || 'Прочее';
    catMap[c] = (catMap[c] || 0) + Number(t.amount);
  });

  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const donutPalette = [
    '#2DD4BF', // Cashmere Jade
    '#F59E0B', // Warm Amber
    '#818CF8', // Velvet Indigo
    '#FB7185', // Rose Coral
    '#34D399', // Emerald
    '#A78BFA', // Violet
    '#38BDF8', // Cyan
    '#FBBF24', // Bronze
    '#94A3B8'  // Slate Muted
  ];

  // SVG Donut Slices Math with crisp gaps and zero bleed (Radius 70 -> 124px inner hole diameter)
  const radius = 70;
  const circ = 2 * Math.PI * radius; // ~439.82
  let accumulatedOffset = 0;
  const gap = sortedCats.length > 1 ? 4 : 0;
  const totalGaps = gap * sortedCats.length;
  const usableCirc = Math.max(10, circ - totalGaps);

  const donutSlices = sortedCats.map(([cat, amt], idx) => {
    const pct = pExp > 0 ? (amt / pExp) : 0;
    const sliceLen = sortedCats.length === 1 ? circ : Math.max(2, pct * usableCirc);
    const strokeColor = donutPalette[idx % donutPalette.length];
    const offset = accumulatedOffset;
    accumulatedOffset += sliceLen + gap;

    return {
      cat,
      amt,
      pct: Math.round(pct * 100) || 1,
      sliceLen,
      offset,
      color: strokeColor,
      icon: getCategoryIcon(cat)
    };
  });

  // Current active readout in donut center
  const targetDonut = activeAnalyticsCat ? donutSlices.find(s => s.cat === activeAnalyticsCat) : null;

  // Month-over-Month calculation
  const curMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
  const prevMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthSameDay = toDateIso(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));

  const curMonthExp = data.transactions
    .filter(t => t.type === 'expense' && getTxIso(t) >= curMonthStart)
    .reduce((s, t) => s + Number(t.amount), 0);
  const prevMonthExp = data.transactions
    .filter(t => t.type === 'expense' && getTxIso(t) >= prevMonthStart && getTxIso(t) <= prevMonthSameDay)
    .reduce((s, t) => s + Number(t.amount), 0);

  let momExpDeltaPct = 0;
  if (prevMonthExp > 0) {
    momExpDeltaPct = Math.round(((curMonthExp - prevMonthExp) / prevMonthExp) * 100);
  }

  // Build dual cashflow area timeline for all periods
  const cashflowPoints = [];

  if (analyticsPeriod === 'all') {
    // 12 monthly points
    for (let m = 11; m >= 0; m--) {
      const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = target.getFullYear();
      const monthNum = String(target.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${monthNum}`;

      const dExp = data.transactions
        .filter(t => t.type === 'expense' && getTxIso(t).startsWith(prefix))
        .reduce((s, t) => s + Number(t.amount), 0);
      const dInc = data.transactions
        .filter(t => t.type === 'income' && getTxIso(t).startsWith(prefix))
        .reduce((s, t) => s + Number(t.amount), 0);

      cashflowPoints.push({
        date: prefix,
        dayLabel: target.toLocaleDateString('ru-RU', { month: 'short' }),
        fullDate: target.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        exp: dExp,
        inc: dInc
      });
    }
  } else {
    const chartDays = analyticsPeriod === '7d' ? 7 : (analyticsPeriod === 'month' ? Math.max(7, now.getDate()) : 30);
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = toDateIso(d);
      const dExp = data.transactions
        .filter(t => t.type === 'expense' && getTxIso(t) === iso)
        .reduce((s, t) => s + Number(t.amount), 0);
      const dInc = data.transactions
        .filter(t => t.type === 'income' && getTxIso(t) === iso)
        .reduce((s, t) => s + Number(t.amount), 0);

      cashflowPoints.push({
        date: iso,
        dayLabel: analyticsPeriod === '7d'
          ? d.toLocaleDateString('ru-RU', { weekday: 'short' })
          : `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dExp,
        inc: dInc
      });
    }
  }

  const cfMax = Math.max(1000, ...cashflowPoints.map(p => Math.max(p.exp, p.inc)));
  const cfW = 760;
  const cfH = 150;
  const baselineY = 120;
  const plotH = 96;
  const padX = 24;
  const usableW = cfW - 2 * padX;

  const cfCoords = cashflowPoints.map((p, idx) => {
    const x = Math.round(padX + (idx / (cashflowPoints.length - 1 || 1)) * usableW);
    const yInc = Math.round(baselineY - (p.inc / cfMax) * plotH);
    const yExp = Math.round(baselineY - (p.exp / cfMax) * plotH);
    return { x, yInc, yExp, idx, ...p };
  });

  window.__cfPoints = cfCoords;

  const incPath = pointsToSmoothPath(cfCoords.map(p => ({ x: p.x, y: p.yInc })));
  const incArea = cfCoords.length > 0
    ? `${incPath} L ${cfCoords[cfCoords.length - 1].x},${baselineY} L ${cfCoords[0].x},${baselineY} Z`
    : '';

  const expPath = pointsToSmoothPath(cfCoords.map(p => ({ x: p.x, y: p.yExp })));
  const expArea = cfCoords.length > 0
    ? `${expPath} L ${cfCoords[cfCoords.length - 1].x},${baselineY} L ${cfCoords[0].x},${baselineY} Z`
    : '';

  // Filtered operations for drilldown
  const drilldownTxs = activeAnalyticsCat
    ? periodTxs.filter(t => t.category === activeAnalyticsCat)
    : periodTxs.filter(t => t.type === 'expense').slice(0, 6);

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Аналитический центр</h1>
        <p class="view-subtitle">Глубокая структура расходов, динамика денежного потока и финансовые проекции.</p>
      </div>

      <div class="analytics-period-bar">
        <button class="analytics-period-btn ${analyticsPeriod === '7d' ? 'active' : ''}" data-aperiod="7d">7 дней</button>
        <button class="analytics-period-btn ${analyticsPeriod === '30d' ? 'active' : ''}" data-aperiod="30d">30 дней</button>
        <button class="analytics-period-btn ${analyticsPeriod === 'month' ? 'active' : ''}" data-aperiod="month">Этот месяц</button>
        <button class="analytics-period-btn ${analyticsPeriod === 'all' ? 'active' : ''}" data-aperiod="all">Все время</button>
      </div>
    </div>

    <!-- 4 Key Analytics Metrics -->
    <div class="analytics-metrics-strip">
      <div class="analytics-metric-card">
        <div class="metric-topline">
          <span class="metric-label">Чистый денежный поток</span>
          <span class="metric-icon ${pNet >= 0 ? 'inc' : 'exp'}">${icon(pNet >= 0 ? 'trendUp' : 'trendDown', 15)}</span>
        </div>
        <div class="metric-value num ${pNet >= 0 ? 'inc' : 'exp'}">${pNet >= 0 ? '+' : '−'}${money(Math.abs(pNet))}</div>
        <div class="metric-footnote">
          ${pSavingsRate > 0 ? `<span class="badge-tag jade">${pSavingsRate}% сохранено</span>` : 'Баланс периода'}
        </div>
      </div>

      <div class="analytics-metric-card">
        <div class="metric-topline">
          <span class="metric-label">Темп трат (Burn Rate)</span>
          <span class="metric-icon exp">${icon('flame', 15)}</span>
        </div>
        <div class="metric-value num exp">${money(dailyVelocity)} <span class="metric-unit">/ день</span></div>
        <div class="metric-footnote">
          <span class="badge-tag ${burnStatus === 'safe' ? 'jade' : (burnStatus === 'warn' ? 'amber' : 'coral')}">${burnText}</span>
        </div>
      </div>

      <div class="analytics-metric-card">
        <div class="metric-topline">
          <span class="metric-label">Прогноз на конец месяца</span>
          <span class="metric-icon inc">${icon('wallet', 15)}</span>
        </div>
        <div class="metric-value num ${projectedMonthEnd >= 0 ? 'inc' : 'exp'}">${money(projectedMonthEnd)}</div>
        <div class="metric-footnote">Остаток на 1-е число при текущей скорости</div>
      </div>

      <div class="analytics-metric-card">
        <div class="metric-topline">
          <span class="metric-label">Финансовый статус</span>
          <span class="metric-icon inc">${userRank.badge}</span>
        </div>
        <div class="metric-value rank-text">${userRank.title}</div>
        <div class="metric-footnote">${userRank.desc}</div>
      </div>
    </div>

    <!-- 2 Main Analytics Blocks: Donut & Dual Cashflow Wave -->
    <div class="analytics-main-grid">
      <!-- Donut Chart & Categories Breakdown -->
      <div class="analytics-card donut-card">
        <div class="card-title-row">
          <div>
            <h3 class="card-title">Структура расходов</h3>
            <p class="card-desc">Нажмите на категорию или сегмент кольца для фильтрации</p>
          </div>
          ${activeAnalyticsCat ? `
            <button class="btn-ghost-sm" id="btn-reset-donut-filter">Сбросить выбор ✕</button>
          ` : ''}
        </div>

        <div class="donut-layout">
          <!-- SVG Donut Canvas (200x200 with 124px inner hole) -->
          <div class="donut-chart-box">
            <svg class="donut-svg" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="${radius}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="16" />
              ${donutSlices.length > 0 ? donutSlices.map(s => `
                <circle
                  class="donut-segment ${(activeAnalyticsCat === s.cat) ? 'focused' : ''}"
                  data-cat="${esc(s.cat)}"
                  data-amt="${s.amt}"
                  data-pct="${s.pct}"
                  data-icon="${s.icon}"
                  cx="100" cy="100" r="${radius}"
                  fill="none"
                  stroke="${s.color}"
                  stroke-width="${activeAnalyticsCat === s.cat ? 20 : 16}"
                  stroke-dasharray="${s.sliceLen} ${Math.max(0.1, circ - s.sliceLen)}"
                  stroke-dashoffset="${-s.offset}"
                  stroke-linecap="butt"
                  transform="rotate(-90 100 100)"
                />
              `).join('') : `
                <circle cx="100" cy="100" r="${radius}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="14" stroke-dasharray="6 6" />
              `}
            </svg>

            <!-- Center Readout (Always perfectly fits inside the 124px inner hole without overflowing) -->
            <div class="donut-center-info" id="donut-center-info" data-default-amt="${pExp}" data-default-count="${sortedCats.length}">
              ${targetDonut ? `
                <div class="donut-center-icon">${targetDonut.icon}</div>
                <div class="donut-center-amt num">${money(targetDonut.amt)}</div>
                <div class="donut-center-cat" title="${esc(targetDonut.cat)}">${esc(targetDonut.cat)}</div>
                <div class="donut-center-badge">${targetDonut.pct}% трат</div>
              ` : `
                <div class="donut-center-lbl">ВСЕГО ТРАТ</div>
                <div class="donut-center-amt num">${money(pExp)}</div>
                <div class="donut-center-badge jade">${sortedCats.length} ${pluralizeCats(sortedCats.length)}</div>
              `}
            </div>
          </div>

          <!-- Category Legend & Progress Bars -->
          <div class="donut-legend-stream">
            ${sortedCats.length > 0 ? donutSlices.map(s => `
              <div class="donut-cat-item ${activeAnalyticsCat === s.cat ? 'selected' : ''}" data-cat="${esc(s.cat)}" data-amt="${s.amt}" data-pct="${s.pct}" data-icon="${s.icon}">
                <div class="donut-cat-head">
                  <div class="donut-cat-meta">
                    <span class="donut-cat-dot" style="background: ${s.color};"></span>
                    <span class="donut-cat-icon">${s.icon}</span>
                    <span class="donut-cat-name">${esc(s.cat)}</span>
                  </div>
                  <div class="donut-cat-vals num">
                    <span class="donut-cat-amt">${money(s.amt)}</span>
                    <span class="donut-cat-pct">${s.pct}%</span>
                  </div>
                </div>
                <div class="donut-progress-track">
                  <div class="donut-progress-fill" style="width: ${s.pct}%; background: ${s.color};"></div>
                </div>
              </div>
            `).join('') : `
              <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                Нет зафиксированных расходов за выбранный период.
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Cashflow Wave Dual Curve -->
      <div class="analytics-card cashflow-card">
        <div class="card-title-row">
          <div>
            <h3 class="card-title">Денежный поток (Cashflow)</h3>
            <p class="card-desc">Сравнение поступлений и списаний по дням с интерактивным курсором</p>
          </div>
          <div class="cashflow-legend-pills">
            <span class="cf-pill inc"><span class="cf-dot" style="background: #2DD4BF;"></span> Доходы</span>
            <span class="cf-pill exp"><span class="cf-dot" style="background: #F59E0B;"></span> Расходы</span>
          </div>
        </div>

        <div class="cashflow-chart-box" id="cf-chart-wrap">
          <svg viewBox="0 0 ${cfW} ${cfH}" preserveAspectRatio="none" id="cf-chart-svg" style="width: 100%; height: 160px; overflow: visible;">
            <defs>
              <linearGradient id="cfIncGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="#2DD4BF" stop-opacity="0.0"/>
              </linearGradient>
              <linearGradient id="cfExpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0"/>
              </linearGradient>
            </defs>

            <!-- Guide Line at baseline -->
            <line x1="${padX}" y1="${baselineY}" x2="${cfW - padX}" y2="${baselineY}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>

            <!-- Income Wave Area & Stroke -->
            ${incArea ? `<path d="${incArea}" fill="url(#cfIncGrad)" />` : ''}
            ${incPath ? `<path d="${incPath}" fill="none" stroke="#2DD4BF" stroke-width="2.5" stroke-linecap="round" />` : ''}

            <!-- Expense Wave Area & Stroke -->
            ${expArea ? `<path d="${expArea}" fill="url(#cfExpGrad)" />` : ''}
            ${expPath ? `<path d="${expPath}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" />` : ''}

            <!-- Dynamic Scrubber Guide Elements -->
            <line id="cf-scrubber-line" class="cf-scrubber-line" x1="0" y1="0" x2="0" y2="${baselineY}" />
            <circle id="cf-scrubber-inc" class="cf-scrubber-dot inc" cx="0" cy="0" r="5" />
            <circle id="cf-scrubber-exp" class="cf-scrubber-dot exp" cx="0" cy="0" r="5" />

            <!-- Interactive Dots & Clean Labels -->
            ${cfCoords.map((pt, idx) => {
              const showLabel = cfCoords.length <= 8
                || (cfCoords.length <= 15 && idx % 2 === 0)
                || (cfCoords.length > 15 && (idx % 5 === 0 || idx === cfCoords.length - 1));

              return `
                ${pt.inc > 0 ? `<circle class="cf-pt inc" cx="${pt.x}" cy="${pt.yInc}" r="3.5" fill="#141A23" stroke="#2DD4BF" stroke-width="2" data-idx="${idx}" data-date="${esc(pt.fullDate || pt.dayLabel)}" data-inc="${pt.inc}" data-exp="${pt.exp}" />` : ''}
                ${pt.exp > 0 ? `<circle class="cf-pt exp" cx="${pt.x}" cy="${pt.yExp}" r="3.5" fill="#141A23" stroke="#F59E0B" stroke-width="2" data-idx="${idx}" data-date="${esc(pt.fullDate || pt.dayLabel)}" data-inc="${pt.inc}" data-exp="${pt.exp}" />` : ''}
                ${showLabel ? `<text x="${pt.x}" y="${cfH - 4}" font-size="10" fill="#64748B" text-anchor="middle" font-family="inherit">${pt.dayLabel}</text>` : ''}
              `;
            }).join('')}

            <rect id="cf-chart-overlay" class="cf-chart-overlay" x="0" y="0" width="${cfW}" height="${cfH}" fill="transparent" />
          </svg>
          <div id="cf-chart-tooltip" class="chart-tooltip"></div>
        </div>

        <!-- Month-over-Month Bar -->
        <div class="mom-strip">
          <div class="mom-col">
            <div class="mom-lbl">Динамика расходов к прошлому месяцу:</div>
            <div class="mom-stat">
              ${prevMonthExp > 0 ? `
                <span class="badge-tag ${momExpDeltaPct <= 0 ? 'jade' : 'coral'}">
                  ${momExpDeltaPct <= 0 ? '−' : '+'}${Math.abs(momExpDeltaPct)}%
                  ${momExpDeltaPct <= 0 ? ' (Экономия)' : ' (Рост трат)'}
                </span>
                <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">
                  Текущий месяц: ${money(curMonthExp)} vs прошлый: ${money(prevMonthExp)}
                </span>
              ` : `
                <span style="color: var(--text-muted); font-size: 12px;">Недостаточно данных за предыдущий месяц для сравнения.</span>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drilldown Transactions Stream -->
    <div class="section-head" style="margin-top: 14px;">
      <h2 class="section-title">
        ${activeAnalyticsCat ? `Операции: ${getCategoryIcon(activeAnalyticsCat)} ${esc(activeAnalyticsCat)}` : 'Крупнейшие списания периода'}
      </h2>
      ${activeAnalyticsCat ? `
        <button class="btn-ghost-sm" id="btn-reset-drilldown">Показать все списания</button>
      ` : `
        <a class="section-link" data-tab="transactions">
          <span>Все операции (${data.transactions.length}) →</span>
        </a>
      `}
    </div>

    <div class="tx-list">
      ${drilldownTxs.length > 0 ? drilldownTxs.map(t => renderTxCard(t)).join('') : `
        <div style="text-align: center; padding: 30px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--r-md);">
          В категории нет операций за выбранный период.
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

  const txInc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const txExp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const txNet = txInc - txExp;

  const groups = {};
  filtered.forEach(t => {
    const d = getTxIso(t) || 'Не указана';
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">История операций</h1>
        <p class="view-subtitle">Полный журнал поступлений и списаний средств с быстрым поиском и итогами.</p>
      </div>
      <button class="btn-primary" id="btn-add-tx-view">
        ${icon('plus', 14)}
        <span>Новая операция</span>
      </button>
    </div>

    <!-- Summary Metrics Strip for Transactions -->
    <div class="tx-summary-strip">
      <div class="tx-summary-card">
        <span class="tx-summary-lbl">Всего записей</span>
        <span class="tx-summary-val num">${filtered.length}</span>
      </div>
      <div class="tx-summary-card">
        <span class="tx-summary-lbl">Поступления</span>
        <span class="tx-summary-val num inc">+${money(txInc)}</span>
      </div>
      <div class="tx-summary-card">
        <span class="tx-summary-lbl">Списания</span>
        <span class="tx-summary-val num exp">−${money(txExp)}</span>
      </div>
      <div class="tx-summary-card">
        <span class="tx-summary-lbl">Сальдо периода</span>
        <span class="tx-summary-val num ${txNet >= 0 ? 'inc' : 'exp'}">${txNet >= 0 ? '+' : ''}${money(txNet)}</span>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="filter-tab ${txFilter === 'all' ? 'active' : ''}" data-filter="all">Все записи</button>
        <button class="filter-tab ${txFilter === 'expense' ? 'active' : ''}" data-filter="expense">Расходы</button>
        <button class="filter-tab ${txFilter === 'income' ? 'active' : ''}" data-filter="income">Доходы</button>
      </div>

      <div class="search-box">
        ${icon('search', 14)}
        <input id="tx-search-input" placeholder="Поиск по категории или описанию..." value="${esc(txSearch)}">
        ${txSearch ? `<button class="btn-icon" id="btn-clear-search" style="padding: 2px;">${icon('close', 12)}</button>` : ''}
      </div>
    </div>

    <!-- Transactions Grouped by Date -->
    <div class="tx-groups">
      ${sortedDates.length > 0 ? sortedDates.map(dateStr => {
        const dayTxs = groups[dateStr];
        const dayInc = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const dayExp = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

        return `
          <div class="tx-date-group">
            <div class="tx-date-header">
              <span class="tx-date-title">${formatDateLabel(dateStr)}</span>
              <div class="tx-date-summary num">
                ${dayInc > 0 ? `<span class="tx-summary-badge inc">+${money(dayInc)}</span>` : ''}
                ${dayExp > 0 ? `<span class="tx-summary-badge exp">−${money(dayExp)}</span>` : ''}
              </div>
            </div>
            <div class="tx-list">
              ${dayTxs.map(t => renderTxCard(t)).join('')}
            </div>
          </div>
        `;
      }).join('') : `
        <div style="text-align: center; padding: 60px 20px; background: var(--bg-surface); border-radius: var(--r-lg); border: 1px dashed var(--border-medium);">
          <div style="color: var(--text-muted); margin-bottom: 8px;">Операции не найдены</div>
          <p style="color: var(--text-secondary); font-size: 13px;">Попробуйте изменить поисковый запрос или фильтр.</p>
        </div>
      `}
    </div>
  `;
}

function formatDateLabel(dStr) {
  if (!dStr || dStr === 'Не указана') return 'Дата не указана';
  try {
    const clean = String(dStr).slice(0, 10);
    const parts = clean.split('-');
    if (parts.length !== 3) return dStr;

    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(y, m, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);

    const dayMonthStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' });

    if (diff === 0) return `Сегодня, ${dayMonthStr}`;
    if (diff === 1) return `Вчера, ${dayMonthStr}`;
    if (d.getFullYear() === now.getFullYear()) {
      return `${dayMonthStr}, ${dayName}`;
    }
    return `${dayMonthStr} ${y} г.`;
  } catch {
    return dStr;
  }
}

function renderTxCard(t) {
  const isInc = t.type === 'income';
  const catIcon = getCategoryIcon(t.category);

  return `
    <div class="tx-card" data-id="${t.id}">
      <div class="tx-left">
        <div class="tx-icon-box ${isInc ? 'inc' : 'exp'}">
          ${catIcon}
        </div>
        <div class="tx-meta">
          <div class="tx-category">${esc(t.category)}</div>
          <div class="tx-desc">${t.description ? esc(t.description) : 'Без описания'}</div>
        </div>
      </div>

      <div class="tx-right">
        <div class="tx-amount num ${isInc ? 'inc' : 'exp'}">
          ${isInc ? '+' : '−'}${money(t.amount)}
        </div>
        <div class="tx-actions">
          <button class="tx-delete-btn" data-id="${t.id}" title="Удалить запись">
            ${icon('trash', 13)}
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   VIEW 3: BUDGETS (LIMITS & SAFE DISCIPLINE)
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderBudgetsView() {
  const now = new Date();
  const curMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);

  // Calculate actual spending in current month per category
  const actualSpending = {};
  data.transactions
    .filter(t => t.type === 'expense' && getTxIso(t) >= curMonthStart)
    .forEach(t => {
      actualSpending[t.category] = (actualSpending[t.category] || 0) + Number(t.amount);
    });

  const totalLimit = data.budgets.reduce((s, b) => s + Number(b.limit_amount), 0);
  const totalSpent = data.budgets.reduce((s, b) => s + (actualSpending[b.category] || 0), 0);
  const overallPct = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0;

  const allAvailableCats = getAllCategories();

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Лимиты бюджета</h1>
        <p class="view-subtitle">Контроль месячных расходов без чувства вины, дисциплина трат и предупреждения.</p>
      </div>
    </div>

    <!-- Budgets Header Summary -->
    <div class="budget-summary-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Общий прогресс месячных лимитов</span>
        <span class="num" style="font-size: 13px; font-weight: 700; color: ${overallPct > 90 ? 'var(--accent-coral)' : 'var(--accent-jade)'};">${overallPct}% использовано</span>
      </div>
      <div class="progress-bar-track" style="height: 10px; margin-bottom: 12px;">
        <div class="progress-bar-fill ${overallPct > 90 ? 'danger' : ''}" style="width: ${overallPct}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px;">
        <span style="color: var(--text-muted);">Израсходовано: <strong class="num" style="color: #FFFFFF;">${money(totalSpent)}</strong></span>
        <span style="color: var(--text-muted);">Общий лимит: <strong class="num" style="color: #FFFFFF;">${money(totalLimit)}</strong></span>
      </div>
    </div>

    <!-- Create / Edit Budget Form with Category Quick Chips & Datalist -->
    <div class="create-card">
      <h3 style="font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 10px;">Установить или обновить лимит</h3>
      
      <!-- Category Quick Chips -->
      <div class="budget-quick-chips">
        <span class="budget-quick-lbl">Быстрый выбор:</span>
        <div class="budget-chips-stream">
          ${allAvailableCats.slice(0, 10).map(c => `
            <button type="button" class="budget-chip" data-cat="${esc(c)}">
              ${getCategoryIcon(c)} <span>${esc(c)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <datalist id="budget-categories-datalist">
        ${allAvailableCats.map(c => `<option value="${esc(c)}">`).join('')}
      </datalist>

      <form id="budget-form" style="display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 12px; margin-top: 12px;">
        <input class="form-input" id="budget-cat" list="budget-categories-datalist" placeholder="Категория (выберите или введите)" required>
        <input class="form-input num" id="budget-limit" type="number" min="1" step="any" placeholder="Сумма лимита (₽)" required>
        <button type="submit" class="btn-primary" style="height: 42px; justify-content: center;">
          ${icon('plus', 14)}
          <span>Сохранить</span>
        </button>
      </form>
    </div>

    <!-- Budget Cards Grid -->
    <div class="budget-grid">
      ${data.budgets.length > 0 ? data.budgets.map(b => {
        const spent = actualSpending[b.category] || 0;
        const lim = Number(b.limit_amount);
        const pct = Math.min(100, Math.round((spent / lim) * 100));
        const rem = lim - spent;
        const isExceeded = rem < 0;
        const catIcon = getCategoryIcon(b.category);
        const dailyAllowance = Math.max(0, Math.round(rem / daysLeft));

        return `
          <div class="budget-card ${isExceeded ? 'budget-card-exceeded' : ''}">
            <div class="budget-head">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="budget-cat-icon">${catIcon}</div>
                <div>
                  <div class="budget-cat-title">${esc(b.category)}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Месячный лимит: ${money(lim)}</div>
                </div>
              </div>
              <button class="budget-delete-btn" data-id="${b.id}" title="Удалить лимит">
                ${icon('trash', 12)}
              </button>
            </div>

            <div class="progress-bar-track" style="margin: 14px 0 10px;">
              <div class="progress-bar-fill ${isExceeded ? 'danger' : (pct > 80 ? 'warning' : '')}" style="width: ${pct}%;"></div>
            </div>

            <div class="budget-stats-row num">
              <div>
                <div style="color: var(--text-muted); font-size: 11px;">Потрачено</div>
                <div style="font-weight: 700; color: #FFFFFF; font-size: 14px;">${money(spent)} (${pct}%)</div>
              </div>
              <div style="text-align: right;">
                <div style="color: var(--text-muted); font-size: 11px;">${isExceeded ? 'Превышение' : 'Осталось'}</div>
                <div style="font-weight: 700; font-size: 14px; color: ${isExceeded ? 'var(--accent-coral)' : 'var(--accent-jade)'};">
                  ${isExceeded ? '+' : ''}${money(Math.abs(rem))}
                </div>
              </div>
            </div>

            <div class="budget-pace-box">
              ${isExceeded ? `
                <span class="badge-tag coral" style="width: 100%; justify-content: center;">
                  ⚠️ Превышение лимита на ${money(Math.abs(rem))}!
                </span>
              ` : `
                <span class="budget-pace-text">
                  Доступно: <strong class="num" style="color: var(--accent-jade);">${money(dailyAllowance)}</strong> в день (${daysLeft} дн. до конца месяца)
                </span>
              `}
            </div>
          </div>
        `;
      }).join('') : `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--bg-surface); border-radius: var(--r-lg); border: 1px dashed var(--border-medium);">
          <div style="color: var(--text-muted); margin-bottom: 8px;">Лимиты пока не заданы</div>
          <p style="color: var(--text-secondary); font-size: 13px;">Установите лимиты на Продукты, Кафе или Транспорт, чтобы контролировать бюджет и получать предупреждения при тратах.</p>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   VIEW 4: GOALS (CAPITAL ACCUMULATION)
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderGoalsView() {
  const totalTarget = data.goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = data.goals.reduce((s, g) => s + Number(g.saved_amount), 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Финансовые цели</h1>
        <p class="view-subtitle">Накопления на мечты, резервы и крупные приобретения.</p>
      </div>
    </div>

    <!-- Goals Summary Card -->
    <div class="budget-summary-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Суммарный прогресс по всем целям</span>
        <span class="num" style="font-size: 13px; font-weight: 700; color: var(--accent-jade);">${overallPct}% накоплено</span>
      </div>
      <div class="progress-bar-track" style="height: 10px; margin-bottom: 12px;">
        <div class="progress-bar-fill" style="width: ${overallPct}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px;">
        <span style="color: var(--text-muted);">Накоплено: <strong class="num" style="color: #FFFFFF;">${money(totalSaved)}</strong></span>
        <span style="color: var(--text-muted);">Целевой объем: <strong class="num" style="color: #FFFFFF;">${money(totalTarget)}</strong></span>
      </div>
    </div>

    <!-- Add Goal Form -->
    <div class="create-card">
      <h3 style="font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 12px;">Создать новую цель</h3>
      <form id="goal-form" style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr; gap: 12px;">
        <input class="form-input" id="goal-name" placeholder="Название (напр. Подушка безопасности)" required>
        <input class="form-input num" id="goal-target" type="number" min="1" step="any" placeholder="Целевая сумма (₽)" required>
        <input class="form-input num" id="goal-saved" type="number" min="0" step="any" placeholder="Уже есть (₽)">
        <button type="submit" class="btn-primary" style="height: 42px; justify-content: center;">
          ${icon('plus', 14)}
          <span>Создать</span>
        </button>
      </form>
    </div>

    <!-- Goals Grid -->
    <div class="goals-grid">
      ${data.goals.length > 0 ? data.goals.map(g => {
        const saved = Number(g.saved_amount) || 0;
        const target = Number(g.target_amount) || 1;
        const pct = Math.min(100, Math.round((saved / target) * 100));
        const rem = Math.max(0, target - saved);

        return `
          <div class="goal-card">
            <div class="goal-head">
              <div>
                <div class="goal-title">${esc(g.name)}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${pct}% от цели</div>
              </div>
              <button class="goal-delete-btn" data-id="${g.id}" title="Удалить цель">
                ${icon('trash', 12)}
              </button>
            </div>

            <div class="progress-bar-track" style="margin: 16px 0 12px;">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>

            <div class="goal-meta-row num">
              <div>
                <div style="color: var(--text-muted); font-size: 11px;">Собрано</div>
                <div style="font-weight: 700; color: #FFFFFF; font-size: 15px;">${money(saved)}</div>
              </div>
              <div style="text-align: right;">
                <div style="color: var(--text-muted); font-size: 11px;">Цель</div>
                <div style="font-weight: 700; color: var(--accent-jade); font-size: 15px;">${money(target)}</div>
              </div>
            </div>

            <!-- Quick Add to Goal -->
            <div class="goal-add-strip">
              <input class="form-input num goal-topup-input" data-id="${g.id}" type="number" min="1" step="any" placeholder="Сумма пополнения...">
              <button class="btn-primary goal-topup-btn" data-id="${g.id}" style="padding: 0 14px; height: 36px; font-size: 12px;">
                + Отложить
              </button>
            </div>
          </div>
        `;
      }).join('') : `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--bg-surface); border-radius: var(--r-lg); border: 1px dashed var(--border-medium);">
          <div style="color: var(--text-muted); margin-bottom: 8px;">Финансовые цели пока не созданы</div>
          <p style="color: var(--text-secondary); font-size: 13px;">Создайте цель «Подушка безопасности» или «Отпуск», чтобы формировать капитал.</p>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   VIEW 5: ASSISTANT (AI FINANCIAL MENTOR)
   CRITICAL RULE: NO "Добрый день" here!
   ========================================================================== */
function renderAssistantView() {
  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">ИИ-ассистент Finkaif</h1>
        <p class="view-subtitle">Персональный финансовый ментор: советы по распределению доходов, анализу трат и целям.</p>
      </div>
    </div>

    <div class="assistant-layout">
      <!-- Quick Prompt Suggestions -->
      <div class="assistant-sidebar">
        <div class="assistant-sidebar-title">ПОПУЛЯРНЫЕ ВОПРОСЫ</div>
        <div class="assistant-suggestions">
          <button class="suggestion-chip" data-prompt="Как распределить доход по правилу 50/30/20?">
            <span class="chip-sparkle">✦</span>
            <span>Как распределить доход по 50/30/20?</span>
          </button>
          <button class="suggestion-chip" data-prompt="Проанализируй мои расходы и дай совет, где оптимизировать траты">
            <span class="chip-sparkle">✦</span>
            <span>Где я трачу больше всего и как оптимизировать?</span>
          </button>
          <button class="suggestion-chip" data-prompt="Сколько мне нужно откладывать на подушку безопасности?">
            <span class="chip-sparkle">✦</span>
            <span>Размер финансовой подушки для моего бюджета</span>
          </button>
          <button class="suggestion-chip" data-prompt="Как быстрее закрыть финансовую цель?">
            <span class="chip-sparkle">✦</span>
            <span>Стратегия быстрого накопления на цели</span>
          </button>
        </div>

        <div class="assistant-note-card">
          <div style="font-weight: 600; color: #FFFFFF; font-size: 12px; margin-bottom: 4px;">Безопасность данных</div>
          <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">Ассистент оперирует только суммами категорий без персональных банковских реквизитов.</div>
        </div>
      </div>

      <!-- Chat Stream -->
      <div class="assistant-chat-panel">
        <div class="chat-stream" id="chat-stream-box">
          ${data.chat.length > 0 ? data.chat.map(m => `
            <div class="chat-bubble ${m.role}">
              ${m.role === 'assistant' ? `
                <div class="chat-author">
                  ${icon('assistant', 13)}
                  <span>Finkaif Mentor</span>
                </div>
              ` : ''}
              <div class="chat-body">${formatMarkdown(m.content)}</div>
            </div>
          `).join('') : `
            <div class="chat-empty-state">
              <div class="chat-empty-icon">
                ${icon('assistant', 24)}
              </div>
              <h3 style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin-bottom: 6px;">Чем могу помочь сегодня?</h3>
              <p style="font-size: 13px; color: var(--text-secondary); max-width: 420px; margin: 0 auto;">
                Спросите, сколько откладывать на отпуск, как распределить зарплату или оценить комфортность текущего темпа расходов.
              </p>
            </div>
          `}
        </div>

        <form class="chat-input-bar" id="assistant-form">
          <input id="assistant-input" placeholder="Задайте вопрос о доходах, расходах, целях..." required autocomplete="off">
          <button type="submit" class="chat-send-btn" title="Отправить">
            ${icon('send', 15)}
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   MODAL 1: NEW OPERATION
   ========================================================================== */
function renderModal() {
  const allCats = getAllCategories();

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

        <datalist id="tx-categories-datalist">
          ${allCats.map(c => `<option value="${esc(c)}">`).join('')}
        </datalist>

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
              <input class="form-input" id="form-category" list="tx-categories-datalist" value="Продукты" placeholder="Напр. Кафе" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Сумма (${currencySymbols[profile.currency] || '₽'})</label>
              <input class="form-input num" id="form-amount" type="number" min="1" step="any" placeholder="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input class="form-input" id="form-date" type="date" value="${toDateIso(new Date())}" required>
            </div>
          </div>

          <!-- Live Budget Control Indicator -->
          <div id="tx-budget-warning" class="tx-budget-banner" style="display: none;"></div>

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
   MODAL 2: USER PROFILE & CUSTOMIZATION
   ========================================================================== */
function renderProfileModal() {
  const rawUser = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';
  const userName = profile.display_name ? profile.display_name : rawUser;
  const userInitial = rawUser.charAt(0).toUpperCase();

  const currentBal = data.transactions.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  const rank = getFinancialRank(currentBal, data.goals);

  const emojiList = ['🦁', '⚡', '💎', '🦅', '🚀', '👑', '🧘', '💼', '🎯', '🔥', '🐉', '🏆'];

  return `
    <div id="profile-modal" class="modal-backdrop" style="display: ${profileModalOpen ? 'flex' : 'none'};">
      <div class="modal-card profile-dialog">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">⚙️</span>
            <h3 class="modal-title">Профиль и персонализация</h3>
          </div>
          <button class="btn-icon" id="btn-close-profile">${icon('close', 16)}</button>
        </div>

        <!-- Identity Banner -->
        <div class="profile-identity-banner">
          <div class="profile-big-avatar" id="profile-avatar-preview">
            ${profile.avatar && profile.avatar !== 'monogram' ? profile.avatar : userInitial}
          </div>
          <div class="profile-identity-info">
            <div class="profile-name-title">${esc(userName)}</div>
            <div class="profile-email-sub">${esc(me?.email || 'investor@finkaif.ru')}</div>
            <div class="profile-rank-badge">
              <span>${rank.badge}</span>
              <span>${rank.title}</span>
            </div>
          </div>
        </div>

        <form id="profile-form">
          <!-- Avatar Choice -->
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Выберите аватар</label>
            <div class="avatar-grid">
              <button type="button" class="avatar-opt-btn ${(!profile.avatar || profile.avatar === 'monogram') ? 'active' : ''}" data-avatar="monogram" title="Монограмма">
                ${userInitial}
              </button>
              ${emojiList.map(em => `
                <button type="button" class="avatar-opt-btn ${profile.avatar === em ? 'active' : ''}" data-avatar="${em}">
                  ${em}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Display Name -->
          <div class="form-group">
            <label class="form-label">Имя или псевдоним</label>
            <input class="form-input" id="profile-input-name" value="${esc(profile.display_name)}" placeholder="Например: Никита">
          </div>

          <!-- Currency Selector -->
          <div class="form-group">
            <label class="form-label">Основная валюта интерфейса</label>
            <div class="currency-pills-grid">
              <button type="button" class="currency-pill-btn ${profile.currency === 'RUB' ? 'active' : ''}" data-currency="RUB">
                ₽ RUB (Рубль)
              </button>
              <button type="button" class="currency-pill-btn ${profile.currency === 'USD' ? 'active' : ''}" data-currency="USD">
                $ USD (Доллар)
              </button>
              <button type="button" class="currency-pill-btn ${profile.currency === 'EUR' ? 'active' : ''}" data-currency="EUR">
                € EUR (Евро)
              </button>
              <button type="button" class="currency-pill-btn ${profile.currency === 'KZT' ? 'active' : ''}" data-currency="KZT">
                ₸ KZT (Тенге)
              </button>
            </div>
          </div>

          <button type="submit" class="btn-submit" style="margin-top: 14px;">
            Сохранить настройки
          </button>
        </form>

        <!-- Logout Action -->
        <div class="profile-logout-footer">
          <button type="button" class="btn-logout" id="btn-profile-logout">
            Выйти из аккаунта
          </button>
        </div>
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
  else if (tab === 'analytics') viewHtml = renderAnalyticsView();
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
      ${renderProfileModal()}
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
        submitBtn.innerText = 'Секунду...';
        const res = await api('auth/' + mode, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (res.token) localStorage.setItem('finkaif_token', res.token);
        me = res.user;

        // Fetch profile settings
        try {
          const prof = await api('profile');
          if (prof) {
            profile.display_name = prof.display_name || '';
            profile.avatar = prof.avatar || '⚡';
            if (prof.currency) profile.currency = prof.currency;
          }
        } catch { }

        await refreshAllData();
        renderApp();
      } catch (err) {
        alert(err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
      }
    };
  }
}

function bindInteractiveEvents() {
  // Navigation Tabs
  $$('.nav-item').forEach(btn => {
    btn.onclick = () => {
      tab = btn.getAttribute('data-tab');
      window.location.hash = tab;
      renderApp();
    };
  });

  $$('[data-tab]').forEach(el => {
    if (!el.classList.contains('nav-item')) {
      el.onclick = () => {
        tab = el.getAttribute('data-tab');
        if (el.getAttribute('data-cat')) {
          activeAnalyticsCat = el.getAttribute('data-cat');
        }
        window.location.hash = tab;
        renderApp();
      };
    }
  });

  // Profile Modal Toggle
  const userProfileBtn = document.getElementById('user-profile-btn');
  if (userProfileBtn) {
    userProfileBtn.onclick = () => {
      profileModalOpen = true;
      renderApp();
    };
  }

  const btnCloseProfile = document.getElementById('btn-close-profile');
  if (btnCloseProfile) {
    btnCloseProfile.onclick = () => {
      profileModalOpen = false;
      renderApp();
    };
  }

  const profileModalBackdrop = document.getElementById('profile-modal');
  if (profileModalBackdrop) {
    profileModalBackdrop.onclick = e => {
      if (e.target === profileModalBackdrop) {
        profileModalOpen = false;
        renderApp();
      }
    };
  }

  // Avatar Selection
  $$('.avatar-opt-btn').forEach(btn => {
    btn.onclick = () => {
      const av = btn.getAttribute('data-avatar');
      profile.avatar = av;
      $$('.avatar-opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preview = document.getElementById('profile-avatar-preview');
      if (preview) {
        const rawUser = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';
        preview.innerText = av === 'monogram' ? rawUser.charAt(0).toUpperCase() : av;
      }
    };
  });

  // Currency Selection
  $$('.currency-pill-btn').forEach(btn => {
    btn.onclick = () => {
      const cur = btn.getAttribute('data-currency');
      profile.currency = cur;
      $$('.currency-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  // Profile Form Save
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async e => {
      e.preventDefault();
      const inputName = document.getElementById('profile-input-name');
      profile.display_name = inputName ? inputName.value.trim() : '';

      localStorage.setItem('finkaif_name', profile.display_name);
      localStorage.setItem('finkaif_avatar', profile.avatar);
      localStorage.setItem('finkaif_currency', profile.currency);

      try {
        await api('profile', {
          method: 'POST',
          body: JSON.stringify({
            display_name: profile.display_name,
            avatar: profile.avatar,
            currency: profile.currency
          })
        });
      } catch (err) {
        console.warn('Profile sync warning:', err.message);
      }

      profileModalOpen = false;
      renderApp();
    };
  }

  // Profile Logout
  const btnProfileLogout = document.getElementById('btn-profile-logout');
  if (btnProfileLogout) {
    btnProfileLogout.onclick = async () => {
      if (confirm('Вы действительно хотите выйти из аккаунта?')) {
        await api('auth/logout', { method: 'POST' }).catch(() => {});
        localStorage.removeItem('finkaif_token');
        me = null;
        profileModalOpen = false;
        renderApp();
      }
    };
  }

  // Period Tabs on Home View
  $$('.period-tab').forEach(btn => {
    btn.onclick = () => {
      period = btn.getAttribute('data-period');
      renderApp();
    };
  });

  // Analytics Period Buttons
  $$('.analytics-period-btn').forEach(btn => {
    btn.onclick = () => {
      analyticsPeriod = btn.getAttribute('data-aperiod');
      renderApp();
    };
  });

  // Analytics Donut Segment & Legend In-Place Hover Interactions
  const updateDonutCenter = (cat, amt, pct, icon) => {
    const center = document.getElementById('donut-center-info');
    if (!center) return;
    if (cat) {
      center.innerHTML = `
        <div class="donut-center-icon">${icon || '💳'}</div>
        <div class="donut-center-amt num">${money(amt)}</div>
        <div class="donut-center-cat" title="${esc(cat)}">${esc(cat)}</div>
        <div class="donut-center-badge">${pct}% трат</div>
      `;
    } else {
      const defaultAmt = center.getAttribute('data-default-amt') || 0;
      const defaultCount = center.getAttribute('data-default-count') || 0;
      center.innerHTML = `
        <div class="donut-center-lbl">ВСЕГО ТРАТ</div>
        <div class="donut-center-amt num">${money(defaultAmt)}</div>
        <div class="donut-center-badge jade">${defaultCount} ${pluralizeCats(defaultCount)}</div>
      `;
    }
  };

  const highlightCategory = (cat, amt, pct, icon) => {
    updateDonutCenter(cat, amt, pct, icon);
    const segments = $$('.donut-segment');
    const items = $$('.donut-cat-item');

    if (cat) {
      segments.forEach(s => {
        if (s.getAttribute('data-cat') === cat) {
          s.classList.add('focused');
          s.classList.remove('dimmed');
          s.setAttribute('stroke-width', '20');
        } else {
          s.classList.remove('focused');
          s.classList.add('dimmed');
          s.setAttribute('stroke-width', '16');
        }
      });
      items.forEach(it => {
        if (it.getAttribute('data-cat') === cat) {
          it.classList.add('hovered');
          it.classList.remove('dimmed');
        } else {
          it.classList.remove('hovered');
          it.classList.add('dimmed');
        }
      });
    } else {
      segments.forEach(s => {
        const isAct = s.getAttribute('data-cat') === activeAnalyticsCat;
        s.classList.toggle('focused', isAct);
        s.classList.remove('dimmed');
        s.setAttribute('stroke-width', isAct ? '20' : '16');
      });
      items.forEach(it => {
        const isAct = it.getAttribute('data-cat') === activeAnalyticsCat;
        it.classList.toggle('selected', isAct);
        it.classList.remove('hovered', 'dimmed');
      });
    }
  };

  $$('.donut-segment').forEach(seg => {
    const cat = seg.getAttribute('data-cat');
    const amt = seg.getAttribute('data-amt');
    const pct = seg.getAttribute('data-pct');
    const icon = seg.getAttribute('data-icon');

    seg.onmouseenter = () => highlightCategory(cat, amt, pct, icon);
    seg.onmouseleave = () => {
      if (activeAnalyticsCat) {
        const actSeg = document.querySelector(`.donut-segment[data-cat="${activeAnalyticsCat}"]`);
        if (actSeg) {
          highlightCategory(
            activeAnalyticsCat,
            actSeg.getAttribute('data-amt'),
            actSeg.getAttribute('data-pct'),
            actSeg.getAttribute('data-icon')
          );
        } else {
          highlightCategory(null);
        }
      } else {
        highlightCategory(null);
      }
    };
    seg.onclick = () => {
      activeAnalyticsCat = activeAnalyticsCat === cat ? null : cat;
      renderApp();
    };
  });

  $$('.donut-cat-item').forEach(item => {
    const cat = item.getAttribute('data-cat');
    const amt = item.getAttribute('data-amt');
    const pct = item.getAttribute('data-pct');
    const icon = item.getAttribute('data-icon');

    item.onmouseenter = () => highlightCategory(cat, amt, pct, icon);
    item.onmouseleave = () => {
      if (activeAnalyticsCat) {
        const actSeg = document.querySelector(`.donut-segment[data-cat="${activeAnalyticsCat}"]`);
        if (actSeg) {
          highlightCategory(
            activeAnalyticsCat,
            actSeg.getAttribute('data-amt'),
            actSeg.getAttribute('data-pct'),
            actSeg.getAttribute('data-icon')
          );
        } else {
          highlightCategory(null);
        }
      } else {
        highlightCategory(null);
      }
    };
    item.onclick = () => {
      activeAnalyticsCat = activeAnalyticsCat === cat ? null : cat;
      renderApp();
    };
  });

  // Home Balance Chart Dynamic Continuous Scrubber & Time Tracker
  const homeWrap = document.getElementById('home-chart-wrap');
  const homeTooltip = document.getElementById('home-chart-tooltip');
  const homeScrubberLaser = document.getElementById('home-scrubber-laser');
  const homeScrubberBeacon = document.getElementById('home-scrubber-beacon');
  const homeTerminalBeacon = document.getElementById('home-terminal-beacon');
  const heroBalVal = document.getElementById('hero-balance-val');
  const heroBalLbl = document.getElementById('hero-balance-lbl');

  if (homeWrap && homeTooltip && window.__homePoints && window.__homePoints.length > 0) {
    const pts = window.__homePoints;
    const svgW = 760;
    const svgH = window.__homeSvgH || 120;
    const plotCanvasH = 122;
    const baseBalText = heroBalVal ? heroBalVal.getAttribute('data-base') : '';
    const segments = pts.__splineSegments || [];
    const N = pts.length;
    const currentPeriod = window.__homePeriod || '7d';

    // Midpoints between adjacent dates for continuous time zones
    const mids = [];
    for (let i = 0; i < N - 1; i++) {
      mids.push((pts[i].x + pts[i + 1].x) / 2);
    }

    homeWrap.onmousemove = e => {
      const rect = homeWrap.getBoundingClientRect();
      if (!rect.width || rect.width <= 0) return;

      const mousePxX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const targetSvgX = (mousePxX / rect.width) * svgW;

      const minX = pts[0].x;
      const maxX = pts[pts.length - 1].x;
      const clampedX = Math.max(minX, Math.min(targetSvgX, maxX));

      // Continuous Bezier Spline evaluation for Y and balance
      let seg = segments.find(s => clampedX >= s.x0 && clampedX <= s.x1);
      if (!seg) {
        if (clampedX <= minX) seg = segments[0];
        else seg = segments[segments.length - 1];
      }

      let curBal = pts[0].balance;
      let svgY = pts[0].y;

      if (seg) {
        const segSpan = seg.x1 - seg.x0 || 1;
        const t = Math.max(0, Math.min(1, (clampedX - seg.x0) / segSpan));
        svgY = evaluateBezierY(seg.y0, seg.cp1y, seg.cp2y, seg.y1, t);
        curBal = Math.round(seg.bal0 + (seg.bal1 - seg.bal0) * t);
      }

      // Calculate Day and Time progression
      let dayIdx = 0;
      let dayT = 0;

      if (clampedX <= mids[0]) {
        dayIdx = 0;
        dayT = (clampedX - minX) / (mids[0] - minX || 1);
      } else if (clampedX >= mids[N - 2]) {
        dayIdx = N - 1;
        dayT = (clampedX - mids[N - 2]) / (maxX - mids[N - 2] || 1);
      } else {
        for (let i = 0; i < mids.length - 1; i++) {
          if (clampedX >= mids[i] && clampedX <= mids[i + 1]) {
            dayIdx = i + 1;
            dayT = (clampedX - mids[i]) / (mids[i + 1] - mids[i] || 1);
            break;
          }
        }
      }

      const activePt = pts[dayIdx] || pts[0];

      // Time progression string
      let timeStr = '12:00';
      if (currentPeriod === 'year') {
        const dayOfMonth = Math.max(1, Math.min(30, Math.floor(dayT * 30) + 1));
        timeStr = `${dayOfMonth} число`;
      } else {
        let maxDayMinutes = 24 * 60;
        const isToday = (dayIdx === N - 1 && currentPeriod === '7d');
        if (isToday) {
          const nowDate = new Date();
          maxDayMinutes = Math.max(60, nowDate.getHours() * 60 + nowDate.getMinutes());
        }
        const totalMins = Math.min(maxDayMinutes, Math.floor(dayT * maxDayMinutes));
        const hours = Math.min(23, Math.floor(totalMins / 60));
        const mins = Math.min(50, Math.floor((totalMins % 60) / 10) * 10);
        timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }

      // Exact pixel coordinates in plot container
      const pxX = (clampedX / svgW) * rect.width;
      const pxY = (svgY / svgH) * plotCanvasH;

      // Glide laser line and beacon smoothly with sub-pixel precision
      if (homeScrubberLaser) {
        homeScrubberLaser.style.left = `${pxX}px`;
        homeScrubberLaser.style.opacity = '1';
      }

      if (homeScrubberBeacon) {
        homeScrubberBeacon.style.left = `${pxX}px`;
        homeScrubberBeacon.style.top = `${pxY}px`;
        homeScrubberBeacon.style.opacity = '1';
      }

      if (homeTerminalBeacon) {
        homeTerminalBeacon.style.opacity = '0';
      }

      // Update date axis active indicator
      document.querySelectorAll('.home-axis-item').forEach(el => {
        const idx = Number(el.getAttribute('data-idx'));
        if (idx === dayIdx) el.classList.add('active');
        else el.classList.remove('active');
      });

      if (heroBalVal) {
        heroBalVal.innerText = money(curBal);
      }
      if (heroBalLbl) {
        heroBalLbl.innerHTML = `Остаток на ${esc(activePt.dayDisplay || activePt.dayLabel)} • <span class="num" style="color: #FFFFFF; font-weight: 700;">${timeStr}</span>`;
      }

      let deltaHtml = '';
      if (activePt.inc > 0 && activePt.exp > 0) {
        deltaHtml = `
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <span class="chart-tooltip-badge" style="color: var(--accent-jade); background: rgba(45,212,191,0.12); padding: 2px 6px; border-radius: 4px;">+${money(activePt.inc)}</span>
            <span class="chart-tooltip-badge" style="color: var(--accent-coral); background: rgba(251,113,133,0.12); padding: 2px 6px; border-radius: 4px;">−${money(activePt.exp)}</span>
          </div>
        `;
      } else if (activePt.inc > 0) {
        deltaHtml = `<div class="chart-tooltip-badge" style="color: var(--accent-jade); margin-top: 4px;">+${money(activePt.inc)} доход</div>`;
      } else if (activePt.exp > 0) {
        deltaHtml = `<div class="chart-tooltip-badge" style="color: var(--accent-coral); margin-top: 4px;">−${money(activePt.exp)} расход</div>`;
      } else {
        deltaHtml = `<div class="chart-tooltip-badge" style="color: var(--text-muted); margin-top: 4px; font-size: 11px;">Операций в этот день не было</div>`;
      }

      homeTooltip.innerHTML = `
        <div class="chart-tooltip-header">
          <span class="chart-tooltip-title">${esc(activePt.fullDate || activePt.dayDisplay || activePt.dayLabel)}</span>
          <span class="chart-tooltip-clock">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${timeStr}
          </span>
        </div>
        <div class="chart-tooltip-value num">${money(curBal)}</div>
        ${deltaHtml}
      `;

      // Center tooltip on cursor, constrained within chart bounds
      const tooltipW = 175;
      let leftPos = pxX;
      if (leftPos + tooltipW / 2 > rect.width) {
        leftPos = rect.width - tooltipW / 2 - 8;
      } else if (leftPos - tooltipW / 2 < 0) {
        leftPos = tooltipW / 2 + 8;
      }

      homeTooltip.style.left = `${leftPos}px`;
      homeTooltip.style.top = `${Math.max(8, pxY - 14)}px`;
      homeTooltip.classList.add('visible');
    };

    homeWrap.onmouseleave = () => {
      if (homeScrubberLaser) homeScrubberLaser.style.opacity = '0';
      if (homeScrubberBeacon) homeScrubberBeacon.style.opacity = '0';
      if (homeTerminalBeacon) homeTerminalBeacon.style.opacity = '1';
      document.querySelectorAll('.home-axis-item').forEach(el => el.classList.remove('active'));
      homeTooltip.classList.remove('visible');

      if (heroBalVal && baseBalText) {
        heroBalVal.innerText = baseBalText;
      }
      if (heroBalLbl) {
        heroBalLbl.innerText = 'Чистый свободный остаток';
      }
    };
  }

  // Cashflow Dual Wave Dynamic Scrubber & Tooltip
  const cfWrap = document.getElementById('cf-chart-wrap');
  const cfTooltip = document.getElementById('cf-chart-tooltip');
  const cfLine = document.getElementById('cf-scrubber-line');
  const cfDotInc = document.getElementById('cf-scrubber-inc');
  const cfDotExp = document.getElementById('cf-scrubber-exp');

  if (cfWrap && cfTooltip && window.__cfPoints && window.__cfPoints.length > 0) {
    const cfPts = window.__cfPoints;
    const cfW = 760;
    const cfH = 150;

    cfWrap.onmousemove = e => {
      const rect = cfWrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scaleX = cfW / rect.width;
      const targetSvgX = mouseX * scaleX;

      let closest = cfPts[0];
      let minDx = Math.abs(cfPts[0].x - targetSvgX);
      for (let i = 1; i < cfPts.length; i++) {
        const dx = Math.abs(cfPts[i].x - targetSvgX);
        if (dx < minDx) {
          minDx = dx;
          closest = cfPts[i];
        }
      }

      if (cfLine) {
        cfLine.setAttribute('x1', closest.x);
        cfLine.setAttribute('x2', closest.x);
        cfLine.style.opacity = '1';
      }

      if (cfDotInc) {
        cfDotInc.setAttribute('cx', closest.x);
        cfDotInc.setAttribute('cy', closest.yInc);
        cfDotInc.style.opacity = closest.inc > 0 ? '1' : '0.35';
      }

      if (cfDotExp) {
        cfDotExp.setAttribute('cx', closest.x);
        cfDotExp.setAttribute('cy', closest.yExp);
        cfDotExp.style.opacity = closest.exp > 0 ? '1' : '0.35';
      }

      const dNet = closest.inc - closest.exp;
      cfTooltip.innerHTML = `
        <div class="chart-tooltip-title">${esc(closest.fullDate || closest.dayLabel)}</div>
        <div style="display: flex; gap: 10px; margin-top: 2px;">
          <span style="color: var(--accent-jade); font-weight: 700;">+${money(closest.inc)}</span>
          <span style="color: var(--accent-amber); font-weight: 700;">−${money(closest.exp)}</span>
        </div>
        <div style="font-size: 11px; color: ${dNet >= 0 ? 'var(--accent-jade)' : 'var(--accent-coral)'}; margin-top: 3px;">
          Чистый поток: ${dNet >= 0 ? '+' : ''}${money(dNet)}
        </div>
      `;

      const pxX = (closest.x / cfW) * rect.width;
      const minY = Math.min(closest.yInc, closest.yExp);
      const pxY = (minY / cfH) * rect.height;

      cfTooltip.style.left = `${pxX}px`;
      cfTooltip.style.top = `${pxY}px`;
      cfTooltip.classList.add('visible');
    };

    cfWrap.onmouseleave = () => {
      if (cfLine) cfLine.style.opacity = '0';
      if (cfDotInc) cfDotInc.style.opacity = '0';
      if (cfDotExp) cfDotExp.style.opacity = '0';
      cfTooltip.classList.remove('visible');
    };
  }

  const btnResetDonut = document.getElementById('btn-reset-donut-filter');
  if (btnResetDonut) {
    btnResetDonut.onclick = () => {
      activeAnalyticsCat = null;
      renderApp();
    };
  }

  const btnResetDrilldown = document.getElementById('btn-reset-drilldown');
  if (btnResetDrilldown) {
    btnResetDrilldown.onclick = () => {
      activeAnalyticsCat = null;
      renderApp();
    };
  }

  // Quick Action Buttons
  const btnQuickNew = document.getElementById('btn-quick-new');
  const btnFirstOp = document.getElementById('btn-first-op');
  const btnAddTxView = document.getElementById('btn-add-tx-view');
  const qAddExp = document.getElementById('quick-add-expense');
  const qAddInc = document.getElementById('quick-add-income');

  const updateModalBudgetAlert = () => {
    const type = document.getElementById('form-type')?.value;
    const cat = document.getElementById('form-category')?.value.trim();
    const amt = Number(document.getElementById('form-amount')?.value) || 0;
    const banner = document.getElementById('tx-budget-warning');
    if (!banner) return;

    if (type !== 'expense' || !cat) {
      banner.style.display = 'none';
      return;
    }

    const budget = (data.budgets || []).find(b => b.category.toLowerCase() === cat.toLowerCase());
    if (!budget) {
      banner.className = 'tx-budget-banner muted';
      banner.innerHTML = `<span>ℹ️ По категории «${esc(cat)}» лимит не установлен</span>`;
      banner.style.display = 'block';
      return;
    }

    const now = new Date();
    const curMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
    const spentThisMonth = (data.transactions || [])
      .filter(t => t.type === 'expense' && (t.category || '').toLowerCase() === cat.toLowerCase() && getTxIso(t) >= curMonthStart)
      .reduce((s, t) => s + Number(t.amount), 0);

    const lim = Number(budget.limit_amount);
    const newTotal = spentThisMonth + amt;

    if (newTotal > lim) {
      const overspend = newTotal - lim;
      banner.className = 'tx-budget-banner danger';
      banner.innerHTML = `
        <div style="font-weight: 700;">⚠️ Внимание! Превышение лимита бюджета</div>
        <div style="font-size: 11.5px; margin-top: 2px;">
          Лимит: ${money(lim)} • Уже потрачено: ${money(spentThisMonth)}<br>
          С учетом этой операции (${money(amt)}) превышение составит <strong class="num" style="color: #FFF;">${money(overspend)}</strong>!
        </div>
      `;
      banner.style.display = 'block';
    } else if (newTotal >= lim * 0.8) {
      banner.className = 'tx-budget-banner warning';
      banner.innerHTML = `
        <div style="font-weight: 700;">⚡ Внимание: приближение к лимиту</div>
        <div style="font-size: 11.5px; margin-top: 2px;">
          Лимит: ${money(lim)} • Останется всего: <strong class="num" style="color: #FFF;">${money(lim - newTotal)}</strong> (${Math.round((newTotal / lim) * 100)}% лимита).
        </div>
      `;
      banner.style.display = 'block';
    } else {
      banner.className = 'tx-budget-banner safe';
      banner.innerHTML = `
        <div>✓ В рамках бюджета: останется <strong class="num" style="color: #FFF;">${money(lim - newTotal)}</strong> из ${money(lim)}</div>
      `;
      banner.style.display = 'block';
    }
  };

  const openTxModal = (type = 'expense') => {
    const modal = document.getElementById('tx-modal');
    if (modal) {
      modal.style.display = 'flex';
      const typeSelect = document.getElementById('form-type');
      if (typeSelect) typeSelect.value = type;
      updateModalBudgetAlert();
    }
  };

  if (btnQuickNew) btnQuickNew.onclick = () => openTxModal('expense');
  if (btnFirstOp) btnFirstOp.onclick = () => openTxModal('expense');
  if (btnAddTxView) btnAddTxView.onclick = () => openTxModal('expense');
  if (qAddExp) qAddExp.onclick = () => openTxModal('expense');
  if (qAddInc) qAddInc.onclick = () => openTxModal('income');

  const btnCloseModal = document.getElementById('btn-close-modal');
  if (btnCloseModal) {
    btnCloseModal.onclick = () => {
      const modal = document.getElementById('tx-modal');
      if (modal) modal.style.display = 'none';
    };
  }

  // Category Chips inside Modal
  $$('.cat-chip').forEach(chip => {
    chip.onclick = () => {
      $$('.cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      const cat = chip.getAttribute('data-cat');
      const catType = chip.getAttribute('data-type');
      const catInput = document.getElementById('form-category');
      const typeSelect = document.getElementById('form-type');
      if (catInput) catInput.value = cat;
      if (typeSelect) typeSelect.value = catType;
      updateModalBudgetAlert();
    };
  });

  // Modal Inputs dynamic budget warning
  const modalCatInput = document.getElementById('form-category');
  const modalAmtInput = document.getElementById('form-amount');
  const modalTypeSelect = document.getElementById('form-type');
  if (modalCatInput) modalCatInput.oninput = updateModalBudgetAlert;
  if (modalAmtInput) modalAmtInput.oninput = updateModalBudgetAlert;
  if (modalTypeSelect) modalTypeSelect.onchange = updateModalBudgetAlert;

  // Modal Form Submit (Create Transaction with Budget Protection)
  const txModalForm = document.getElementById('tx-modal-form');
  if (txModalForm) {
    txModalForm.onsubmit = async e => {
      e.preventDefault();
      const type = document.getElementById('form-type').value;
      const category = document.getElementById('form-category').value.trim();
      const amount = Number(document.getElementById('form-amount').value);
      const occurred_on = document.getElementById('form-date').value;
      const description = document.getElementById('form-desc').value.trim();

      if (!category || amount <= 0) {
        alert('Заполните категорию и сумму операции');
        return;
      }

      // Budget Enforcement Protection
      if (type === 'expense') {
        const budget = (data.budgets || []).find(b => b.category.toLowerCase() === category.toLowerCase());
        if (budget) {
          const now = new Date();
          const curMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
          const spentThisMonth = (data.transactions || [])
            .filter(t => t.type === 'expense' && (t.category || '').toLowerCase() === category.toLowerCase() && getTxIso(t) >= curMonthStart)
            .reduce((s, t) => s + Number(t.amount), 0);

          const lim = Number(budget.limit_amount);
          const newTotal = spentThisMonth + amount;
          if (newTotal > lim) {
            const overspend = newTotal - lim;
            const ok = confirm(`⚠️ Внимание! Превышение лимита бюджета!\n\nКатегория «${category}» имеет установленный лимит ${money(lim)} в месяц.\nУже израсходовано в этом месяце: ${money(spentThisMonth)}.\n\nС добавлением этой записи (${money(amount)}) расходы превысят лимит на ${money(overspend)}!\n\nВы точно хотите зафиксировать этот расход сверх лимита?`);
            if (!ok) return;
          }
        }
      }

      try {
        await api('transactions', {
          method: 'POST',
          body: JSON.stringify({ type, category, amount, occurred_on, description })
        });
        const modal = document.getElementById('tx-modal');
        if (modal) modal.style.display = 'none';
        await refreshAllData();
        renderApp();
      } catch (err) {
        alert('Ошибка добавления операции: ' + err.message);
      }
    };
  }

  // Budget Quick Chips selection
  $$('.budget-chip').forEach(chip => {
    chip.onclick = () => {
      const cat = chip.getAttribute('data-cat');
      const catInput = document.getElementById('budget-cat');
      const limitInput = document.getElementById('budget-limit');
      if (catInput) catInput.value = cat;
      if (limitInput) limitInput.focus();
    };
  });

  // Transaction Filters & Search
  $$('.filter-tab').forEach(btn => {
    btn.onclick = () => {
      txFilter = btn.getAttribute('data-filter');
      renderApp();
    };
  });

  const searchInput = document.getElementById('tx-search-input');
  if (searchInput) {
    searchInput.oninput = e => {
      txSearch = e.target.value;
      renderApp();
      const newInp = document.getElementById('tx-search-input');
      if (newInp) {
        newInp.focus();
        newInp.setSelectionRange(newInp.value.length, newInp.value.length);
      }
    };
  }

  const btnClearSearch = document.getElementById('btn-clear-search');
  if (btnClearSearch) {
    btnClearSearch.onclick = () => {
      txSearch = '';
      renderApp();
    };
  }

  // Delete Transaction
  $$('.tx-delete-btn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Удалить эту операцию?')) {
        try {
          await api('transactions/' + id, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          alert('Ошибка удаления: ' + err.message);
        }
      }
    };
  });

  // Budgets: Create / Update
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.onsubmit = async e => {
      e.preventDefault();
      const category = document.getElementById('budget-cat').value.trim();
      const limit_amount = Number(document.getElementById('budget-limit').value);
      if (!category || limit_amount <= 0) return;

      try {
        await api('budgets', {
          method: 'POST',
          body: JSON.stringify({ category, limit_amount })
        });
        await refreshAllData();
        renderApp();
      } catch (err) {
        alert('Ошибка сохранения бюджета: ' + err.message);
      }
    };
  }

  // Budgets: Delete
  $$('.budget-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Удалить этот лимит?')) {
        try {
          await api('budgets/' + id, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          alert('Ошибка удаления: ' + err.message);
        }
      }
    };
  });

  // Goals: Create
  const goalForm = document.getElementById('goal-form');
  if (goalForm) {
    goalForm.onsubmit = async e => {
      e.preventDefault();
      const name = document.getElementById('goal-name').value.trim();
      const target_amount = Number(document.getElementById('goal-target').value);
      const saved_amount = Number(document.getElementById('goal-saved').value) || 0;
      if (!name || target_amount <= 0) return;

      try {
        await api('goals', {
          method: 'POST',
          body: JSON.stringify({ name, target_amount, saved_amount })
        });
        await refreshAllData();
        renderApp();
      } catch (err) {
        alert('Ошибка создания цели: ' + err.message);
      }
    };
  }

  // Goals: Delete
  $$('.goal-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Удалить эту цель?')) {
        try {
          await api('goals/' + id, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          alert('Ошибка удаления: ' + err.message);
        }
      }
    };
  });

  // Goals: Top-up / Add saved amount
  $$('.goal-topup-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const input = document.querySelector(`.goal-topup-input[data-id="${id}"]`);
      const addVal = Number(input?.value);
      if (!addVal || addVal <= 0) return;

      const targetGoal = data.goals.find(g => g.id === id);
      if (!targetGoal) return;

      const newSaved = Number(targetGoal.saved_amount) + addVal;
      try {
        await api('goals/' + id, {
          method: 'PUT',
          body: JSON.stringify({ saved_amount: newSaved })
        });
        await refreshAllData();
        renderApp();
      } catch (err) {
        alert('Ошибка пополнения: ' + err.message);
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

      // Append user message
      data.chat.push({ role: 'user', content: text, created_at: new Date().toISOString() });
      // Temporary typing indicator
      const tempId = 'thinking-' + Date.now();
      data.chat.push({ id: tempId, role: 'assistant', content: '⏳ *Анализирую ваши финансовые потоки и баланс...*', created_at: new Date().toISOString() });
      renderApp();

      const chatBox = document.getElementById('chat-stream-box');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

      try {
        let res;
        try {
          res = await api('assistant', {
            method: 'POST',
            body: JSON.stringify({ question: text, message: text })
          });
        } catch {
          res = await api('chat', {
            method: 'POST',
            body: JSON.stringify({ question: text, message: text })
          });
        }

        data.chat = data.chat.filter(m => m.id !== tempId);
        const answer = res.answer || res.reply || 'Я проанализировал ваши данные. Проверьте текущий баланс и лимиты трат.';
        data.chat.push({ role: 'assistant', content: answer, created_at: new Date().toISOString() });
        renderApp();
        const chatBoxAfter = document.getElementById('chat-stream-box');
        if (chatBoxAfter) chatBoxAfter.scrollTop = chatBoxAfter.scrollHeight;
      } catch (err) {
        data.chat = data.chat.filter(m => m.id !== tempId);
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
   INITIALIZATION & DATA REFRESH
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
  if (['home', 'analytics', 'transactions', 'budgets', 'goals', 'assistant'].includes(h)) {
    tab = h;
    renderApp();
  }
}

async function boot() {
  initAmbientCanvas();

  const initHash = window.location.hash.replace('#', '');
  if (['home', 'analytics', 'transactions', 'budgets', 'goals', 'assistant'].includes(initHash)) {
    tab = initHash;
  }

  try {
    const userRes = await api('me');
    me = userRes.user;

    // Load profile
    try {
      const prof = await api('profile');
      if (prof) {
        profile.display_name = prof.display_name || localStorage.getItem('finkaif_name') || '';
        profile.avatar = prof.avatar || localStorage.getItem('finkaif_avatar') || '⚡';
        if (prof.currency) {
          profile.currency = prof.currency;
          localStorage.setItem('finkaif_currency', prof.currency);
        }
      }
    } catch { }

    await refreshAllData();
  } catch {
    me = null;
  }

  renderApp();
}

window.addEventListener('hashchange', syncHash);
window.addEventListener('DOMContentLoaded', boot);
