const $ = s => document.querySelector(s);

let me = null;
let tab = 'home';
let mode = 'login';
let analyticsPeriod = 'week';
let txFilter = 'all';
let txSearch = '';

let data = {
  transactions: [],
  budgets: [],
  goals: [],
  chat: []
};

/* =========================================
   API CLIENT
   ========================================= */
const api = async (p, o = {}) => {
  const token = localStorage.getItem('finkaif_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(o.headers || {})
  };

  const r = await fetch('/api/' + p, {
    ...o,
    headers,
    credentials: 'include'
  });

  const j = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(j.error || 'Ошибка запроса');
  }

  return j;
};

/* =========================================
   FORMATTING & HELPERS
   ========================================= */
const money = n =>
  new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0)) + ' ₽';

const esc = s =>
  String(s || '').replace(/[&<>]/g, x => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  }[x]));

const formatMsg = s =>
  esc(s)
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');

const isThisMonth = dStr => {
  if (!dStr) return false;
  const d = new Date(dStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const isLastNDays = (dStr, n) => {
  if (!dStr) return false;
  const d = new Date(dStr);
  const now = new Date();
  const diff = now - d;
  return diff >= 0 && diff <= n * 24 * 60 * 60 * 1000;
};

/* =========================================
   CLEAN VECTOR SVG ICONS (NO RAW EMOJIS)
   ========================================= */
function icon(name, size = 18, stroke = 2) {
  const icons = {
    dashboard: `<rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect>`,
    transactions: `<path d="M7 10l5-5 5 5"></path><path d="M12 5v14"></path><path d="M17 14l-5 5-5-5"></path>`,
    budgets: `<rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M7 8h10"></path><path d="M7 12h6"></path><path d="M7 16h8"></path>`,
    goals: `<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5"></circle>`,
    analytics: `<path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path>`,
    assistant: `<path d="M12 2l2.4 5.6L20 10l-4.4 4 1.4 6-5-3.2-5 3.2 1.4-6L4 10l5.6-2.4z"></path>`,
    plus: `<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`,
    trash: `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>`,
    trendUp: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`,
    trendDown: `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`,
    shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`,
    card: `<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>`,
    wallet: `<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>`,
    user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>`,
    search: `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`,
    x: `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`,
    sparkles: `<path d="M12 3v3m0 12v3M3 12h3m12 0h3m-2.6-6.4l-2.1 2.1m-8.6 8.6l-2.1 2.1m0-12.8l2.1 2.1m8.6 8.6l2.1 2.1"></path>`,
    food: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>`,
    transport: `<rect x="3" y="11" width="18" height="8" rx="2"></rect><path d="M5 11l2-6h10l2 6"></path><circle cx="7" cy="15" r="1.5"></circle><circle cx="17" cy="15" r="1.5"></circle>`,
    home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
    shopping: `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>`,
    health: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>`,
    salary: `<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>`,
    invest: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline>`
  };

  const path = icons[name] || icons.card;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">${path}</svg>`;
}

function getCatIconKey(cat) {
  const c = String(cat || '').toLowerCase().trim();
  if (c.includes('ед') || c.includes('продукт') || c.includes('супермаркет') || c.includes('магаз') || c.includes('кафе') || c.includes('ресторан') || c.includes('кофе')) return 'food';
  if (c.includes('такси') || c.includes('транспорт') || c.includes('метро') || c.includes('бензин') || c.includes('авто')) return 'transport';
  if (c.includes('дом') || c.includes('жиль') || c.includes('аренд') || c.includes('жкх') || c.includes('коммунал')) return 'home';
  if (c.includes('покупк') || c.includes('одежд') || c.includes('шоппинг') || c.includes('вещи')) return 'shopping';
  if (c.includes('здоров') || c.includes('аптек') || c.includes('врач') || c.includes('спорт')) return 'health';
  if (c.includes('зарплат') || c.includes('доход') || c.includes('аванс') || c.includes('преми')) return 'salary';
  if (c.includes('инвест') || c.includes('вклад') || c.includes('акци')) return 'invest';
  return 'card';
}

function getCatBadge(cat) {
  const iconKey = getCatIconKey(cat);
  return `
    <span class="cat-pill">
      ${icon(iconKey, 13)}
      <span>${esc(cat)}</span>
    </span>
  `;
}

/* =========================================
   MINI SVG SPARKLINES GENERATOR
   ========================================= */
function generateSparkline(values, strokeColor = '#10b981', fillColor = 'rgba(16, 185, 129, 0.15)') {
  if (!values || values.length < 2) {
    values = [4, 6, 5, 8, 7, 9, 8];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const width = 100;
  const height = 28;

  const points = values.map((val, idx) => {
    const x = Math.round((idx / (values.length - 1)) * width);
    const y = Math.round(height - ((val - min) / range) * (height - 6) - 3);
    return `${x},${y}`;
  });

  const pathD = 'M ' + points.join(' L ');
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return `
    <div class="kpi-sparkline-wrap">
      <svg class="kpi-sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad-${strokeColor.replace('#', '')}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#grad-${strokeColor.replace('#', '')})"/>
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
}

/* =========================================
   AUTH VIEW
   ========================================= */
function auth() {
  const isLogin = mode === 'login';

  return `
    <div class="auth">
      <div class="authbox">
        <div class="brand" style="display: flex; align-items: center; gap: 12px; margin-bottom: 22px;">
          <div class="brand-icon">
            ${icon('wallet', 18)}
          </div>
          <div>
            <div style="font-size: 21px; font-weight: 800; letter-spacing: -0.5px; color: #fff;">FinKaif</div>
            <div style="font-size: 10px; font-weight: 800; color: var(--accent-mint); letter-spacing: 1.2px; text-transform: uppercase;">Private Wealth Suite</div>
          </div>
        </div>

        <h1 id="title">${isLogin ? 'Вход в терминал' : 'Создание аккаунта'}</h1>
        <p class="sub">Персональный приватный финансовый кокпит в защищенном облаке</p>

        <form id="authform" style="margin-top: 22px;">
          <label>
            Рабочий Email
            <input id="email" type="email" required autocomplete="email" placeholder="name@domain.com">
          </label>

          <label>
            Пароль
            <input id="password" type="password" minlength="6" required autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="••••••••">
          </label>

          <button id="submit" type="submit" style="width: 100%; margin-top: 10px;">
            ${isLogin ? 'Войти в терминал' : 'Зарегистрироваться'}
          </button>
        </form>

        <div class="notice" id="notice" style="display: none;"></div>

        <button class="btn-secondary" id="switch" type="button" style="width: 100%; margin-top: 14px;">
          ${isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  `;
}

function setupAuth() {
  const form = $('#authform');
  const switchButton = $('#switch');
  const submitBtn = $('#submit');
  const notice = $('#notice');

  if (!form || !switchButton) return;

  form.onsubmit = async e => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;

    if (notice) {
      notice.style.display = 'none';
      notice.textContent = '';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = mode === 'login' ? 'Авторизация…' : 'Создание…';
    }

    try {
      const res = await api('auth/' + mode, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (res && res.token) {
        localStorage.setItem('finkaif_token', res.token);
      }
      await boot();
    } catch (err) {
      if (notice) {
        notice.style.display = 'block';
        notice.textContent = err.message;
      } else {
        alert(err.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? 'Войти в терминал' : 'Зарегистрироваться';
      }
    }
  };

  switchButton.onclick = () => {
    mode = mode === 'login' ? 'register' : 'login';
    $('#app').innerHTML = auth();
    setupAuth();
  };
}

/* =========================================
   NAVIGATION & APP SHELL
   ========================================= */
function nav() {
  const navItems = [
    ['home', 'Обзор', 'dashboard'],
    ['transactions', 'Операции', 'transactions'],
    ['budgets', 'Бюджеты', 'budgets'],
    ['goals', 'Цели', 'goals'],
    ['analytics', 'Аналитика', 'analytics'],
    ['assistant', 'ИИ-советник', 'assistant']
  ];

  return navItems
    .map(x => `
      <button data-tab="${x[0]}" class="${tab === x[0] ? 'active' : ''}">
        ${icon(x[2], 16)}
        <span>${x[1]}</span>
      </button>
    `)
    .join('');
}

function layout() {
  const userName = me && me.email ? me.email.split('@')[0] : 'Инвестор';

  return `
    <div class="app-shell">
      <!-- Deep Luxury Emerald Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">
            ${icon('wallet', 17)}
          </div>
          <div>
            <div class="brand-name">FinKaif</div>
            <div class="brand-badge">Private Suite</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${nav()}
        </nav>

        <div class="sidebar-footer">
          <div class="system-status-pill">
            <span class="status-dot"></span>
            <span>PostgreSQL · Синхр.</span>
          </div>
          <button class="sidebar-logout" id="logout">
            ${icon('trash', 14)}
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <!-- Main Cockpit Area -->
      <div class="main-wrapper">
        <header class="topbar">
          <div class="topbar-left">
            <div class="account-selector">
              ${icon('card', 15)}
              <span>Основной счёт · RUB</span>
              <span style="color: var(--accent-mint); font-size: 11px; font-weight: 700;">● Онлайн</span>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-tertiary); letter-spacing: 0.8px; text-transform: uppercase;">
              Ликвидность: <span style="color: #34d399;">98.4%</span>
            </div>
          </div>

          <div class="topbar-right">
            <div class="user-pill">
              <div class="user-avatar">${userName.slice(0, 1).toUpperCase()}</div>
              <span>${esc(userName)}</span>
            </div>
            <button id="topbar-new-op" class="btn-sm">
              ${icon('plus', 14)}
              <span>Новая операция</span>
            </button>
          </div>
        </header>

        <main class="content-area">
          <div id="page"></div>
        </main>
      </div>
    </div>

    <!-- Modal Dialog for New Operation -->
    <div id="op-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-box">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 9px;">
            <span style="color: var(--accent-mint);">${icon('wallet', 18)}</span>
            <h3 style="font-size: 18px; font-weight: 800; letter-spacing: -0.4px; color: #fff;">Новая финансовая операция</h3>
          </div>
          <button class="modal-close" id="close-modal">&times;</button>
        </div>

        <div style="margin-bottom: 6px;">
          <small style="text-transform: uppercase; letter-spacing: 1px; font-weight: 700; font-size: 10px; color: var(--text-secondary);">Быстрый выбор категории:</small>
        </div>
        <div class="modal-chips">
          <span class="modal-chip" data-cat="Продукты" data-type="expense">Продукты</span>
          <span class="modal-chip" data-cat="Кафе и рестораны" data-type="expense">Рестораны</span>
          <span class="modal-chip" data-cat="Транспорт" data-type="expense">Транспорт</span>
          <span class="modal-chip" data-cat="Жилье и ЖКХ" data-type="expense">Жилье</span>
          <span class="modal-chip" data-cat="Покупки" data-type="expense">Покупки</span>
          <span class="modal-chip" data-cat="Здоровье" data-type="expense">Здоровье</span>
          <span class="modal-chip" data-cat="Зарплата" data-type="income">Зарплата</span>
          <span class="modal-chip" data-cat="Инвестиции" data-type="income">Инвестиции</span>
        </div>

        <form id="modal-opform" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="margin: 0;">
              Тип движения
              <select id="modal-type">
                <option value="expense">Расход (−)</option>
                <option value="income">Доход (+)</option>
              </select>
            </label>
            <label style="margin: 0;">
              Категория
              <input id="modal-category" placeholder="Напр. Продукты" required>
            </label>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="margin: 0;">
              Сумма (₽)
              <input id="modal-amount" type="number" min="1" step="any" placeholder="0" required>
            </label>
            <label style="margin: 0;">
              Дата
              <input id="modal-date" type="date" value="${new Date().toISOString().slice(0, 10)}" required>
            </label>
          </div>

          <label style="margin: 0;">
            Примечание / Описание
            <input id="modal-description" placeholder="Детали платежа (необязательно)">
          </label>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
            <button type="button" class="btn-secondary" id="modal-cancel">Отмена</button>
            <button type="submit">
              ${icon('plus', 14)}
              <span>Зафиксировать в реестре</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/* =========================================
   PAGES CONTENT
   ========================================= */
function page() {
  const inc = data.transactions
    .filter(x => x.type === 'income')
    .reduce((s, x) => s + Number(x.amount), 0);

  const exp = data.transactions
    .filter(x => x.type === 'expense')
    .reduce((s, x) => s + Number(x.amount), 0);

  const capital = inc - exp;
  const userName = me && me.email ? me.email.split('@')[0] : 'Инвестор';

  /* ----------------------------------------------------
     1. ГЛАВНАЯ (HOME) — КОКПИТ ДЭШБОРД (2-COLUMN LAYOUT)
     ---------------------------------------------------- */
  if (tab === 'home') {
    // 7-day spending calculation & sparkline history
    const days = [];
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const name = dayNames[d.getDay()];
      const dayExp = data.transactions
        .filter(t => t.type === 'expense' && t.occurred_on === iso)
        .reduce((s, t) => s + Number(t.amount), 0);
      const dayInc = data.transactions
        .filter(t => t.type === 'income' && t.occurred_on === iso)
        .reduce((s, t) => s + Number(t.amount), 0);
      days.push({ iso, name, exp: dayExp, inc: dayInc });
    }
    const maxDayExp = Math.max(1, ...days.map(d => d.exp));
    const total7d = days.reduce((s, d) => s + d.exp, 0);

    // Dynamic Financial Health Score calculation (0-100)
    let score = 72;
    const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
    if (savingsRate >= 20) score += 18;
    else if (savingsRate >= 10) score += 8;
    else if (savingsRate < 0) score -= 25;

    const totalBudgets = data.budgets.length;
    let overBudgets = 0;
    data.budgets.forEach(b => {
      const spent = data.transactions
        .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && isThisMonth(t.occurred_on))
        .reduce((s, t) => s + Number(t.amount), 0);
      if (spent > (Number(b.limit_amount) || 0)) overBudgets++;
    });
    if (totalBudgets > 0 && overBudgets === 0) score += 10;
    else if (overBudgets > 0) score -= overBudgets * 8;

    score = Math.max(35, Math.min(98, score));
    const scoreText = score >= 80 ? 'Отличный уровень' : score >= 60 ? 'Стабильный уровень' : 'Требует внимания';

    // Financial Runway Calculation in months
    const monthlyExp = exp || (total7d * 4) || 1;
    const runwayMonths = capital > 0 ? (capital / (monthlyExp || 1)).toFixed(1) : '0';

    // Top categories distribution
    const expByCat = {};
    data.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount);
      });
    const catEntries = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
    const topCats = catEntries.slice(0, 4);

    // Recent 5 transactions with channels
    const channels = ['Mir Supreme', 'СБП', 'Дебетовая карта', 'Экосистема'];
    const recentTx = [...data.transactions].slice(0, 5).map((t, i) => ({
      ...t,
      channel: channels[i % channels.length]
    }));

    // Sparkline series
    const expSpark = days.map(d => d.exp || 10);
    const incSpark = days.map(d => d.inc || 15);
    const capSpark = days.map(d => (d.inc - d.exp) + 50);

    return `
      <div class="page-container">
        <!-- Page Header: Greetings ONLY here -->
        <div class="page-header reveal-on-scroll">
          <div>
            <div class="brand-badge" style="display: inline-block; margin-bottom: 6px;">Терминал приватных финансов</div>
            <h1>Добрый день, ${esc(userName)} 👋</h1>
            <p class="sub">Сводка совокупного капитала, динамика трат и операционный аудит в реальном времени</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="quick-add-tx">
              ${icon('plus', 15)}
              <span>Новая операция</span>
            </button>
          </div>
        </div>

        <!-- Top 4-Metric KPI Bar with Sparklines -->
        <div class="kpi-bar reveal-on-scroll">
          <div class="kpi-box">
            <div class="kpi-header">
              <span class="kpi-title">Доступный капитал</span>
              <span style="color: ${capital >= 0 ? 'var(--accent-mint)' : 'var(--accent-rose)'};">
                ${icon(capital >= 0 ? 'trendUp' : 'trendDown', 16)}
              </span>
            </div>
            <div class="kpi-val" style="color: ${capital >= 0 ? '#ffffff' : '#fda4af'};">${money(capital)}</div>
            ${generateSparkline(capSpark, '#00f59b')}
            <div class="kpi-footer">
              <span class="kpi-badge-trend up">▲ Запас: ${runwayMonths} мес.</span>
              <span>Ликвидность 100%</span>
            </div>
          </div>

          <div class="kpi-box">
            <div class="kpi-header">
              <span class="kpi-title">Доходы</span>
              <span style="color: var(--accent-mint);">${icon('trendUp', 16)}</span>
            </div>
            <div class="kpi-val" style="color: #34d399;">+${money(inc)}</div>
            ${generateSparkline(incSpark, '#34d399')}
            <div class="kpi-footer">
              <span class="kpi-badge-trend up">▲ Поступления</span>
              <span>Все источники</span>
            </div>
          </div>

          <div class="kpi-box">
            <div class="kpi-header">
              <span class="kpi-title">Расходы</span>
              <span style="color: var(--accent-rose);">${icon('trendDown', 16)}</span>
            </div>
            <div class="kpi-val" style="color: #fda4af;">−${money(exp)}</div>
            ${generateSparkline(expSpark, '#f43f5e')}
            <div class="kpi-footer">
              <span class="kpi-badge-trend down">▼ ${data.transactions.filter(t => t.type === 'expense').length} списаний</span>
              <span>7 дней: ${money(total7d)}</span>
            </div>
          </div>

          <div class="kpi-box">
            <div class="kpi-header">
              <span class="kpi-title">Норма сбережений</span>
              <span style="color: var(--accent-gold-light);">${icon('shield', 16)}</span>
            </div>
            <div class="kpi-val" style="color: var(--accent-gold-light);">${inc ? savingsRate + '%' : '—'}</div>
            ${generateSparkline([20, 25, 22, 28, 30, 32, savingsRate || 24], '#fbbf24')}
            <div class="kpi-footer">
              <span class="kpi-badge-trend up" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">Цель > 20%</span>
              <span>${savingsRate >= 20 ? 'В норме' : 'Внимание'}</span>
            </div>
          </div>
        </div>

        <!-- Cockpit 2-Column Grid (65% / 35%) -->
        <div class="cockpit-grid">
          <!-- Main Left Column -->
          <div class="cockpit-main">
            <!-- 7-Day Spending Chart Panel -->
            <div class="panel reveal-on-scroll">
              <div class="panel-header">
                <div class="panel-title">
                  ${icon('analytics', 17)}
                  <span>Динамика расходов за 7 дней</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="health-badge" style="font-size: 11px;">Сумма 7д: ${money(total7d)}</span>
                </div>
              </div>

              <div class="barchart">
                ${days.map(d => `
                  <div class="barchart-col">
                    <span class="barchart-val">${d.exp > 0 ? money(d.exp) : ''}</span>
                    <div class="barchart-bar-wrap">
                      <div class="barchart-bar" style="height: ${d.exp > 0 ? Math.max(12, Math.round((d.exp / maxDayExp) * 100)) : 4}%;" title="${d.name}: ${money(d.exp)}"></div>
                    </div>
                    <span class="barchart-label">${d.name}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Multi-Segment Category Allocation Bar -->
              ${topCats.length ? `
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
                  <div class="row" style="margin-bottom: 8px; font-size: 12px; font-weight: 700; color: var(--text-secondary);">
                    <span>СТРУКТУРА ОСНОВНЫХ РАСХОДОВ</span>
                    <span style="font-family: var(--font-mono);">${topCats.length} категорий</span>
                  </div>
                  <div class="multi-seg-track">
                    ${topCats.map(([cat, amt], i) => {
                      const pct = exp > 0 ? Math.round((amt / exp) * 100) : 25;
                      const colors = ['#00f59b', '#10b981', '#06b6d4', '#d4af37'];
                      return `<div class="multi-seg" style="width: ${pct}%; background: ${colors[i % colors.length]};" title="${esc(cat)}: ${pct}%"></div>`;
                    }).join('')}
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; font-size: 11.5px;">
                    ${topCats.map(([cat, amt], i) => {
                      const pct = exp > 0 ? Math.round((amt / exp) * 100) : 0;
                      const colors = ['#00f59b', '#10b981', '#06b6d4', '#d4af37'];
                      return `
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors[i % colors.length]};"></span>
                          <span>${esc(cat)}: <b>${pct}%</b></span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Recent Operations Enterprise Data Table -->
            <div class="panel reveal-on-scroll">
              <div class="panel-header">
                <div class="panel-title">
                  ${icon('transactions', 17)}
                  <span>Последние операции</span>
                </div>
                <button class="btn-secondary btn-sm" data-tab="transactions">Все операции →</button>
              </div>

              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>ОПЕРАЦИЯ / ДЕТАЛИ</th>
                      <th>КАТЕГОРИЯ</th>
                      <th>КАНАЛ</th>
                      <th>ДАТА</th>
                      <th style="text-align: right;">СУММА</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentTx.length ? recentTx.map(t => `
                      <tr>
                        <td>
                          <div style="font-weight: 700; color: #fff;">${esc(t.description || t.category)}</div>
                        </td>
                        <td>${getCatBadge(t.category)}</td>
                        <td>
                          <span class="channel-tag">${t.channel}</span>
                        </td>
                        <td style="color: var(--text-tertiary); font-family: var(--font-mono); font-size: 12px;">${t.occurred_on}</td>
                        <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; font-size: 14.5px; color: ${t.type === 'income' ? '#34d399' : '#fda4af'};">
                          ${t.type === 'income' ? '+' : '−'}${money(t.amount)}
                        </td>
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-tertiary); padding: 36px;">
                          Операций пока нет. Нажмите «Новая операция», чтобы внести запись.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Side Right Column -->
          <div class="cockpit-side">
            <!-- Financial Health Score Card -->
            <div class="health-score-card reveal-on-scroll">
              <div class="health-gauge-header">
                <div>
                  <small style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #a7f3d0;">Индекс финансового здоровья</small>
                  <div class="health-score-val">${score}<span style="font-size: 20px; color: var(--text-secondary); font-weight: 600;">/100</span></div>
                </div>
                <span class="health-badge">${scoreText}</span>
              </div>
              <div class="health-items">
                <div class="health-item">
                  <span>Бюджетная дисциплина</span>
                  <b style="color: ${overBudgets === 0 ? 'var(--accent-mint)' : '#fda4af'};">${overBudgets === 0 ? 'В пределах нормы' : `${overBudgets} перерасход`}</b>
                </div>
                <div class="health-item">
                  <span>Сберегательный темп</span>
                  <b style="color: var(--accent-mint);">${inc > 0 ? savingsRate + '%' : '0%'}</b>
                </div>
                <div class="health-item">
                  <span>Запас прочности (Runway)</span>
                  <b style="color: var(--accent-gold-light);">${runwayMonths} мес.</b>
                </div>
              </div>
            </div>

            <!-- Digital Onyx Titanium Virtual Card (Interactive 3D Tilt) -->
            <div class="onyx-card reveal-on-scroll" id="titanium-card">
              <div class="card-glare"></div>
              <div class="onyx-card-top">
                <span>FINKAIF TITANIUM</span>
                <span style="color: var(--accent-mint); font-weight: 700;">● MIR SUPREME</span>
              </div>
              <div class="onyx-card-chip"></div>
              <div class="onyx-card-num">•••• •••• •••• 7842</div>
              <div class="onyx-card-bottom">
                <div>
                  <small style="font-size: 10px; text-transform: uppercase; color: var(--accent-gold-light); font-weight: 700;">Капитал</small>
                  <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 800; color: #fff;">${money(capital)}</div>
                </div>
                <div style="text-align: right;">
                  <small style="font-size: 10px; text-transform: uppercase; color: var(--accent-gold-light); font-weight: 700;">Держатель</small>
                  <div style="font-size: 12px; font-weight: 800; color: #fff; letter-spacing: 0.8px;">${esc(userName.toUpperCase())}</div>
                </div>
              </div>
            </div>

            <!-- Budgets Quick Progress Panel -->
            <div class="panel reveal-on-scroll">
              <div class="panel-header">
                <div class="panel-title" style="font-size: 14px;">
                  ${icon('budgets', 16)}
                  <span>Контроль лимитов</span>
                </div>
                <button class="btn-secondary btn-sm" data-tab="budgets">Все →</button>
              </div>
              ${data.budgets.slice(0, 3).length ? data.budgets.slice(0, 3).map(b => {
                const spent = data.transactions
                  .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && isThisMonth(t.occurred_on))
                  .reduce((s, t) => s + Number(t.amount), 0);
                const limit = Number(b.limit_amount) || 1;
                const pct = Math.round((spent / limit) * 100);
                const cls = pct > 100 ? 'danger' : pct >= 80 ? 'warn' : 'safe';

                return `
                  <div style="margin-bottom: 14px;">
                    <div class="row" style="margin-bottom: 5px; font-size: 12.5px;">
                      <b>${esc(b.category)}</b>
                      <span style="font-family: var(--font-mono);">${money(spent)} <small style="color: var(--text-tertiary);">/ ${money(limit)}</small></span>
                    </div>
                    <div class="progress-track" style="height: 6px;">
                      <div class="progress-fill ${cls}" style="width: ${Math.min(100, pct)}%;"></div>
                    </div>
                  </div>
                `;
              }).join('') : `
                <p class="sub" style="font-size: 12.5px;">Лимиты не настроены.</p>
                <button class="btn-secondary btn-sm" data-tab="budgets" style="width: 100%; margin-top: 10px;">＋ Настроить бюджет</button>
              `}
            </div>

            <!-- FinKaif AI Quick Insight Panel -->
            <div class="panel reveal-on-scroll" style="background: linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, var(--bg-surface) 100%);">
              <div class="panel-header">
                <div class="panel-title" style="font-size: 14px; color: #a7f3d0;">
                  ${icon('sparkles', 16)}
                  <span>Ментор FinKaif</span>
                </div>
              </div>
              <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px;">
                ${savingsRate >= 20 ? 'Ваша норма сбережений в отличной зоне (>20%). Рекомендуется распределить профицит в цели или инвестиции.' : 'Рекомендуется проанализировать топ трат недели для выхода на норматив сбережений > 20%.'}
              </p>
              <button class="btn-secondary btn-sm" data-tab="assistant" style="width: 100%;">
                <span>Спросить ментора →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ----------------------------------------------------
     2. ОПЕРАЦИИ (TRANSACTIONS) — ENTERPRISE DATA TABLE
     ---------------------------------------------------- */
  if (tab === 'transactions') {
    let filteredList = data.transactions;
    if (txFilter === 'expense') filteredList = filteredList.filter(x => x.type === 'expense');
    if (txFilter === 'income') filteredList = filteredList.filter(x => x.type === 'income');

    if (txSearch) {
      const q = txSearch.toLowerCase();
      filteredList = filteredList.filter(x =>
        String(x.category || '').toLowerCase().includes(q) ||
        String(x.description || '').toLowerCase().includes(q)
      );
    }

    const expCount = data.transactions.filter(x => x.type === 'expense').length;
    const incCount = data.transactions.filter(x => x.type === 'income').length;
    const channels = ['Mir Supreme', 'СБП', 'Дебетовая карта', 'Экосистема'];

    return `
      <div class="page-container">
        <div class="page-header reveal-on-scroll">
          <div>
            <div class="brand-badge" style="display: inline-block; margin-bottom: 6px;">Журнал операций</div>
            <h1>История операций</h1>
            <p class="sub">Реестр поступлений и списаний денежных средств</p>
          </div>
          <button id="open-tx-modal">
            ${icon('plus', 14)}
            <span>Новая операция</span>
          </button>
        </div>

        <!-- Filter Controls Bar -->
        <div class="panel reveal-on-scroll" style="padding: 14px 20px; margin-bottom: 22px;">
          <div class="row" style="flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; gap: 8px;">
              <button class="${txFilter === 'all' ? '' : 'btn-secondary'} btn-sm" data-tx-filter="all">Все (${data.transactions.length})</button>
              <button class="${txFilter === 'expense' ? '' : 'btn-secondary'} btn-sm" data-tx-filter="expense">Расходы (${expCount})</button>
              <button class="${txFilter === 'income' ? '' : 'btn-secondary'} btn-sm" data-tx-filter="income">Доходы (${incCount})</button>
            </div>

            <div style="position: relative; width: min(340px, 100%);">
              <input id="tx-search-input" placeholder="Поиск по категории или описанию..." value="${esc(txSearch)}" style="padding-left: 38px;">
              <span style="position: absolute; left: 13px; top: 13px; color: var(--text-tertiary); pointer-events: none;">
                ${icon('search', 16)}
              </span>
            </div>
          </div>
        </div>

        <!-- Enterprise Full Data Table -->
        <div class="data-table-wrap reveal-on-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>ОПЕРАЦИЯ / ДЕТАЛИ</th>
                <th>КАТЕГОРИЯ</th>
                <th>КАНАЛ</th>
                <th>ДАТА</th>
                <th style="text-align: right;">СУММА</th>
                <th style="text-align: center; width: 60px;">ДЕЙСТВИЯ</th>
              </tr>
            </thead>
            <tbody>
              ${filteredList.length ? filteredList.map((x, idx) => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #fff;">${esc(x.description || x.category)}</div>
                    ${x.description ? `<small style="color: var(--text-tertiary);">${esc(x.category)}</small>` : ''}
                  </td>
                  <td>${getCatBadge(x.category)}</td>
                  <td>
                    <span class="channel-tag">${channels[idx % channels.length]}</span>
                  </td>
                  <td style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 12.5px;">${x.occurred_on}</td>
                  <td style="text-align: right; font-family: var(--font-mono); font-size: 15px; font-weight: 800; color: ${x.type === 'income' ? '#34d399' : '#fda4af'};">
                    ${x.type === 'income' ? '+' : '−'}${money(x.amount)}
                  </td>
                  <td style="text-align: center;">
                    <button class="action-btn-del" data-del="transactions:${x.id}" title="Удалить запись">
                      ${icon('trash', 14)}
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 48px; color: var(--text-tertiary);">
                    <div>${icon('search', 32)}</div>
                    <div style="margin-top: 12px; font-weight: 700; color: #fff; font-size: 15px;">Ничего не найдено</div>
                    <p class="sub" style="margin-top: 4px;">Попробуйте изменить поисковый запрос или добавить операцию</p>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ----------------------------------------------------
     3. БЮДЖЕТЫ (BUDGETS)
     ---------------------------------------------------- */
  if (tab === 'budgets') {
    const totalBudget = data.budgets.reduce((s, b) => s + (Number(b.limit_amount) || 0), 0);
    const totalSpent = data.budgets.reduce((s, b) => {
      const spent = data.transactions
        .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && isThisMonth(t.occurred_on))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return s + spent;
    }, 0);
    const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return `
      <div class="page-container">
        <div class="page-header reveal-on-scroll">
          <div>
            <div class="brand-badge" style="display: inline-block; margin-bottom: 6px;">Финансовая дисциплина</div>
            <h1>Месячные бюджеты</h1>
            <p class="sub">Лимиты по категориям на текущий месяц для контроля перерасходов</p>
          </div>
          <button id="addbudget">
            ${icon('plus', 14)}
            <span>Установить лимит</span>
          </button>
        </div>

        <div class="panel reveal-on-scroll" style="margin-bottom: 24px;">
          <div class="row">
            <div>
              <div style="font-size: 16px; font-weight: 700;">Суммарный лимит текущего месяца</div>
              <p class="sub" style="margin-top: 3px;">Израсходовано ${money(totalSpent)} из ${money(totalBudget)} запланированных средств</p>
            </div>
            <span class="health-badge" style="${totalPct > 100 ? 'background: rgba(244,63,94,0.18); color: #fda4af; border-color: rgba(244,63,94,0.4);' : ''}">
              ${totalPct}% освоено
            </span>
          </div>
          <div class="progress-track" style="margin-top: 16px; height: 10px;">
            <div class="progress-fill ${totalPct > 100 ? 'danger' : totalPct >= 80 ? 'warn' : 'safe'}" style="width: ${Math.min(100, totalPct)}%;"></div>
          </div>
        </div>

        <div class="panel reveal-on-scroll">
          <div class="panel-header">
            <div class="panel-title">
              ${icon('budgets', 17)}
              <span>Категории под контролем (${data.budgets.length})</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${data.budgets.length ? data.budgets.map(b => {
              const spent = data.transactions
                .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && isThisMonth(t.occurred_on))
                .reduce((s, t) => s + Number(t.amount), 0);
              const limit = Number(b.limit_amount) || 1;
              const pct = Math.round((spent / limit) * 100);
              const cls = pct > 100 ? 'danger' : pct >= 80 ? 'warn' : 'safe';
              const badgeLabel = pct > 100
                ? `Перерасход на ${money(spent - limit)}`
                : pct >= 80
                ? `Использовано ${pct}%`
                : `В норме (${pct}%)`;

              return `
                <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 18px;">
                  <div class="row" style="margin-bottom: 12px;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        ${getCatBadge(b.category)}
                        <span class="health-badge" style="font-size: 11px; padding: 2px 9px; ${pct > 100 ? 'background: rgba(244,63,94,0.18); color: #fda4af; border-color: rgba(244,63,94,0.4);' : ''}">
                          ${badgeLabel}
                        </span>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 14px;">
                      <div style="text-align: right;">
                        <span style="font-family: var(--font-mono); font-weight: 800; color: #fff; font-size: 15px;">${money(spent)}</span>
                        <small style="color: var(--text-tertiary);"> / ${money(limit)}</small>
                      </div>
                      <button class="action-btn-del" data-del="budgets:${b.id}" title="Удалить бюджет">
                        ${icon('trash', 14)}
                      </button>
                    </div>
                  </div>
                  <div class="progress-track" style="height: 7px;">
                    <div class="progress-fill ${cls}" style="width: ${Math.min(100, pct)}%;"></div>
                  </div>
                </div>
              `;
            }).join('') : `
              <p class="sub" style="padding: 30px; text-align: center;">Лимиты пока не заданы. Нажмите «Установить лимит», чтобы закрепить категории трат.</p>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /* ----------------------------------------------------
     4. ЦЕЛИ (GOALS)
     ---------------------------------------------------- */
  if (tab === 'goals') {
    const totalSaved = data.goals.reduce((s, g) => s + (Number(g.saved_amount) || 0), 0);
    const totalTarget = data.goals.reduce((s, g) => s + (Number(g.target_amount) || 0), 0);
    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

    return `
      <div class="page-container">
        <div class="page-header reveal-on-scroll">
          <div>
            <div class="brand-badge" style="display: inline-block; margin-bottom: 6px;">Копилки и мечты</div>
            <h1>Финансовые цели</h1>
            <p class="sub">Накопления на резервный фонд, крупные покупки и инвестиционные задачи</p>
          </div>
          <button id="addgoal">
            ${icon('plus', 14)}
            <span>Создать цель</span>
          </button>
        </div>

        <div class="panel reveal-on-scroll" style="margin-bottom: 24px;">
          <div class="row">
            <div>
              <div style="font-size: 16px; font-weight: 700;">Общий прогресс накоплений</div>
              <p class="sub" style="margin-top: 3px;">Собрано ${money(totalSaved)} из ${money(totalTarget)} совокупных ориентиров</p>
            </div>
            <span class="health-badge">
              ${overallPct}% накоплено
            </span>
          </div>
          <div class="progress-track" style="margin-top: 16px; height: 10px;">
            <div class="progress-fill goal" style="width: ${overallPct}%;"></div>
          </div>
        </div>

        <div class="panel reveal-on-scroll">
          <div class="panel-header">
            <div class="panel-title">
              ${icon('goals', 17)}
              <span>Активные цели (${data.goals.length})</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${data.goals.length ? data.goals.map(g => {
              const saved = Number(g.saved_amount) || 0;
              const target = Number(g.target_amount) || 1;
              const pct = Math.min(100, Math.round((saved / target) * 100));
              const remains = Math.max(0, target - saved);

              return `
                <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 18px;">
                  <div class="row" style="margin-bottom: 12px;">
                    <div>
                      <div style="font-weight: 700; color: #fff; font-size: 15px;">${esc(g.name)}</div>
                      <div style="margin-top: 4px;">
                        <span class="health-badge" style="font-size: 11px; padding: 2px 9px;">
                          ${pct >= 100 ? 'Цель достигнута' : `Собрано ${pct}%`}
                        </span>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="text-align: right;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: #fff; font-size: 15px;">${money(saved)} <small style="color: var(--text-tertiary)">из ${money(target)}</small></div>
                        <small style="color: var(--text-tertiary);">${remains > 0 ? `Осталось ${money(remains)}` : 'Завершено'}</small>
                      </div>
                      <button class="btn-secondary btn-sm" data-topup="${g.id}" data-saved="${saved}">＋ Внести</button>
                      <button class="action-btn-del" data-del="goals:${g.id}">
                        ${icon('trash', 14)}
                      </button>
                    </div>
                  </div>
                  <div class="progress-track" style="height: 7px;">
                    <div class="progress-fill goal" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('') : `
              <p class="sub" style="padding: 30px; text-align: center;">Цели накоплений пока не созданы. Нажмите «Создать цель», чтобы начать копить.</p>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /* ----------------------------------------------------
     5. АНАЛИТИКА (ANALYTICS)
     ---------------------------------------------------- */
  if (tab === 'analytics') {
    const isW = analyticsPeriod === 'week';

    const header = `
      <div class="page-header reveal-on-scroll">
        <div>
          <div class="brand-badge" style="display: inline-block; margin-bottom: 6px;">Глубокий аудит</div>
          <h1>Финансовая аналитика</h1>
          <p class="sub">Динамика расходов, крупные списания и балансировка по правилу 50/30/20</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="${isW ? '' : 'btn-secondary'} btn-sm" data-period="week">7 дней</button>
          <button class="${!isW ? '' : 'btn-secondary'} btn-sm" data-period="month">Месяц</button>
        </div>
      </div>
    `;

    if (isW) {
      const wTrans = data.transactions.filter(t => isLastNDays(t.occurred_on, 7));
      const wInc = wTrans.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const wExp = wTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const wAvgDay = Math.round(wExp / 7);

      const days = [];
      const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const name = dayNames[d.getDay()];
        const dayExp = data.transactions
          .filter(t => t.type === 'expense' && t.occurred_on === iso)
          .reduce((s, t) => s + Number(t.amount), 0);
        days.push({ iso, name, exp: dayExp });
      }
      const maxDay = Math.max(1, ...days.map(d => d.exp));
      const topExpense = [...wTrans.filter(t => t.type === 'expense')].sort((a, b) => b.amount - a.amount).slice(0, 3);

      return `
        <div class="page-container">
          ${header}

          <div class="kpi-bar reveal-on-scroll">
            <div class="kpi-box">
              <span class="kpi-title">Расходы недели</span>
              <div class="kpi-val" style="color: #fda4af;">${money(wExp)}</div>
              ${generateSparkline(days.map(d => d.exp || 5), '#f43f5e')}
            </div>
            <div class="kpi-box">
              <span class="kpi-title">Доходы недели</span>
              <div class="kpi-val" style="color: #34d399;">${money(wInc)}</div>
              ${generateSparkline([10, 15, 20, 18, 25, 30, wInc ? 35 : 10], '#34d399')}
            </div>
            <div class="kpi-box">
              <span class="kpi-title">В среднем в день</span>
              <div class="kpi-val">${money(wAvgDay)}</div>
              ${generateSparkline([wAvgDay, wAvgDay, wAvgDay, wAvgDay], '#06b6d4')}
            </div>
            <div class="kpi-box">
              <span class="kpi-title">Дельта недели</span>
              <div class="kpi-val" style="color: var(--accent-mint);">${money(wInc - wExp)}</div>
              ${generateSparkline([10, 12, 14, 18, 22, 25, 28], '#00f59b')}
            </div>
          </div>

          <div class="panel reveal-on-scroll" style="margin-bottom: 24px;">
            <div class="panel-header">
              <div class="panel-title">
                ${icon('analytics', 17)}
                <span>Расходы по дням недели</span>
              </div>
            </div>
            <div class="barchart">
              ${days.map(d => `
                <div class="barchart-col">
                  <span class="barchart-val">${d.exp > 0 ? money(d.exp) : ''}</span>
                  <div class="barchart-bar-wrap">
                    <div class="barchart-bar" style="height: ${d.exp > 0 ? Math.max(12, Math.round((d.exp / maxDay) * 100)) : 4}%;"></div>
                  </div>
                  <span class="barchart-label">${d.name}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="panel reveal-on-scroll" style="margin-bottom: 24px;">
            <div class="panel-header">
              <div class="panel-title">
                ${icon('shield', 17)}
                <span>Крупнейшие списания недели</span>
              </div>
            </div>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ОПЕРАЦИЯ</th>
                    <th>КАТЕГОРИЯ</th>
                    <th>ДАТА</th>
                    <th style="text-align: right;">СУММА</th>
                  </tr>
                </thead>
                <tbody>
                  ${topExpense.length ? topExpense.map((t, idx) => `
                    <tr>
                      <td style="color: var(--text-tertiary); font-family: var(--font-mono); font-weight: 700;">#${idx + 1}</td>
                      <td style="font-weight: 700; color: #fff;">${esc(t.description || t.category)}</td>
                      <td>${getCatBadge(t.category)}</td>
                      <td style="color: var(--text-secondary); font-family: var(--font-mono);">${t.occurred_on}</td>
                      <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #fda4af;">−${money(t.amount)}</td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-tertiary);">За последние 7 дней расходов не зафиксировано.</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel reveal-on-scroll" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(7, 24, 15, 0.95));">
            <div class="row">
              <div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">ИИ-аудит недели от ментора FinKaif</div>
                <p class="sub" style="margin-top: 4px;">Получите разбор темпа списаний, перерасходов и персональные рекомендации на будущую неделю.</p>
              </div>
              <button data-ask-ai="Сделай подробный финансовый аудит моих трат за прошедшие 7 дней: оцени динамику расходов, выдели зоны риска и предложи 3 практических шага по оптимизации.">
                ${icon('sparkles', 15)}
                <span>Запросить разбор недели</span>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      const mTrans = data.transactions.filter(t => isThisMonth(t.occurred_on));
      const mInc = mTrans.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const mExp = mTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const mDelta = mInc - mExp;
      const savingsRate = mInc > 0 ? Math.round((mDelta / mInc) * 100) : 0;

      const needs = Math.round(mExp * 0.55);
      const wants = Math.round(mExp * 0.45);
      const savings = Math.max(0, mDelta);
      const totalAlloc = (needs + wants + savings) || 1;
      const pNeeds = Math.round((needs / totalAlloc) * 100);
      const pWants = Math.round((wants / totalAlloc) * 100);
      const pSavings = Math.round((savings / totalAlloc) * 100);

      return `
        <div class="page-container">
          ${header}

          <div class="kpi-bar reveal-on-scroll">
            <div class="kpi-box">
              <span class="kpi-title">Расходы месяца</span>
              <div class="kpi-val" style="color: #fda4af;">${money(mExp)}</div>
            </div>
            <div class="kpi-box">
              <span class="kpi-title">Доходы месяца</span>
              <div class="kpi-val" style="color: #34d399;">${money(mInc)}</div>
            </div>
            <div class="kpi-box">
              <span class="kpi-title">Сбережено в месяце</span>
              <div class="kpi-val" style="color: var(--accent-mint);">${money(mDelta)}</div>
            </div>
            <div class="kpi-box">
              <span class="kpi-title">Норма сбережений</span>
              <div class="kpi-val" style="color: var(--accent-gold-light);">${savingsRate}%</div>
            </div>
          </div>

          <div class="panel reveal-on-scroll" style="margin-bottom: 24px;">
            <div class="panel-header">
              <div class="panel-title">
                ${icon('budgets', 17)}
                <span>Баланс по правилу 50/30/20</span>
              </div>
              <span class="health-badge">${savingsRate >= 20 ? 'Норма соблюдена' : 'Рекомендуется балансировка'}</span>
            </div>
            <p class="sub" style="margin-bottom: 16px;">Соотношение базовых нужд (50%), желаний (30%) и сбережений (20%):</p>
            <div class="multi-seg-track" style="height: 14px;">
              <div class="multi-seg" style="width: ${pNeeds}%; background: #3b82f6;" title="Нужды: ${pNeeds}%"></div>
              <div class="multi-seg" style="width: ${pWants}%; background: #f59e0b;" title="Желания: ${pWants}%"></div>
              <div class="multi-seg" style="width: ${pSavings}%; background: #10b981;" title="Сбережения: ${pSavings}%"></div>
            </div>
            <div class="row" style="margin-top: 16px; font-size: 13px; color: var(--text-secondary);">
              <div><span style="color: #3b82f6;">●</span> Нужды: <b>${pNeeds}%</b> (${money(needs)})</div>
              <div><span style="color: #f59e0b;">●</span> Комфорт: <b>${pWants}%</b> (${money(wants)})</div>
              <div><span style="color: #10b981;">●</span> Сбережения: <b>${pSavings}%</b> (${money(savings)})</div>
            </div>
          </div>

          <div class="panel reveal-on-scroll" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(7, 24, 15, 0.95));">
            <div class="row">
              <div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">Месячный отчет от ментора FinKaif</div>
                <p class="sub" style="margin-top: 4px;">Комплексный аудит расходов, анализ категорий и стратегия распределения на следующий месяц.</p>
              </div>
              <button data-ask-ai="Подведи подробные итоги этого месяца: оцени соотношение по правилу 50/30/20, найди неэффективные расходы и составь персональный финансовый план на предстоящий месяц.">
                ${icon('sparkles', 15)}
                <span>Запросить отчет месяца</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  /* ----------------------------------------------------
     6. ИИ-ПОМОЩНИК (ASSISTANT)
     ---------------------------------------------------- */
  return `
    <div class="page-container">
      <div class="page-header reveal-on-scroll">
        <div>
          <div class="brand-badge" style="display: inline-block; margin-bottom: 6px;">Интеллектуальный советник</div>
          <h1>FinKaif AI-ментор</h1>
          <p class="sub">Глубокий анализ ваших финансовых данных и персональные стратегии</p>
        </div>
      </div>

      <div class="panel reveal-on-scroll">
        <div style="margin-bottom: 12px; font-weight: 700; font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px;">
          Быстрые сценарии анализа:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
          <button class="btn-secondary btn-sm" data-ask-ai="Проанализируй структуру моих трат и подскажи 3 конкретных шага, как сберегать 15% бюджета без потери качества жизни.">
            💡 Оптимизация 15% трат
          </button>
          <button class="btn-secondary btn-sm" data-ask-ai="Оцени мой финансовый баланс по правилу 50/30/20 на основе зафиксированных операций.">
            ⚖️ Аудит 50/30/20
          </button>
          <button class="btn-secondary btn-sm" data-ask-ai="Рассчитай необходимый объем финансовой подушки безопасности на 6 месяцев исходя из моих расходов.">
            🛡️ Подушка безопасности
          </button>
          <button class="btn-secondary btn-sm" data-ask-ai="Посмотри на мои цели накоплений и сформируй помесячный график пополнений для их достижения.">
            🎯 План закрытия целей
          </button>
        </div>

        <div class="messages" id="chat-messages">
          ${data.chat.length ? data.chat.map(x => `
            <div class="msg ${x.role}">
              ${formatMsg(x.content)}
            </div>
          `).join('') : `
            <div style="text-align: center; padding: 48px; color: var(--text-tertiary);">
              <div>${icon('sparkles', 34)}</div>
              <div style="margin-top: 12px; font-weight: 800; color: #fff; font-size: 16px;">Готов к финансовому аудиту</div>
              <p class="sub" style="margin-top: 4px;">Задайте любой финансовый вопрос или выберите быстрый сценарий выше</p>
            </div>
          `}
        </div>

        <form class="ask" id="ask">
          <textarea id="question" placeholder="Задайте финансовый вопрос (например: «Куда лучше направить 30 000 ₽ свободных средств?»)..."></textarea>
          <button type="submit">
            ${icon('assistant', 15)}
            <span>Отправить</span>
          </button>
        </form>
      </div>
    </div>
  `;
}

/* =========================================
   MODAL WINDOW CONTROLS
   ========================================= */
function openOpModal(cat = '', type = 'expense') {
  const modal = $('#op-modal');
  if (!modal) return;

  const catInput = $('#modal-category');
  const typeInput = $('#modal-type');
  const amtInput = $('#modal-amount');
  const descInput = $('#modal-description');

  if (catInput) catInput.value = cat;
  if (typeInput) typeInput.value = type;
  if (descInput) descInput.value = '';
  if (amtInput) {
    amtInput.value = '';
    amtInput.focus();
  }

  modal.style.display = 'flex';
}

function closeOpModal() {
  const modal = $('#op-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/* =========================================
   SCROLL-DRIVEN REVEAL OBSERVER
   ========================================= */
function initScrollObserver() {
  const reveals = document.querySelectorAll('.reveal-on-scroll');
  if (!reveals.length) return;

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('is-visible');
          }, idx * 60);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    reveals.forEach(el => obs.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }
}

/* =========================================
   LOAD DATA
   ========================================= */
async function load() {
  try {
    const [txs, bgs, gls, cht] = await Promise.all([
      api('transactions'),
      api('budgets'),
      api('goals'),
      api('chat')
    ]);
    data.transactions = txs || [];
    data.budgets = bgs || [];
    data.goals = gls || [];
    data.chat = cht || [];
  } catch (err) {
    console.error('Ошибка синхронизации данных:', err);
  }

  render();
}

/* =========================================
   RENDER & EVENT BINDINGS
   ========================================= */
function render() {
  $('#app').innerHTML = layout();
  $('#page').innerHTML = page();

  // Initialize Scroll-motion reveal
  initScrollObserver();

  // Scroll chat
  const msgBox = $('#chat-messages');
  if (msgBox) {
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  // Navigation tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      tab = btn.dataset.tab;
      render();
    };
  });

  // Topbar and quick add buttons
  const topbarAdd = $('#topbar-new-op');
  if (topbarAdd) topbarAdd.onclick = () => openOpModal();

  const quickAdd = $('#quick-add-tx');
  if (quickAdd) quickAdd.onclick = () => openOpModal();

  const txModalAdd = $('#open-tx-modal');
  if (txModalAdd) txModalAdd.onclick = () => openOpModal();

  // Modal close handlers
  const closeModalBtn = $('#close-modal');
  if (closeModalBtn) closeModalBtn.onclick = closeOpModal;

  const modalCancelBtn = $('#modal-cancel');
  if (modalCancelBtn) modalCancelBtn.onclick = closeOpModal;

  const modalBackdrop = $('#op-modal');
  if (modalBackdrop) {
    modalBackdrop.onclick = e => {
      if (e.target === modalBackdrop) closeOpModal();
    };
  }

  // Modal Category Chips
  document.querySelectorAll('.modal-chip').forEach(chip => {
    chip.onclick = () => {
      const cat = chip.dataset.cat;
      const t = chip.dataset.type || 'expense';
      const catInput = $('#modal-category');
      const typeInput = $('#modal-type');
      const amtInput = $('#modal-amount');
      if (catInput) catInput.value = cat;
      if (typeInput) typeInput.value = t;
      if (amtInput) amtInput.focus();
    };
  });

  // Modal form submit
  const modalForm = $('#modal-opform');
  if (modalForm) {
    modalForm.onsubmit = async e => {
      e.preventDefault();
      try {
        await api('transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: $('#modal-type').value,
            category: $('#modal-category').value,
            description: $('#modal-description').value,
            amount: $('#modal-amount').value,
            occurred_on: $('#modal-date').value
          })
        });
        closeOpModal();
        await load();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // Transaction filters & search
  document.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.onclick = () => {
      txFilter = btn.dataset.txFilter;
      render();
    };
  });

  const searchInput = $('#tx-search-input');
  if (searchInput) {
    searchInput.oninput = e => {
      txSearch = e.target.value;
      render();
      const newSearchInput = $('#tx-search-input');
      if (newSearchInput) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
      }
    };
  }

  // Analytics period switch
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.onclick = () => {
      analyticsPeriod = btn.dataset.period;
      render();
    };
  });

  // Delete records
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Подтверждаете удаление этой записи?')) {
        const [resource, id] = btn.dataset.del.split(':');
        await api(resource + '/' + id, { method: 'DELETE' });
        load();
      }
    };
  });

  // Top up goal
  document.querySelectorAll('[data-topup]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.topup;
      const current = Number(btn.dataset.saved) || 0;
      const val = prompt('Сумма пополнения цели (₽):');
      if (val && Number(val) > 0) {
        try {
          await api('goals/' + id, {
            method: 'PUT',
            body: JSON.stringify({ saved_amount: current + Number(val) })
          });
          load();
        } catch (e) {
          alert('Ошибка пополнения: ' + e.message);
        }
      }
    };
  });

  // Add Budget
  const addBudgetBtn = $('#addbudget');
  if (addBudgetBtn) {
    addBudgetBtn.onclick = async () => {
      const category = prompt('Категория расхода:');
      const limit_amount = prompt('Месячный лимит расходов (₽):');
      if (category && Number(limit_amount) > 0) {
        await api('budgets', {
          method: 'POST',
          body: JSON.stringify({ category, limit_amount })
        });
        load();
      }
    };
  }

  // Add Goal
  const addGoalBtn = $('#addgoal');
  if (addGoalBtn) {
    addGoalBtn.onclick = async () => {
      const name = prompt('Название цели накоплений:');
      const target_amount = prompt('Целевая сумма (₽):');
      if (name && Number(target_amount) > 0) {
        await api('goals', {
          method: 'POST',
          body: JSON.stringify({ name, target_amount })
        });
        load();
      }
    };
  }

  // Ask AI shortcut chips
  document.querySelectorAll('[data-ask-ai]').forEach(btn => {
    btn.onclick = () => {
      const q = btn.dataset.askAi;
      tab = 'assistant';
      render();
      const textarea = $('#question');
      if (textarea) textarea.value = q;
      const askForm = $('#ask');
      if (askForm) askForm.requestSubmit();
    };
  });

  // AI Chat Submit
  const ask = $('#ask');
  if (ask) {
    const textarea = $('#question');
    if (textarea) {
      textarea.onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ask.requestSubmit();
        }
      };
    }

    ask.onsubmit = async e => {
      e.preventDefault();
      const q = $('#question').value.trim();
      if (!q) return;

      data.chat.push(
        { role: 'user', content: q },
        { role: 'assistant', content: 'Анализирую ваши финансовые показатели…' }
      );
      render();

      const btn = ask.querySelector('button');
      if (btn) btn.disabled = true;

      try {
        const r = await api('assistant', {
          method: 'POST',
          body: JSON.stringify({ question: q })
        });
        data.chat[data.chat.length - 1] = { role: 'assistant', content: r.answer };
        render();
      } catch (err) {
        data.chat[data.chat.length - 1] = { role: 'assistant', content: err.message };
        render();
      } finally {
        if (btn) btn.disabled = false;
      }
    };
  }

  // Logout
  const logoutBtn = $('#logout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      localStorage.removeItem('finkaif_token');
      try {
        await api('auth/logout', { method: 'POST' });
      } catch {}
      location.reload();
    };
  }

  setupCardTilt();
}

// Global keydown for Escape to close modal
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOpModal();
});

/* =======================================================
   VIVID 60 FPS LIVE AMBIENT EMERALD AURORA CANVAS
   WITH INTERACTIVE CURSOR FOLLOWER & WAVE DYNAMICS
   ======================================================= */
let canvasInited = false;
function initAmbientCanvas() {
  if (canvasInited) return;
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  canvasInited = true;

  const ctx = canvas.getContext('2d');
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;

  const mouse = { x: w * 0.5, y: h * 0.3, targetX: w * 0.5, targetY: h * 0.3 };
  window.addEventListener('mousemove', e => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
  });

  window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  // 5 Vibrant Luminous Emerald & Gold Blobs
  const blobs = [
    { x: w * 0.2, y: h * 0.25, baseR: 450, r: 450, vx: 0.6, vy: 0.45, phase: 0, color: 'rgba(0, 245, 155, ' },     // Neon Mint
    { x: w * 0.82, y: h * 0.38, baseR: 480, r: 480, vx: -0.5, vy: 0.5, phase: 1.5, color: 'rgba(16, 185, 129, ' },   // Deep Emerald
    { x: w * 0.5, y: h * 0.88, baseR: 440, r: 440, vx: 0.45, vy: -0.4, phase: 3.1, color: 'rgba(4, 120, 87, ' },    // Forest Jade
    { x: w * 0.3, y: h * 0.72, baseR: 380, r: 380, vx: -0.4, vy: -0.45, phase: 4.2, color: 'rgba(212, 175, 55, ' }, // Warm Gold Spark
    { x: w * 0.88, y: h * 0.85, baseR: 400, r: 400, vx: 0.5, vy: -0.35, phase: 2.2, color: 'rgba(6, 182, 212, ' }   // Cyan Teal
  ];

  // 60 Floating Micro-Sparks
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.8 + 0.6,
    alpha: Math.random() * 0.7 + 0.3,
    speed: Math.random() * 0.45 + 0.18,
    pulse: (Math.random() * 0.025 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
    gold: Math.random() > 0.65
  }));

  let time = 0;

  function draw() {
    time += 0.015;

    // Smooth cursor follower lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.06;
    mouse.y += (mouse.targetY - mouse.y) * 0.06;

    ctx.clearRect(0, 0, w, h);

    // Deep luxury obsidian background gradient
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 100, w * 0.5, h * 0.5, Math.max(w, h));
    bgGrad.addColorStop(0, '#040d07');
    bgGrad.addColorStop(0.6, '#020704');
    bgGrad.addColorStop(1, '#010402');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Interactive cursor radiant glow
    const cursorGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 350);
    cursorGrad.addColorStop(0, 'rgba(0, 245, 155, 0.22)');
    cursorGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.08)');
    cursorGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = cursorGrad;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 350, 0, Math.PI * 2);
    ctx.fill();

    // Moving Aurora Blobs with Breathing Sine Waves
    blobs.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;

      if (b.x < -100 || b.x > w + 100) b.vx *= -1;
      if (b.y < -100 || b.y > h + 100) b.vy *= -1;

      // Breathing radius modulation
      b.r = b.baseR + Math.sin(time + b.phase) * 60;

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.color + '0.45)');
      g.addColorStop(0.4, b.color + '0.18)');
      g.addColorStop(0.8, b.color + '0.04)');
      g.addColorStop(1, b.color + '0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Floating Stardust Sparks
    stars.forEach(s => {
      s.y -= s.speed;
      if (s.y < -10) {
        s.y = h + 10;
        s.x = Math.random() * w;
      }
      s.alpha += s.pulse;
      if (s.alpha > 0.9 || s.alpha < 0.25) s.pulse *= -1;

      const currentAlpha = Math.max(0.1, Math.min(1, s.alpha));
      ctx.fillStyle = s.gold
        ? `rgba(251, 191, 36, ${currentAlpha})`
        : `rgba(0, 245, 155, ${currentAlpha})`;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

/* =========================================
   3D CARD TILT & SPECULAR GLARE
   ========================================= */
function setupCardTilt() {
  const card = document.getElementById('titanium-card');
  if (!card) return;

  card.onmousemove = e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotX = -(y / (rect.height / 2)) * 12;
    const rotY = (x / (rect.width / 2)) * 14;
    card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.025, 1.025, 1.025)`;

    const glare = card.querySelector('.card-glare');
    if (glare) {
      const px = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
      const py = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
      glare.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255, 255, 255, 0.35) 0%, rgba(212, 175, 55, 0.2) 30%, transparent 65%)`;
    }
  };

  card.onmouseleave = () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    const glare = card.querySelector('.card-glare');
    if (glare) glare.style.background = 'none';
  };
}

/* =========================================
   BOOTSTRAP
   ========================================= */
async function boot() {
  initAmbientCanvas();

  try {
    me = (await api('me')).user;
  } catch {
    localStorage.removeItem('finkaif_token');
    $('#app').innerHTML = auth();
    setupAuth();
    return;
  }

  render();

  try {
    await load();
  } catch (err) {
    console.error('Ошибка загрузки данных:', err);
  }
}

boot();
