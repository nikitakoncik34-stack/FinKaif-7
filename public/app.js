const $ = s => document.querySelector(s);

let me = null;
let tab = 'home';
let mode = 'login';
let analyticsPeriod = 'week';
let txFilter = 'all';

let data = {
  transactions: [],
  budgets: [],
  goals: [],
  chat: []
};

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
    throw Error(j.error || 'Ошибка');
  }

  return j;
};

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

const getCatIcon = cat => {
  const c = String(cat || '').toLowerCase().trim();
  if (c.includes('ед') || c.includes('продукт') || c.includes('супермаркет') || c.includes('магаз')) return '🍔';
  if (c.includes('кафе') || c.includes('ресторан') || c.includes('бар') || c.includes('кофе')) return '☕';
  if (c.includes('такси') || c.includes('транспорт') || c.includes('метро') || c.includes('бензин') || c.includes('авто')) return '🚕';
  if (c.includes('дом') || c.includes('жиль') || c.includes('аренд') || c.includes('жкх') || c.includes('коммунал')) return '🏠';
  if (c.includes('покупк') || c.includes('одежд') || c.includes('шоппинг') || c.includes('вещи')) return '🛍️';
  if (c.includes('связь') || c.includes('интернет') || c.includes('телефон') || c.includes('подписк')) return '📱';
  if (c.includes('развлеч') || c.includes('кино') || c.includes('игр') || c.includes('клуб')) return '🎬';
  if (c.includes('здоров') || c.includes('аптек') || c.includes('врач') || c.includes('спорт')) return '💊';
  if (c.includes('отпуск') || c.includes('путешеств') || c.includes('билет') || c.includes('отель')) return '🏖️';
  if (c.includes('зарплат') || c.includes('доход') || c.includes('аванс') || c.includes('преми')) return '💰';
  if (c.includes('подар') || c.includes('праздник')) return '🎁';
  if (c.includes('инвест') || c.includes('вклад') || c.includes('акци')) return '📈';
  return '💳';
};


/* =========================
   ВХОД / РЕГИСТРАЦИЯ
========================= */

function auth() {
  const isLogin = mode === 'login';

  return `
    <div class="auth">
      <div class="authbox">

        <div class="brand"><span>Fin</span><b>kaif</b></div>

        <h1 id="title">
          ${isLogin ? 'Вход' : 'Регистрация'}
        </h1>

        <p class="sub">
          Личные финансы в облаке
        </p>

        <form id="authform">

          <label>
            Email
            <input
              id="email"
              type="email"
              required
              autocomplete="email"
            >
          </label>

          <label>
            Пароль
            <input
              id="password"
              type="password"
              minlength="6"
              required
              autocomplete="${isLogin ? 'current-password' : 'new-password'}"
            >
          </label>

          <button id="submit" type="submit">
            ${isLogin ? 'Войти' : 'Создать аккаунт'}
          </button>

        </form>

        <div class="notice" id="notice"></div>

        <button
          class="secondary"
          id="switch"
          type="button"
        >
          ${isLogin
            ? 'Нет аккаунта? Регистрация'
            : 'Уже есть аккаунт? Войти'}
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

  if (!form || !switchButton) {
    return;
  }

  form.onsubmit = async e => {

    e.preventDefault();

    const email = $('#email').value.trim();
    const password = $('#password').value;

    if (notice) notice.textContent = '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = mode === 'login' ? 'Вход…' : 'Регистрация…';
    }

    try {

      const res = await api('auth/' + mode, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        })
      });

      if (res && res.token) {
        localStorage.setItem('finkaif_token', res.token);
      }

      await boot();

    } catch (err) {

      if (notice) {
        notice.textContent = err.message;
      } else {
        alert(err.message);
      }

    } finally {

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
      }

    }
  };


  switchButton.onclick = () => {

    mode = mode === 'login'
      ? 'register'
      : 'login';

    $('#app').innerHTML = auth();

    setupAuth();
  };
}


/* =========================
   НАВИГАЦИЯ
========================= */

function nav() {

  return [
    ['home', '⌂ Главная'],
    ['transactions', '↕ Операции'],
    ['budgets', '▦ Бюджет'],
    ['goals', '☆ Цели'],
    ['analytics', '📊 Аналитика'],
    ['assistant', '✦ ИИ-помощник']
  ]
    .map(x => `
      <button
        data-tab="${x[0]}"
        class="${tab === x[0] ? 'active' : ''}"
      >
        ${x[1]}
      </button>
    `)
    .join('');
}


/* =========================
   ОСНОВНОЙ LAYOUT
========================= */

function layout() {
  return `
    <div class="app">
      <aside>
        <div class="brand">
          <div class="brand-dot"></div>
          <span>Fin</span><b>kaif</b>
        </div>
        ${nav()}
        <button class="logout" id="logout">
          Выйти
        </button>
      </aside>
      <main>
        <div id="page"></div>
      </main>
    </div>
  `;
}


/* =========================
   СПИСКИ
========================= */

function list(rows, view, res) {
  return rows.length
    ? rows.map(x => `
        <div class="item">
          ${view(x)}
          <button
            class="delete"
            data-del="${res}:${x.id}"
            title="Удалить"
          >
            ×
          </button>
        </div>
      `).join('')
    : '<p class="sub">Пока нет данных.</p>';
}


/* =========================
   СТРАНИЦЫ
========================= */

function page() {
  const inc = data.transactions
    .filter(x => x.type === 'income')
    .reduce((s, x) => s + Number(x.amount), 0);

  const exp = data.transactions
    .filter(x => x.type === 'expense')
    .reduce((s, x) => s + Number(x.amount), 0);

  /* -----------------------------------------
     1. ГЛАВНАЯ (HOME) - ТОЛЬКО ЗДЕСЬ ДОБРЫЙ ДЕНЬ
     ----------------------------------------- */
  if (tab === 'home') {
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
    const maxDayExp = Math.max(1, ...days.map(d => d.exp));

    const expByCat = {};
    data.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount);
      });
    const catEntries = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
    const userName = me && me.email ? me.email.split('@')[0] : 'Инвестор';

    return `
      <div class="page-header">
        <div>
          <div class="page-tag">Обзор экосистемы</div>
          <h1>Добрый день, ${esc(userName)} 👋</h1>
          <p class="sub">Ваш капитал, аналитика трат и персональный ментор</p>
        </div>
        <button id="quick" data-tab="transactions">＋ Новая операция</button>
      </div>

      <!-- 3D Onyx Titanium Luxury Virtual Card -->
      <div class="virtual-card-wrap">
        <div class="virtual-card" id="titanium-card">
          <div class="card-glare"></div>
          <div class="card-top">
            <div class="card-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              FINKAIF ONYX TITANIUM
            </div>
            <span class="card-status">● Активен</span>
          </div>
          <div class="card-chip"></div>
          <div class="card-number">•••• •••• •••• 7842</div>
          <div class="card-bottom">
            <div>
              <div class="card-balance-lbl">Доступный капитал</div>
              <div class="card-balance-val">${money(inc - exp)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Держатель</div>
              <div class="card-holder">${esc(userName.toUpperCase())}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="kpi-card">
          <div class="kpi-lbl">ДОХОДЫ</div>
          <span class="value" style="color: #34d399;">+${money(inc)}</span>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl">РАСХОДЫ</div>
          <span class="value" style="color: #fda4af;">−${money(exp)}</span>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl">НОРМА СБЕРЕЖЕНИЙ</div>
          <span class="value" style="color: #a5b4fc;">${inc ? Math.round(((inc - exp) / inc) * 100) + '%' : '—'}</span>
        </div>
      </div>

      <div class="card">
        <div class="row">
          <h2>📈 Динамика расходов за 7 дней</h2>
          <small>Всего: ${money(days.reduce((s, d) => s + d.exp, 0))}</small>
        </div>
        <div class="barchart">
          ${days.map(d => `
            <div class="barchart-col">
              <span class="barchart-val">${d.exp > 0 ? money(d.exp) : ''}</span>
              <div class="barchart-bar-wrap">
                <div class="barchart-bar" style="height: ${d.exp > 0 ? Math.max(8, Math.round((d.exp / maxDayExp) * 100)) : 4}%" title="${d.name}: ${money(d.exp)}"></div>
              </div>
              <span class="barchart-label">${d.name}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${catEntries.length ? `
        <div class="card">
          <div class="row">
            <h2>🏷️ Расходы по категориям</h2>
            <small>${catEntries.length} категорий</small>
          </div>
          <div style="margin-top: 14px;">
            ${catEntries.slice(0, 5).map(([cat, amt]) => {
              const pct = exp > 0 ? Math.round((amt / exp) * 100) : 0;
              return `
                <div style="margin: 16px 0;">
                  <div class="row" style="margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="font-size: 18px;">${getCatIcon(cat)}</span>
                      <b>${esc(cat)}</b>
                    </div>
                    <span>
                      <b style="font-family: var(--font-mono);">${money(amt)}</b>
                      <small style="color: var(--text-muted); margin-left: 4px;">(${pct}%)</small>
                    </span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill safe" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="row">
          <div>
            <h2>✦ Финансовый ментор Finkaif</h2>
            <p class="sub">Персональные советы, оптимизация бюджета и аудит ваших трат в кайф.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button data-tab="analytics" class="secondary">📊 Аналитика</button>
            <button data-tab="assistant">Открыть чат</button>
          </div>
        </div>
      </div>
    `;
  }

  /* -----------------------------------------
     2. ОПЕРАЦИИ (TRANSACTIONS)
     ----------------------------------------- */
  if (tab === 'transactions') {
    let filteredList = data.transactions;
    if (txFilter === 'expense') filteredList = data.transactions.filter(x => x.type === 'expense');
    if (txFilter === 'income') filteredList = data.transactions.filter(x => x.type === 'income');

    return `
      <div class="page-header">
        <div>
          <div class="page-tag">Журнал операций</div>
          <h1>История операций</h1>
          <p class="sub">Фиксация доходов, расходов и быстрое распределение по категориям</p>
        </div>
        <div class="filter-tabs">
          <button class="filter-btn ${txFilter === 'all' ? 'active' : ''}" data-tx-filter="all">Все (${data.transactions.length})</button>
          <button class="filter-btn ${txFilter === 'expense' ? 'active' : ''}" data-tx-filter="expense">Расходы</button>
          <button class="filter-btn ${txFilter === 'income' ? 'active' : ''}" data-tx-filter="income">Доходы</button>
        </div>
      </div>

      <div class="card">
        <h2>＋ Новая операция</h2>
        <div class="chips-row">
          <span class="chip" data-cat="Продукты" data-type="expense">🍔 Продукты</span>
          <span class="chip" data-cat="Кафе" data-type="expense">☕ Кафе</span>
          <span class="chip" data-cat="Такси" data-type="expense">🚕 Такси</span>
          <span class="chip" data-cat="ЖКХ" data-type="expense">🏠 ЖКХ</span>
          <span class="chip" data-cat="Покупки" data-type="expense">🛍️ Покупки</span>
          <span class="chip" data-cat="Здоровье" data-type="expense">💊 Здоровье</span>
          <span class="chip" data-cat="Зарплата" data-type="income">💰 Зарплата</span>
          <span class="chip" data-cat="Инвестиции" data-type="income">📈 Инвестиции</span>
        </div>
        <form class="form" id="opform">
          <select id="type">
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
          <input id="category" placeholder="Категория (еда, такси...)" required>
          <input id="description" placeholder="Описание (необязательно)">
          <input id="amount" type="number" min="1" placeholder="Сумма (₽)" required>
          <input id="date" type="date" value="${new Date().toISOString().slice(0, 10)}">
          <button>Сохранить</button>
        </form>
      </div>

      <div class="card">
        <h2>Лента операций</h2>
        <div style="margin-top: 14px;">
          ${list(
            filteredList,
            x => `
              <div style="display: flex; align-items: center; gap: 14px;">
                <div class="cat-icon-badge">${getCatIcon(x.category)}</div>
                <div>
                  <b style="font-size: 15px; letter-spacing: -0.2px;">${esc(x.category)}</b>
                  <small style="color: var(--text-muted);">${esc(x.description || 'Без описания')} · ${x.occurred_on}</small>
                </div>
              </div>
              <div style="margin-left: auto; margin-right: 14px; text-align: right;">
                <b style="font-family: var(--font-mono); font-size: 16px; color: ${x.type === 'income' ? '#34d399' : '#fda4af'}; font-weight: 700;">
                  ${x.type === 'income' ? '+' : '−'}${money(x.amount)}
                </b>
              </div>
            `,
            'transactions'
          )}
        </div>
      </div>
    `;
  }

  /* -----------------------------------------
     3. БЮДЖЕТЫ (BUDGETS)
     ----------------------------------------- */
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
      <div class="page-header">
        <div>
          <div class="page-tag">Финансовая дисциплина</div>
          <h1>Месячные бюджеты</h1>
          <p class="sub">Лимиты по категориям на текущий месяц для защиты от перерасходов</p>
        </div>
        <button id="addbudget">＋ Установить лимит</button>
      </div>

      <div class="card">
        <div class="row">
          <div>
            <h2>Суммарный баланс бюджетов месяца</h2>
            <p class="sub" style="margin-top: 4px;">Израсходовано ${money(totalSpent)} из ${money(totalBudget)} запланированных</p>
          </div>
          <span class="badge ${totalPct > 100 ? 'danger' : totalPct >= 80 ? 'warn' : 'safe'}">
            ${totalPct}% освоено
          </span>
        </div>
        <div class="progress-track" style="margin-top: 14px; height: 11px;">
          <div class="progress-fill ${totalPct > 100 ? 'danger' : totalPct >= 80 ? 'warn' : 'safe'}" style="width: ${Math.min(100, totalPct)}%;"></div>
        </div>
      </div>

      <div class="card">
        <div class="row" style="margin-bottom: 12px;">
          <h2>Категории под контролем</h2>
          <small>${data.budgets.length} лимитов</small>
        </div>
        ${data.budgets.length ? data.budgets.map(b => {
          const spent = data.transactions
            .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && isThisMonth(t.occurred_on))
            .reduce((s, t) => s + Number(t.amount), 0);
          const limit = Number(b.limit_amount) || 1;
          const pct = Math.round((spent / limit) * 100);
          const cls = pct > 100 ? 'danger' : pct >= 80 ? 'warn' : 'safe';
          const badgeText = pct > 100
            ? `<span class="badge danger">Перерасход на ${money(spent - limit)}</span>`
            : pct >= 80
            ? `<span class="badge warn">Использовано ${pct}%</span>`
            : `<span class="badge safe">В норме (${pct}%)</span>`;

          return `
            <div class="item" style="flex-direction: column; align-items: stretch; gap: 8px;">
              <div class="row">
                <div>
                  <b style="font-size: 16px;">${getCatIcon(b.category)} ${esc(b.category)}</b>
                  <div style="margin-top: 4px;">${badgeText}</div>
                </div>
                <div style="text-align: right;">
                  <div><b>${money(spent)}</b> <small style="color: var(--text-muted)">/ ${money(limit)}</small></div>
                  <small style="color: var(--text-muted)">${pct <= 100 ? 'Осталось ' + money(limit - spent) : 'Лимит превышен'}</small>
                </div>
                <button class="delete" data-del="budgets:${b.id}">×</button>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${cls}" style="width: ${Math.min(100, pct)}%;"></div>
              </div>
            </div>
          `;
        }).join('') : '<p class="sub">Бюджеты пока не добавлены. Нажмите «＋ Установить лимит», чтобы отслеживать категории расходов.</p>'}
      </div>
    `;
  }

  /* -----------------------------------------
     4. ЦЕЛИ (GOALS)
     ----------------------------------------- */
  if (tab === 'goals') {
    const totalSaved = data.goals.reduce((s, g) => s + (Number(g.saved_amount) || 0), 0);
    const totalTarget = data.goals.reduce((s, g) => s + (Number(g.target_amount) || 0), 0);
    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

    return `
      <div class="page-header">
        <div>
          <div class="page-tag">Копилки и мечты</div>
          <h1>Финансовые цели</h1>
          <p class="sub">Накопления на резервный фонд, крупные покупки и инвестиции</p>
        </div>
        <button id="addgoal">＋ Создать цель</button>
      </div>

      <div class="card">
        <div class="row">
          <div>
            <h2>Общий прогресс накоплений</h2>
            <p class="sub" style="margin-top: 4px;">Собрано ${money(totalSaved)} из ${money(totalTarget)} совокупных целей</p>
          </div>
          <span class="badge ${overallPct >= 100 ? 'safe' : 'warn'}">
            ${overallPct}% накоплено
          </span>
        </div>
        <div class="progress-track" style="margin-top: 14px; height: 11px;">
          <div class="progress-fill goal" style="width: ${overallPct}%;"></div>
        </div>
      </div>

      <div class="card">
        <div class="row" style="margin-bottom: 12px;">
          <h2>Активные цели</h2>
          <small>${data.goals.length} целей</small>
        </div>
        ${data.goals.length ? data.goals.map(g => {
          const saved = Number(g.saved_amount) || 0;
          const target = Number(g.target_amount) || 1;
          const pct = Math.min(100, Math.round((saved / target) * 100));
          const remains = Math.max(0, target - saved);

          return `
            <div class="item" style="flex-direction: column; align-items: stretch; gap: 8px;">
              <div class="row">
                <div>
                  <b style="font-size: 16px;">🎯 ${esc(g.name)}</b>
                  <div style="margin-top: 4px;">
                    <span class="badge ${pct >= 100 ? 'safe' : 'warn'}">
                      ${pct >= 100 ? '🎉 Цель достигнута!' : 'Собрано ' + pct + '%'}
                    </span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div><b>${money(saved)}</b> <small style="color: var(--text-muted)">из ${money(target)}</small></div>
                  <small style="color: var(--text-muted)">${remains > 0 ? 'Осталось ' + money(remains) : 'Цель закрыта'}</small>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button class="mini-btn" data-topup="${g.id}" data-saved="${saved}">＋ Внести</button>
                  <button class="delete" data-del="goals:${g.id}">×</button>
                </div>
              </div>
              <div class="progress-track">
                <div class="progress-fill goal" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('') : '<p class="sub">Цели пока не созданы. Нажмите «＋ Создать цель», чтобы копить на важное.</p>'}
      </div>
    `;
  }

  /* -----------------------------------------
     5. АНАЛИТИКА (ANALYTICS)
     ----------------------------------------- */
  if (tab === 'analytics') {
    const isW = analyticsPeriod === 'week';

    const header = `
      <div class="page-header">
        <div>
          <div class="page-tag">Глубокий аудит</div>
          <h1>Финансовая аналитика</h1>
          <p class="sub">Динамика расходов, крупные покупки и баланс по правилу 50/30/20</p>
        </div>
        <div class="switch-tabs">
          <button class="${isW ? 'active' : ''}" data-period="week">7 дней</button>
          <button class="${!isW ? 'active' : ''}" data-period="month">Месяц</button>
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
        ${header}

        <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
          <div class="kpi-card">
            <div class="kpi-lbl">РАСХОДЫ НЕДЕЛИ</div>
            <span class="value" style="color: #fda4af;">${money(wExp)}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">ДОХОДЫ НЕДЕЛИ</div>
            <span class="value" style="color: #34d399;">${money(wInc)}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">В СРЕДНЕМ В ДЕНЬ</div>
            <span class="value">${money(wAvgDay)}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">ДЕЛЬТА НЕДЕЛИ</div>
            <span class="value" style="color: #a5b4fc;">${money(wInc - wExp)}</span>
          </div>
        </div>

        <div class="card">
          <h2>📊 Расходы по дням (последние 7 дней)</h2>
          <div class="barchart">
            ${days.map(d => `
              <div class="barchart-col">
                <span class="barchart-val">${d.exp > 0 ? money(d.exp) : ''}</span>
                <div class="barchart-bar-wrap">
                  <div class="barchart-bar" style="height: ${d.exp > 0 ? Math.max(8, Math.round((d.exp / maxDay) * 100)) : 4}%" title="${d.name}: ${money(d.exp)}"></div>
                </div>
                <span class="barchart-label">${d.name}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h2>🔥 Топ-3 самых крупных трат недели</h2>
          ${topExpense.length ? topExpense.map((t, idx) => `
            <div class="item">
              <div>
                <b>#${idx + 1} ${getCatIcon(t.category)} ${esc(t.category)}</b>
                <small>${esc(t.description || 'Без описания')} · ${t.occurred_on}</small>
              </div>
              <b style="font-size: 16px; color: #fda4af;">−${money(t.amount)}</b>
            </div>
          `).join('') : '<p class="sub">За последние 7 дней расходов нет.</p>'}
        </div>

        <div class="ai-banner">
          <div>
            <h3>✦ AI-разбор недели от ментора Finkaif</h3>
            <p>Получите анализ темпа трат, оценку перерасходов и персональный совет на предстоящую неделю.</p>
          </div>
          <button data-ask-ai="Сделай подробный разбор моих финансов за прошедшую неделю: оцени динамику расходов, выдели слабые места и дай 3 совета на следующую неделю.">
            ✨ Запросить разбор недели
          </button>
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

      const rateBadge = savingsRate >= 20
        ? '<span class="badge safe">Отлично (сбережения > 20%)</span>'
        : savingsRate >= 10
        ? '<span class="badge warn">Хорошо (сбережения 10–20%)</span>'
        : '<span class="badge danger">Зона внимания (< 10%)</span>';

      return `
        ${header}

        <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
          <div class="kpi-card">
            <div class="kpi-lbl">РАСХОДЫ МЕСЯЦА</div>
            <span class="value" style="color: #fda4af;">${money(mExp)}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">ДОХОДЫ МЕСЯЦА</div>
            <span class="value" style="color: #34d399;">${money(mInc)}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">СБЕРЕЖЕНО В МЕСЯЦЕ</div>
            <span class="value" style="color: #a5b4fc;">${money(mDelta)}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">НОРМА СБЕРЕЖЕНИЙ</div>
            <span class="value">${savingsRate}%</span>
          </div>
        </div>

        <div class="card">
          <div class="row">
            <h2>⚖️ Распределение по правилу 50/30/20</h2>
            <div>${rateBadge}</div>
          </div>
          <p class="sub" style="margin-top: 4px;">Сравнение вашей картины с идеальным балансом (50% нужды / 30% желания / 20% цели):</p>
          <div class="ratio-track">
            <div class="ratio-seg ratio-needs" style="width: ${pNeeds}%;" title="Нужды: ${pNeeds}%"></div>
            <div class="ratio-seg ratio-wants" style="width: ${pWants}%;" title="Желания: ${pWants}%"></div>
            <div class="ratio-seg ratio-savings" style="width: ${pSavings}%;" title="Сбережения: ${pSavings}%"></div>
          </div>
          <div class="ratio-legend">
            <div class="ratio-legend-item">
              <span class="ratio-dot" style="background: #3b82f6;"></span>
              <span>Базовые нужды: <b>${pNeeds}%</b> (${money(needs)}) [Норма 50%]</span>
            </div>
            <div class="ratio-legend-item">
              <span class="ratio-dot" style="background: #f97316;"></span>
              <span>Желания и комфорт: <b>${pWants}%</b> (${money(wants)}) [Норма 30%]</span>
            </div>
            <div class="ratio-legend-item">
              <span class="ratio-dot" style="background: #10b981;"></span>
              <span>Сбережения и цели: <b>${pSavings}%</b> (${money(savings)}) [Норма 20%]</span>
            </div>
          </div>
        </div>

        <div class="ai-banner">
          <div>
            <h3>✦ Финансовый отчет месяца от ментора Finkaif</h3>
            <p>ИИ проведет комплексный аудит месяца, оценит ваши бюджеты и предложит стратегию на следующий месяц.</p>
          </div>
          <button data-ask-ai="Подведи подробные итоги этого месяца: проанализируй соблюдение правила 50/30/20, покажи, где был перерасход, и составь персональную стратегию на следующий месяц.">
            ✨ Запросить отчет за месяц
          </button>
        </div>
      `;
    }
  }

  /* -----------------------------------------
     6. ИИ-ПОМОЩНИК (ASSISTANT)
     ----------------------------------------- */
  return `
    <div class="page-header">
      <div>
        <div class="page-tag">Интеллектуальный советник</div>
        <h1>FinKaif AI-ментор</h1>
        <p class="sub">Персональный ментор с анализом ваших реальных транзакций, бюджетов и целей</p>
      </div>
    </div>

    <div class="card">
      <h2>Быстрые сценарии анализа</h2>
      <div class="prompt-chips-wrap">
        <span class="prompt-chip" data-ask-ai="Проанализируй мои расходы и подскажи 3 конкретных шага, как сэкономить 15% бюджета без ущерба комфорту.">💡 Как снизить траты на 15%?</span>
        <span class="prompt-chip" data-ask-ai="Оцени мой финансовый баланс по правилу 50/30/20. Соблюдаются ли пропорции?">⚖️ Аудит правила 50/30/20</span>
        <span class="prompt-chip" data-ask-ai="Рассчитай оптимальный размер финансовой подушки безопасности на основе моих расходов.">🛡️ Подушка безопасности</span>
        <span class="prompt-chip" data-ask-ai="Посмотри на мои цели накоплений и подскажи оптимальный помесячный план для их закрытия.">🎯 Стратегия закрытия целей</span>
      </div>

      <div class="messages">
        ${data.chat
          .map(x => `
            <div class="msg ${x.role}">
              ${formatMsg(x.content)}
            </div>
          `)
          .join('')}
      </div>

      <form class="ask" id="ask">
        <textarea id="question" placeholder="Задайте финансовый вопрос (например: «Куда лучше направить 30 000 ₽ свободных средств?»)..."></textarea>
        <button>Отправить</button>
      </form>
    </div>
  `;
}


/* =========================
   ЗАГРУЗКА ДАННЫХ
========================= */

async function load() {

  data.transactions = await api('transactions');
  data.budgets = await api('budgets');
  data.goals = await api('goals');
  data.chat = await api('chat');

  render();
}


/* =========================
   RENDER
========================= */

function render() {

  $('#app').innerHTML = layout();

  $('#page').innerHTML = page();

  const msgBox = $('.messages');
  if (msgBox) {
    msgBox.scrollTop = msgBox.scrollHeight;
  }


  document
    .querySelectorAll('[data-tab]')
    .forEach(x => {

      x.onclick = () => {

        tab = x.dataset.tab;

        render();

      };

    });


  const quickBtn = $('#quick');
  if (quickBtn) {
    quickBtn.onclick = () => {
      tab = 'transactions';
      render();
    };
  }

  document.querySelectorAll('.chip[data-cat]').forEach(chip => {
    chip.onclick = () => {
      const cat = chip.dataset.cat;
      const t = chip.dataset.type || 'expense';
      const catInput = $('#category');
      const typeInput = $('#type');
      if (catInput) catInput.value = cat;
      if (typeInput) typeInput.value = t;
      const amtInput = $('#amount');
      if (amtInput) amtInput.focus();
    };
  });

  document.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.onclick = () => {
      txFilter = btn.dataset.txFilter;
      render();
    };
  });


  $('#logout').onclick = async () => {

    localStorage.removeItem('finkaif_token');

    try {
      await api('auth/logout', {
        method: 'POST'
      });
    } catch {}

    location.reload();

  };


  document
    .querySelectorAll('[data-del]')
    .forEach(x => {

      x.onclick = async () => {

        if (
          confirm('Удалить запись?')
        ) {

          const [r, id] =
            x.dataset.del.split(':');

          await api(
            r + '/' + id,
            {
              method: 'DELETE'
            }
          );

          load();

        }

      };

    });


  document.querySelectorAll('[data-period]').forEach(x => {
    x.onclick = () => {
      analyticsPeriod = x.dataset.period;
      render();
    };
  });


  document.querySelectorAll('[data-topup]').forEach(x => {
    x.onclick = async () => {
      const id = x.dataset.topup;
      const current = Number(x.dataset.saved) || 0;
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


  document.querySelectorAll('[data-ask-ai]').forEach(x => {
    x.onclick = () => {
      const q = x.dataset.askAi;
      tab = 'assistant';
      render();
      const textarea = $('#question');
      if (textarea) textarea.value = q;
      const askForm = $('#ask');
      if (askForm) askForm.requestSubmit();
    };
  });


  const op = $('#opform');

  if (op) {

    op.onsubmit = async e => {

      e.preventDefault();

      try {

        await api('transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: $('#type').value,
            category: $('#category').value,
            description: $('#description').value,
            amount: $('#amount').value,
            occurred_on: $('#date').value
          })
        });

        load();

      } catch (e) {

        alert(e.message);

      }

    };

  }


  if ($('#addbudget')) {

    $('#addbudget').onclick = async () => {

      const category =
        prompt('Категория');

      const limit_amount =
        prompt('Месячный лимит');

      if (
        category &&
        Number(limit_amount) > 0
      ) {

        await api('budgets', {
          method: 'POST',
          body: JSON.stringify({
            category,
            limit_amount
          })
        });

        load();

      }

    };

  }


  if ($('#addgoal')) {

    $('#addgoal').onclick = async () => {

      const name =
        prompt('Название цели');

      const target_amount =
        prompt('Сумма цели');

      if (
        name &&
        Number(target_amount) > 0
      ) {

        await api('goals', {
          method: 'POST',
          body: JSON.stringify({
            name,
            target_amount
          })
        });

        load();

      }

    };

  }


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

      if (!q) {
        return;
      }

      data.chat.push(
        {
          role: 'user',
          content: q
        },
        {
          role: 'assistant',
          content: 'Анализирую вашу ситуацию…'
        }
      );

      render();

      const btn = ask.querySelector('button');
      if (btn) btn.disabled = true;

      try {

        const r = await api('assistant', {
          method: 'POST',
          body: JSON.stringify({
            question: q
          })
        });

        data.chat[
          data.chat.length - 1
        ] = {
          role: 'assistant',
          content: r.answer
        };

        render();

      } catch (e) {

        data.chat[
          data.chat.length - 1
        ] = {
          role: 'assistant',
          content: e.message
        };

        render();

      } finally {

        if (btn) btn.disabled = false;

      }

    };

  }

  setupCardTilt();
}


/* =========================================
   LIVE AMBIENT AURORA CANVAS (60 FPS)
   ========================================= */
let canvasInited = false;
function initAmbientCanvas() {
  if (canvasInited) return;
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  canvasInited = true;

  const ctx = canvas.getContext('2d');
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  const blobs = [
    { x: w * 0.15, y: h * 0.2, r: Math.max(300, Math.min(w, h) * 0.52), vx: 0.45, vy: 0.35, color: 'rgba(99, 102, 241, ' },  // Electric Indigo
    { x: w * 0.85, y: h * 0.35, r: Math.max(340, Math.min(w, h) * 0.55), vx: -0.4, vy: 0.4, color: 'rgba(16, 185, 129, ' }, // Emerald Neon
    { x: w * 0.5, y: h * 0.85, r: Math.max(320, Math.min(w, h) * 0.52), vx: 0.35, vy: -0.4, color: 'rgba(139, 92, 246, ' }, // Cyber Violet
    { x: w * 0.25, y: h * 0.75, r: Math.max(280, Math.min(w, h) * 0.45), vx: -0.3, vy: -0.3, color: 'rgba(6, 182, 212, ' }   // Cyan
  ];

  const stars = Array.from({ length: 45 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.6 + 0.6,
    alpha: Math.random() * 0.6 + 0.2,
    speed: Math.random() * 0.35 + 0.15,
    pulse: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1)
  }));

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Deep space gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#050508');
    bgGrad.addColorStop(0.5, '#0a0914');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Dynamic glowing aurora blobs
    blobs.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -150 || b.x > w + 150) b.vx *= -1;
      if (b.y < -150 || b.y > h + 150) b.vy *= -1;

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.color + '0.35)');
      g.addColorStop(0.45, b.color + '0.14)');
      g.addColorStop(1, b.color + '0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Floating stardust particles
    stars.forEach(s => {
      s.y -= s.speed;
      if (s.y < -10) {
        s.y = h + 10;
        s.x = Math.random() * w;
      }
      s.alpha += s.pulse;
      if (s.alpha > 0.85 || s.alpha < 0.2) s.pulse *= -1;

      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1, s.alpha))})`;
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
    card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;

    const glare = card.querySelector('.card-glare');
    if (glare) {
      const px = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
      const py = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
      glare.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.25) 0%, transparent 65%)`;
    }
  };

  card.onmouseleave = () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    const glare = card.querySelector('.card-glare');
    if (glare) glare.style.background = 'none';
  };
}


/* =========================
   ЗАПУСК
========================= */

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
