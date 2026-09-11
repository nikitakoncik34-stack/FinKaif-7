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
   PRECISION FINANCIAL FORMATTERS
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
   ARCHITECTURAL VECTOR ICONS
   ========================================= */
function icon(name, size = 16, stroke = 1.8) {
  const icons = {
    dashboard: `<rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect>`,
    transactions: `<line x1="7" y1="4" x2="7" y2="20"></line><polyline points="3 8 7 4 11 8"></polyline><line x1="17" y1="20" x2="17" y2="4"></line><polyline points="13 16 17 20 21 16"></polyline>`,
    budgets: `<rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="9" x2="17" y2="9"></line><line x1="7" y1="13" x2="13" y2="13"></line>`,
    goals: `<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5"></circle>`,
    analytics: `<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>`,
    assistant: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
    plus: `<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`,
    trash: `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>`,
    trendUp: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`,
    trendDown: `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`,
    shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`,
    card: `<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>`,
    wallet: `<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><circle cx="16" cy="14" r="1.5"></circle>`,
    search: `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`,
    sparkles: `<path d="M12 3v3m0 12v3M3 12h3m12 0h3m-2.6-6.4l-2.1 2.1m-8.6 8.6l-2.1 2.1m0-12.8l2.1 2.1m8.6 8.6l2.1 2.1"></path>`
  };

  const path = icons[name] || icons.card;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">${path}</svg>`;
}

/* =========================================
   AUTH VIEW
   ========================================= */
function auth() {
  const isLogin = mode === 'login';

  return `
    <div class="auth">
      <div class="authbox">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div class="brand-icon-monolith">
            ${icon('wallet', 15)}
          </div>
          <div>
            <div class="brand-title">FinKaif</div>
            <div class="brand-subtitle">The Architectural Ledger</div>
          </div>
        </div>

        <h1 style="font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: #fff;">${isLogin ? 'Авторизация в реестре' : 'Регистрация счета'}</h1>
        <p class="sub" style="margin-top: 4px;">Приватный терминал управления капиталом и аналитики</p>

        <form id="authform" style="margin-top: 24px;">
          <label style="font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;">
            Учетный Email
            <input id="email" type="email" required autocomplete="email" placeholder="investor@finkaif.ch">
          </label>

          <label style="font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 14px;">
            Ключ доступа / Пароль
            <input id="password" type="password" minlength="6" required autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="••••••••">
          </label>

          <button id="submit" type="submit" style="width: 100%; margin-top: 20px; padding: 12px;">
            ${isLogin ? 'Открыть реестр' : 'Создать учетную запись'}
          </button>
        </form>

        <div class="notice" id="notice" style="display: none; margin-top: 14px; font-family: var(--font-mono); font-size: 12px;"></div>

        <button class="btn-secondary" id="switch" type="button" style="width: 100%; margin-top: 12px;">
          ${isLogin ? 'Регистрация нового счета →' : 'Уже зарегистрированы? Войти →'}
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
      submitBtn.textContent = 'Синхронизация…';
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
        submitBtn.textContent = mode === 'login' ? 'Открыть реестр' : 'Создать учетную запись';
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
    ['home', 'Обзор реестра', 'dashboard'],
    ['transactions', 'Журнал проводок', 'transactions'],
    ['budgets', 'Лимиты бюджетов', 'budgets'],
    ['goals', 'Цели капитала', 'goals'],
    ['analytics', 'Аудит и срез', 'analytics'],
    ['assistant', 'AI-аналитик', 'assistant']
  ];

  return navItems
    .map(x => `
      <button data-tab="${x[0]}" class="${tab === x[0] ? 'active' : ''}">
        ${icon(x[2], 15)}
        <span>${x[1]}</span>
      </button>
    `)
    .join('');
}

function layout() {
  const userName = me && me.email ? me.email.split('@')[0] : 'Инвестор';
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });

  return `
    <div class="app-shell">
      <!-- Left Architectural Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon-monolith">
            ${icon('wallet', 15)}
          </div>
          <div>
            <div class="brand-title">FinKaif</div>
            <div class="brand-subtitle">Architectural Ledger</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${nav()}
        </nav>

        <div class="sidebar-footer">
          <div class="system-status-indicator">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span class="status-dot-emerald"></span>
              <span>PostgreSQL Cluster</span>
            </span>
            <span style="color: var(--accent-emerald);">SYNCED</span>
          </div>
          <button class="sidebar-logout" id="logout">
            ${icon('trash', 13)}
            <span>Завершить сессию</span>
          </button>
        </div>
      </aside>

      <!-- Main Editorial Canvas -->
      <div class="main-wrapper">
        <header class="top-masthead">
          <div class="masthead-left">
            <div class="masthead-tag">
              <span>РЕЕСТР КАПИТАЛА</span>
              <span style="color: var(--hairline-strong);">/</span>
              <span>${dateStr.toUpperCase()}</span>
            </div>
            <div class="account-pill">
              <span style="color: var(--accent-emerald);">●</span>
              <span>Основной счёт · RUB</span>
            </div>
          </div>

          <div class="masthead-right">
            <div class="user-tag">
              <div class="user-tag-avatar">${userName.slice(0, 1).toUpperCase()}</div>
              <span>${esc(userName)}</span>
            </div>
            <button id="topbar-new-op" class="btn-sm">
              ${icon('plus', 13)}
              <span>Новая проводка</span>
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
          <div>
            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--accent-emerald); letter-spacing: 1px; text-transform: uppercase;">ФИНАНСОВАЯ ПРОВОДКА</span>
            <h3 style="font-size: 17px; font-weight: 800; color: #fff; margin-top: 2px;">Внесение записи в леджер</h3>
          </div>
          <button class="modal-close" id="close-modal">&times;</button>
        </div>

        <div class="modal-chips">
          <span class="modal-chip" data-cat="Продукты" data-type="expense">Продукты</span>
          <span class="modal-chip" data-cat="Рестораны" data-type="expense">Рестораны</span>
          <span class="modal-chip" data-cat="Транспорт" data-type="expense">Транспорт</span>
          <span class="modal-chip" data-cat="Жилье и ЖКХ" data-type="expense">Жилье</span>
          <span class="modal-chip" data-cat="Покупки" data-type="expense">Покупки</span>
          <span class="modal-chip" data-cat="Здоровье" data-type="expense">Здоровье</span>
          <span class="modal-chip" data-cat="Зарплата" data-type="income">Зарплата</span>
          <span class="modal-chip" data-cat="Инвестиции" data-type="income">Инвестиции</span>
        </div>

        <form id="modal-opform" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="margin: 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
              Направление
              <select id="modal-type">
                <option value="expense">Расход (−)</option>
                <option value="income">Поступление (+)</option>
              </select>
            </label>
            <label style="margin: 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
              Статья / Категория
              <input id="modal-category" placeholder="Напр. Продукты" required>
            </label>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="margin: 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
              Сумма (₽)
              <input id="modal-amount" type="number" min="1" step="any" placeholder="0" required>
            </label>
            <label style="margin: 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
              Дата проводки
              <input id="modal-date" type="date" value="${new Date().toISOString().slice(0, 10)}" required>
            </label>
          </div>

          <label style="margin: 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
            Контрагент / Назначение платежа
            <input id="modal-description" placeholder="Детали операции (необязательно)">
          </label>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--hairline); padding-top: 14px;">
            <button type="button" class="btn-secondary" id="modal-cancel">Отмена</button>
            <button type="submit">
              ${icon('plus', 13)}
              <span>Зафиксировать проводку</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/* =========================================
   PAGES CONTENT (CARDLESS ARCHITECTURAL LEDGER)
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
     1. ГЛАВНАЯ (HOME) — THE CAPITAL MONOLITH & MARGINALIA
     ---------------------------------------------------- */
  if (tab === 'home') {
    // 7-day spending calculation
    const days = [];
    const dayNames = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
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
    const maxDayExp = Math.max(1, ...days.map(d => d.exp));
    const total7d = days.reduce((s, d) => s + d.exp, 0);

    const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
    const monthlyExp = exp || (total7d * 4) || 1;
    const runwayMonths = capital > 0 ? (capital / monthlyExp).toFixed(1) : '0.0';

    // Top categories
    const expByCat = {};
    data.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount);
      });
    const catEntries = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
    const topCatName = catEntries[0] ? catEntries[0][0] : 'Базовые траты';
    const topCatAmt = catEntries[0] ? catEntries[0][1] : 0;
    const topCatPct = exp > 0 ? Math.round((topCatAmt / exp) * 100) : 0;

    // 50/30/20 proportions
    const needs = Math.round(exp * 0.55);
    const wants = Math.round(exp * 0.45);
    const savings = Math.max(0, capital);
    const totalAlloc = (needs + wants + savings) || 1;
    const pNeeds = Math.round((needs / totalAlloc) * 100);
    const pWants = Math.round((wants / totalAlloc) * 100);
    const pSavings = Math.round((savings / totalAlloc) * 100);

    // Recent 6 transactions with channels
    const channels = ['Mir Supreme', 'СБП', 'Дебетовая карта', 'Экосистема'];
    const recentTx = [...data.transactions].slice(0, 6).map((t, i) => ({
      ...t,
      channel: channels[i % channels.length]
    }));

    // SVG Meridian Streamline coordinates calculation
    const svgWidth = 900;
    const svgHeight = 140;
    const points = days.map((d, i) => {
      const x = Math.round((i / (days.length - 1)) * (svgWidth - 60) + 30);
      const y = Math.round(svgHeight - 20 - (d.exp / maxDayExp) * (svgHeight - 45));
      return { x, y, exp: d.exp, name: d.name };
    });

    const pathD = points.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = arr[i - 1];
      const cp1x = prev.x + (p.x - prev.x) / 2;
      const cp1y = prev.y;
      const cp2x = prev.x + (p.x - prev.x) / 2;
      const cp2y = p.y;
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p.x},${p.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x},${svgHeight} L ${points[0].x},${svgHeight} Z`;

    return `
      <!-- THE CAPITAL MONOLITH (HERO) -->
      <section class="monolith-header">
        <div class="monolith-meta-strip">
          <span>СОВОКУПНАЯ ЛИКВИДНАЯ ПОЗИЦИЯ</span>
          <span>АВТОНОМНОСТЬ: <b style="color: var(--accent-emerald);">${runwayMonths} МЕС.</b></span>
        </div>

        <div class="monolith-balance-row">
          <div class="monolith-figure-wrap">
            <div class="monolith-figure">${money(capital)}</div>
            <div class="monolith-subtext">
              <span>Чистый остаток свободного капитала</span>
              <span style="color: var(--hairline-strong);">·</span>
              <span style="color: ${savingsRate >= 20 ? 'var(--accent-emerald)' : 'var(--accent-amber)'}; font-weight: 700;">
                Норма сбережений: ${savingsRate}%
              </span>
            </div>
          </div>

          <div class="monolith-actions">
            <button id="quick-add-tx">
              ${icon('plus', 13)}
              <span>Внести проводку</span>
            </button>
            <button class="btn-secondary" data-tab="analytics">
              <span>Полный срез →</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 4-METRIC ARCHITECTURAL STRIP (CARDLESS) -->
      <section class="ledger-metrics-grid">
        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">
            <span>Валовый доход</span>
            <span style="color: var(--accent-emerald);">${icon('trendUp', 13)}</span>
          </div>
          <div class="ledger-metric-val" style="color: var(--accent-emerald);">+${money(inc)}</div>
          <div class="ledger-metric-footer">
            <span>Поступления реестра</span>
          </div>
        </div>

        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">
            <span>Совокупные расходы</span>
            <span style="color: var(--accent-crimson);">${icon('trendDown', 13)}</span>
          </div>
          <div class="ledger-metric-val" style="color: #fda4af;">−${money(exp)}</div>
          <div class="ledger-metric-footer">
            <span>${data.transactions.filter(t => t.type === 'expense').length} зарегистрированных проводок</span>
          </div>
        </div>

        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">
            <span>Срез 7 дней</span>
            <span>${icon('analytics', 13)}</span>
          </div>
          <div class="ledger-metric-val">${money(total7d)}</div>
          <div class="ledger-metric-footer">
            <span>В среднем: ${money(Math.round(total7d / 7))}/день</span>
          </div>
        </div>

        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">
            <span>Главная статья</span>
            <span>${icon('shield', 13)}</span>
          </div>
          <div class="ledger-metric-val" style="font-size: 19px; color: var(--accent-platinum);">${esc(topCatName)}</div>
          <div class="ledger-metric-footer">
            <span>${money(topCatAmt)} (${topCatPct}% от всех трат)</span>
          </div>
        </div>
      </section>

      <!-- SIGNATURE 1: THE CASHFLOW MERIDIAN -->
      <section class="meridian-section">
        <div class="meridian-header">
          <div class="meridian-title">
            ${icon('analytics', 16)}
            <span>Денежный Меридиан · Непрерывный векторный срез расходов (7 дней)</span>
          </div>
          <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">
            ОБЪЕМ ПЕРИОДА: <b style="color: #fff;">${money(total7d)}</b>
          </div>
        </div>

        <svg class="meridian-chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="meridian-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00e599" stop-opacity="0.22"/>
              <stop offset="80%" stop-color="#00e599" stop-opacity="0.02"/>
              <stop offset="100%" stop-color="#00e599" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <path d="${areaD}" fill="url(#meridian-grad)"/>
          <path d="${pathD}" fill="none" stroke="#00e599" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#040705" stroke="#00e599" stroke-width="2"/>
            <text x="${p.x}" y="${Math.max(16, p.y - 10)}" fill="#8fa395" font-size="10.5" font-family="JetBrains Mono" text-anchor="middle" font-weight="700">${p.exp > 0 ? money(p.exp) : ''}</text>
          `).join('')}
        </svg>

        <div class="meridian-days-row">
          ${points.map(p => `<span>${p.name}</span>`).join('')}
        </div>
      </section>

      <!-- SIGNATURE 2: THE LEDGER & AI MARGINALIA (SPLIT GRID 68% / 32%) -->
      <section class="editorial-split-grid">
        <!-- Main Ledger Table (Left) -->
        <div class="ledger-pane">
          <div class="ledger-pane-header">
            <div>
              <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted);">РЕЕСТР ПРОВОДОК</span>
              <h2 style="font-size: 17px; font-weight: 800; color: #fff; margin-top: 2px;">Операционный журнал</h2>
            </div>
            <button class="btn-secondary btn-sm" data-tab="transactions">Открыть полный реестр →</button>
          </div>

          <table class="ledger-table">
            <thead>
              <tr>
                <th>ОПЕРАЦИЯ / НАЗНАЧЕНИЕ</th>
                <th>СТАТЬЯ</th>
                <th>КАНАЛ</th>
                <th>ДАТА</th>
                <th style="text-align: right;">СУММА</th>
              </tr>
            </thead>
            <tbody>
              ${recentTx.length ? recentTx.map(t => `
                <tr>
                  <td>
                    <div class="tx-counterparty">${esc(t.description || t.category)}</div>
                  </td>
                  <td>
                    <span class="tx-category-tag">${esc(t.category)}</span>
                  </td>
                  <td>
                    <span class="tx-channel-badge">${t.channel}</span>
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${t.occurred_on}</td>
                  <td style="text-align: right; font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: ${t.type === 'income' ? 'var(--accent-emerald)' : '#fda4af'};">
                    ${t.type === 'income' ? '+' : '−'}${money(t.amount)}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 36px; font-family: var(--font-mono);">
                    В реестре пока нет проводок. Нажмите «Внести проводку», чтобы зарегистрировать операцию.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- AI Marginalia (Right Column) -->
        <aside class="marginalia-pane">
          <!-- Live AI Marginalia Note 1 -->
          <div class="marginalia-block">
            <div class="marginalia-meta">
              <span>AI AUDIT DISPATCH</span>
              <span>LIVE</span>
            </div>
            <p class="marginalia-text">
              Запас финансовой автономии составляет <b>${runwayMonths} мес.</b> при текущей скорости списаний (${money(total7d)} / 7д).
              ${savingsRate >= 20 ? 'Норма сбережений находится в безопасной зоне (>20%). Рекомендуется зафиксировать профицит в инвестиционные цели.' : 'Норма сбережений ниже целевого норматива 20%. Рекомендуется оптимизация расходов по статье «' + esc(topCatName) + '».'}
            </p>
            <a class="marginalia-action-link" data-tab="assistant">
              <span>Запросить стратегию ментора →</span>
            </a>
          </div>

          <!-- Financial Health Monolith -->
          <div class="health-monolith">
            <div class="health-monolith-header">
              <span style="font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">ИНДЕКС УСТОЙЧИВОСТИ</span>
              <span style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-emerald); font-weight: 700;">AAA GRADE</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span class="health-monolith-score">${savingsRate >= 20 ? '88' : '72'}</span>
              <span style="font-family: var(--font-mono); font-size: 14px; color: var(--text-muted);">/ 100</span>
            </div>
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--hairline); font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Покрытие обязательств:</span>
                <b style="color: #fff;">100%</b>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Резерв непредвиденных трат:</span>
                <b style="color: var(--accent-emerald);">Сформирован</b>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <!-- STRUCTURAL 50/30/20 ALLOCATION STRIP -->
      <section class="allocation-strip">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted);">СТРУКТУРНЫЙ БАЛАНС КАПИТАЛА (ПРАВИЛО 50 / 30 / 20)</span>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-platinum);">НОРМАТИВНЫЙ ПРОФИЛЬ</span>
        </div>

        <div class="allocation-track">
          <div class="allocation-segment" style="width: ${pNeeds}%; background: #00e599;" title="Нужды: ${pNeeds}%"></div>
          <div class="allocation-segment" style="width: ${pWants}%; background: #f59e0b;" title="Комфорт: ${pWants}%"></div>
          <div class="allocation-segment" style="width: ${pSavings}%; background: #06b6d4;" title="Капитал: ${pSavings}%"></div>
        </div>

        <div class="allocation-legend">
          <div><span style="color: #00e599;">●</span> Базовые обязательства: <b>${pNeeds}%</b> (${money(needs)}) [Цель: 50%]</div>
          <div><span style="color: #f59e0b;">●</span> Желания и комфорт: <b>${pWants}%</b> (${money(wants)}) [Цель: 30%]</div>
          <div><span style="color: #06b6d4;">●</span> Накопления и резервы: <b>${pSavings}%</b> (${money(savings)}) [Цель: 20%]</div>
        </div>
      </section>
    `;
  }

  /* ----------------------------------------------------
     2. ЖУРНАЛ ПРОВОДОК (TRANSACTIONS)
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
      <section class="monolith-header">
        <div class="monolith-meta-strip">
          <span>ОПЕРАЦИОННЫЙ РЕЕСТР</span>
          <span>ВСЕГО ПРОВОДОК: ${data.transactions.length}</span>
        </div>
        <div class="monolith-balance-row">
          <div>
            <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #fff;">Журнал финансовых проводок</h1>
            <p class="sub" style="margin-top: 4px;">Сквозной аудит притока и оттока капитала с фильтрацией по источникам</p>
          </div>
          <button id="open-tx-modal">
            ${icon('plus', 13)}
            <span>Внести проводку</span>
          </button>
        </div>
      </section>

      <!-- Filter Controls Strip -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--hairline); padding-bottom: 18px; margin-bottom: 24px; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; gap: 6px;">
          <button class="${txFilter === 'all' ? '' : 'btn-secondary'} btn-sm" data-tx-filter="all">Все проводки (${data.transactions.length})</button>
          <button class="${txFilter === 'expense' ? '' : 'btn-secondary'} btn-sm" data-tx-filter="expense">Списания (${expCount})</button>
          <button class="${txFilter === 'income' ? '' : 'btn-secondary'} btn-sm" data-tx-filter="income">Поступления (${incCount})</button>
        </div>

        <div style="position: relative; width: min(340px, 100%);">
          <input id="tx-search-input" placeholder="Поиск по контрагенту или статье..." value="${esc(txSearch)}" style="padding-left: 36px;">
          <span style="position: absolute; left: 12px; top: 11px; color: var(--text-muted); pointer-events: none;">
            ${icon('search', 14)}
          </span>
        </div>
      </div>

      <table class="ledger-table">
        <thead>
          <tr>
            <th>КОНТРАГЕНТ / НАЗНАЧЕНИЕ</th>
            <th>СТАТЬЯ РАСХОДА</th>
            <th>КАНАЛ ПРОВОДКИ</th>
            <th>ДАТА ОПЕРАЦИИ</th>
            <th style="text-align: right;">СУММА</th>
            <th style="text-align: center; width: 50px;">ДЕЙСТВИЕ</th>
          </tr>
        </thead>
        <tbody>
          ${filteredList.length ? filteredList.map((x, idx) => `
            <tr>
              <td>
                <div class="tx-counterparty">${esc(x.description || x.category)}</div>
              </td>
              <td><span class="tx-category-tag">${esc(x.category)}</span></td>
              <td><span class="tx-channel-badge">${channels[idx % channels.length]}</span></td>
              <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">${x.occurred_on}</td>
              <td style="text-align: right; font-family: var(--font-mono); font-size: 14.5px; font-weight: 700; color: ${x.type === 'income' ? 'var(--accent-emerald)' : '#fda4af'};">
                ${x.type === 'income' ? '+' : '−'}${money(x.amount)}
              </td>
              <td style="text-align: center;">
                <button class="action-btn-del" data-del="transactions:${x.id}" title="Аннулировать проводку">
                  ${icon('trash', 13)}
                </button>
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="6" style="text-align: center; padding: 48px; color: var(--text-muted); font-family: var(--font-mono);">
                По заданным критериям фильтрации проводок не обнаружено.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  }

  /* ----------------------------------------------------
     3. БЮДЖЕТЫ (BUDGETS) — ENVELOPE ALLOCATION
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
      <section class="monolith-header">
        <div class="monolith-meta-strip">
          <span>КОНВЕРТНОЕ ПЛАНИРОВАНИЕ</span>
          <span>ОСВОЕНИЕ МЕСЯЦА: ${totalPct}%</span>
        </div>
        <div class="monolith-balance-row">
          <div>
            <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #fff;">Месячные лимиты бюджетов</h1>
            <p class="sub" style="margin-top: 4px;">Установление жестких финансовых порогов по категориям на текущий период</p>
          </div>
          <button id="addbudget">
            ${icon('plus', 13)}
            <span>Установить лимит</span>
          </button>
        </div>
      </section>

      <section class="meridian-section" style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <span style="font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">СУММАРНЫЙ ПУЛ ЛИМИТОВ</span>
            <div style="font-family: var(--font-mono); font-size: 26px; font-weight: 800; color: #fff; margin-top: 4px;">
              ${money(totalSpent)} <span style="font-size: 16px; color: var(--text-muted);">/ ${money(totalBudget)}</span>
            </div>
          </div>
          <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: ${totalPct > 100 ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};">
            ${totalPct > 100 ? 'ПРЕВЫШЕНИЕ ЛИМИТА' : 'В РАМКАХ НОРМАТИВА'}
          </span>
        </div>
        <div class="allocation-track" style="margin-top: 14px; height: 6px;">
          <div style="height: 100%; width: ${Math.min(100, totalPct)}%; background: ${totalPct > 100 ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};"></div>
        </div>
      </section>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${data.budgets.length ? data.budgets.map(b => {
          const spent = data.transactions
            .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && isThisMonth(t.occurred_on))
            .reduce((s, t) => s + Number(t.amount), 0);
          const limit = Number(b.limit_amount) || 1;
          const pct = Math.round((spent / limit) * 100);
          const isOver = pct > 100;

          return `
            <div style="border: 1px solid var(--hairline); background: var(--bg-surface); padding: 18px 24px; border-radius: var(--radius-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                  <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: #fff;">${esc(b.category)}</span>
                  <span style="font-family: var(--font-mono); font-size: 11px; margin-left: 10px; color: ${isOver ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};">
                    ${isOver ? 'Перерасход: ' + money(spent - limit) : 'Остаток: ' + money(limit - spent)}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 14px;">
                  <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 700;">
                    ${money(spent)} <small style="color: var(--text-muted)">/ ${money(limit)}</small>
                  </span>
                  <button class="action-btn-del" data-del="budgets:${b.id}" title="Удалить лимит">
                    ${icon('trash', 13)}
                  </button>
                </div>
              </div>
              <div class="allocation-track" style="margin: 0; height: 4px;">
                <div style="height: 100%; width: ${Math.min(100, pct)}%; background: ${isOver ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};"></div>
              </div>
            </div>
          `;
        }).join('') : `
          <div style="border: 1px solid var(--hairline); padding: 36px; text-align: center; font-family: var(--font-mono); color: var(--text-muted);">
            Лимиты по статьям расходов еще не зафиксированы.
          </div>
        `}
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
      <section class="monolith-header">
        <div class="monolith-meta-strip">
          <span>КАПИТАЛЬНЫЕ ЦЕЛИ</span>
          <span>ОБЩИЙ ПРОГРЕСС: ${overallPct}%</span>
        </div>
        <div class="monolith-balance-row">
          <div>
            <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #fff;">Стратегические цели капитала</h1>
            <p class="sub" style="margin-top: 4px;">Фонды накопления, резервный капитал и инвестиционные рубежи</p>
          </div>
          <button id="addgoal">
            ${icon('plus', 13)}
            <span>Создать цель</span>
          </button>
        </div>
      </section>

      <section class="meridian-section" style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <span style="font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted);">АККУМУЛИРОВАНО СРЕДСТВ</span>
            <div style="font-family: var(--font-mono); font-size: 26px; font-weight: 800; color: #fff; margin-top: 4px;">
              ${money(totalSaved)} <span style="font-size: 16px; color: var(--text-muted);">/ ${money(totalTarget)}</span>
            </div>
          </div>
          <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--accent-emerald);">
            ${overallPct}% НАКОПЛЕНО
          </span>
        </div>
        <div class="allocation-track" style="margin-top: 14px; height: 6px;">
          <div style="height: 100%; width: ${overallPct}%; background: linear-gradient(90deg, #00e599, #06b6d4);"></div>
        </div>
      </section>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${data.goals.length ? data.goals.map(g => {
          const saved = Number(g.saved_amount) || 0;
          const target = Number(g.target_amount) || 1;
          const pct = Math.min(100, Math.round((saved / target) * 100));
          const remains = Math.max(0, target - saved);

          return `
            <div style="border: 1px solid var(--hairline); background: var(--bg-surface); padding: 18px 24px; border-radius: var(--radius-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                  <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: #fff;">${esc(g.name)}</span>
                  <span style="font-family: var(--font-mono); font-size: 11px; margin-left: 10px; color: var(--accent-emerald);">
                    ${pct >= 100 ? 'Цель закрыта' : 'Осталось: ' + money(remains)}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 700;">
                    ${money(saved)} <small style="color: var(--text-muted)">/ ${money(target)}</small>
                  </span>
                  <button class="btn-secondary btn-sm" data-topup="${g.id}" data-saved="${saved}">＋ Внести</button>
                  <button class="action-btn-del" data-del="goals:${g.id}">
                    ${icon('trash', 13)}
                  </button>
                </div>
              </div>
              <div class="allocation-track" style="margin: 0; height: 4px;">
                <div style="height: 100%; width: ${pct}%; background: var(--accent-emerald);"></div>
              </div>
            </div>
          `;
        }).join('') : `
          <div style="border: 1px solid var(--hairline); padding: 36px; text-align: center; font-family: var(--font-mono); color: var(--text-muted);">
            Цели накопления капитала еще не добавлены.
          </div>
        `}
      </div>
    `;
  }

  /* ----------------------------------------------------
     5. АНАЛИТИКА (ANALYTICS)
     ---------------------------------------------------- */
  if (tab === 'analytics') {
    const isW = analyticsPeriod === 'week';

    return `
      <section class="monolith-header">
        <div class="monolith-meta-strip">
          <span>ГЛУБОКИЙ СРЕЗ КАПИТАЛА</span>
          <div style="display: flex; gap: 6px;">
            <button class="${isW ? '' : 'btn-secondary'} btn-sm" data-period="week">7 дней</button>
            <button class="${!isW ? '' : 'btn-secondary'} btn-sm" data-period="month">Месяц</button>
          </div>
        </div>
        <div class="monolith-balance-row">
          <div>
            <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #fff;">Финансовый срез и аудит</h1>
            <p class="sub" style="margin-top: 4px;">Аналитическая матрица эффективности расходов и соответствия нормативу 50/30/20</p>
          </div>
          <button data-ask-ai="Проведи детальный финансовый аудит моих расходов за выбранный период: оцени соблюдение правила 50/30/20, покажи аномалии и дай 3 точных шага по оптимизации.">
            ${icon('sparkles', 13)}
            <span>Запросить AI-аудит</span>
          </button>
        </div>
      </section>

      <section class="ledger-metrics-grid">
        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">Суммарный расход</div>
          <div class="ledger-metric-val" style="color: #fda4af;">−${money(exp)}</div>
          <div class="ledger-metric-footer">За учетный период</div>
        </div>
        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">Суммарный доход</div>
          <div class="ledger-metric-val" style="color: var(--accent-emerald);">+${money(inc)}</div>
          <div class="ledger-metric-footer">Поступления на счета</div>
        </div>
        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">Чистая дельта</div>
          <div class="ledger-metric-val" style="color: var(--accent-platinum);">${money(capital)}</div>
          <div class="ledger-metric-footer">Свободный баланс</div>
        </div>
        <div class="ledger-metric-cell">
          <div class="ledger-metric-label">Сберегательный темп</div>
          <div class="ledger-metric-val" style="color: var(--accent-emerald);">${savingsRate}%</div>
          <div class="ledger-metric-footer">Норматив > 20%</div>
        </div>
      </section>

      <section class="allocation-strip" style="margin-top: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted);">СТРУКТУРА БЮДЖЕТА ПО ПРАВИЛУ 50 / 30 / 20</span>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-platinum);">ЭТАЛОННЫЙ СРЕЗ</span>
        </div>

        <div class="allocation-track" style="margin: 16px 0; height: 10px;">
          <div style="height: 100%; width: ${pNeeds}%; background: #00e599;"></div>
          <div style="height: 100%; width: ${pWants}%; background: #f59e0b;"></div>
          <div style="height: 100%; width: ${pSavings}%; background: #06b6d4;"></div>
        </div>

        <div class="allocation-legend">
          <div><span style="color: #00e599;">●</span> Обязательства (Нужды): <b>${pNeeds}%</b> (${money(needs)})</div>
          <div><span style="color: #f59e0b;">●</span> Качество жизни (Желания): <b>${pWants}%</b> (${money(wants)})</div>
          <div><span style="color: #06b6d4;">●</span> Сбережения и цели: <b>${pSavings}%</b> (${money(savings)})</div>
        </div>
      </section>
    `;
  }

  /* ----------------------------------------------------
     6. ИИ-КОНСОЛЬ (ASSISTANT)
     ---------------------------------------------------- */
  return `
    <section class="monolith-header">
      <div class="monolith-meta-strip">
        <span>ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИТИК</span>
        <span>МОДЕЛЬ: FINKAIF AI ENGINE</span>
      </div>
      <div class="monolith-balance-row">
        <div>
          <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #fff;">Финансовый разум FinKaif</h1>
          <p class="sub" style="margin-top: 4px;">Персональный синтез и моделирование решений на основе реальных проводок леджера</p>
        </div>
      </div>
    </section>

    <div style="border: 1px solid var(--hairline); background: var(--bg-surface); padding: 24px; border-radius: var(--radius-sm);">
      <div style="margin-bottom: 12px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">
        СТРАТЕГИЧЕСКИЕ СЦЕНАРИИ АНАЛИЗА:
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
        <button class="btn-secondary btn-sm" data-ask-ai="Проанализируй структуру моих трат и подскажи 3 конкретных шага, как сберегать 15% бюджета без потери качества жизни.">
          💡 Оптимизация 15% расходов
        </button>
        <button class="btn-secondary btn-sm" data-ask-ai="Оцени мой финансовый баланс по правилу 50/30/20 на основе зафиксированных операций.">
          ⚖️ Аудит правила 50/30/20
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
          <div style="text-align: center; padding: 48px; color: var(--text-muted); font-family: var(--font-mono);">
            <div>${icon('sparkles', 28)}</div>
            <div style="margin-top: 10px; font-weight: 700; color: #fff;">Ядро финансового аудита готово к диалогу</div>
            <p style="margin-top: 4px; font-size: 12px;">Задайте финансовый вопрос или выберите сценарий выше</p>
          </div>
        `}
      </div>

      <form class="ask" id="ask" style="margin-top: 14px; display: flex; gap: 10px;">
        <textarea id="question" placeholder="Задайте вопрос финансовому ментору (напр. «Куда направить 50 000 ₽ профицита?»)..."></textarea>
        <button type="submit" style="padding: 0 20px;">
          ${icon('assistant', 14)}
          <span>Отправить</span>
        </button>
      </form>
    </div>
  `;
}

/* =========================================
   MODAL CONTROLS
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
  if (modal) modal.style.display = 'none';
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
    console.error('Синхронизация данных реестра:', err);
  }

  render();
}

/* =========================================
   RENDER & EVENT BINDINGS
   ========================================= */
function render() {
  $('#app').innerHTML = layout();
  $('#page').innerHTML = page();

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
      if (confirm('Аннулировать данную проводку из леджера?')) {
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
      const category = prompt('Статья расхода:');
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
      const target_amount = prompt('Целевая сумма капитала (₽):');
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
        { role: 'assistant', content: 'Формирую аналитическую справку…' }
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
}

// Global Hotkey Ctrl+K / Cmd+K to open new operation modal
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOpModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openOpModal();
  }
});

/* =======================================================
   THE ARCHITECTURAL OBSIDIAN CANVASAURA (60 FPS)
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

  const blobs = [
    { x: w * 0.18, y: h * 0.22, baseR: 440, r: 440, vx: 0.45, vy: 0.35, phase: 0, color: 'rgba(0, 229, 153, ' },
    { x: w * 0.82, y: h * 0.35, baseR: 480, r: 480, vx: -0.4, vy: 0.4, phase: 1.5, color: 'rgba(5, 150, 105, ' },
    { x: w * 0.5, y: h * 0.85, baseR: 420, r: 420, vx: 0.35, vy: -0.3, phase: 3.1, color: 'rgba(4, 120, 87, ' },
    { x: w * 0.28, y: h * 0.72, baseR: 360, r: 360, vx: -0.3, vy: -0.35, phase: 4.2, color: 'rgba(216, 208, 194, ' }
  ];

  const particles = Array.from({ length: 45 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.6 + 0.2,
    speed: Math.random() * 0.35 + 0.12,
    pulse: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1)
  }));

  let time = 0;

  function draw() {
    time += 0.012;

    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    ctx.clearRect(0, 0, w, h);

    // Deep Obsidian Base
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.3, 100, w * 0.5, h * 0.5, Math.max(w, h));
    bgGrad.addColorStop(0, '#050906');
    bgGrad.addColorStop(0.6, '#030604');
    bgGrad.addColorStop(1, '#020403');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Interactive Cursor Radiant Halo
    const cursorGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 380);
    cursorGrad.addColorStop(0, 'rgba(0, 229, 153, 0.18)');
    cursorGrad.addColorStop(0.5, 'rgba(0, 229, 153, 0.05)');
    cursorGrad.addColorStop(1, 'rgba(0, 229, 153, 0)');
    ctx.fillStyle = cursorGrad;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 380, 0, Math.PI * 2);
    ctx.fill();

    // Moving Aurora Waves
    blobs.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;

      if (b.x < -100 || b.x > w + 100) b.vx *= -1;
      if (b.y < -100 || b.y > h + 100) b.vy *= -1;

      b.r = b.baseR + Math.sin(time + b.phase) * 50;

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.color + '0.38)');
      g.addColorStop(0.45, b.color + '0.14)');
      g.addColorStop(0.85, b.color + '0.02)');
      g.addColorStop(1, b.color + '0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Floating Architectural Micro-Sparks
    particles.forEach(p => {
      p.y -= p.speed;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      p.alpha += p.pulse;
      if (p.alpha > 0.8 || p.alpha < 0.2) p.pulse *= -1;

      ctx.fillStyle = `rgba(0, 229, 153, ${Math.max(0.1, Math.min(1, p.alpha))})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
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
