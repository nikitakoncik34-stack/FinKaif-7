const $ = s => document.querySelector(s);

let me = null;
let tab = 'home';
let mode = 'login';
let analyticsPeriod = 'week';

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


/* =========================
   ВХОД / РЕГИСТРАЦИЯ
========================= */

function auth() {
  const isLogin = mode === 'login';

  return `
    <div class="auth">
      <div class="authbox">

        <div class="brand">Fin<b>kaif</b></div>

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
          Fin<b>kaif</b>
        </div>

        ${nav()}

        <button
          class="logout"
          id="logout"
        >
          Выйти
        </button>

      </aside>

      <main>

        <header>

          <div>

            <small>
              FINKAIF · ОБЛАЧНЫЕ ФИНАНСЫ
            </small>

            <h1>
              Добрый день 👋
            </h1>

            <p class="sub">
              ${esc(me.email)}
            </p>

          </div>

          <button id="quick">
            ＋ Операция
          </button>

        </header>

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

          <div>
            <b>${view(x)}</b>
          </div>

          <button
            class="delete"
            data-del="${res}:${x.id}"
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

  const inc =
    data.transactions
      .filter(x => x.type === 'income')
      .reduce((s, x) => s + Number(x.amount), 0);

  const exp =
    data.transactions
      .filter(x => x.type === 'expense')
      .reduce((s, x) => s + Number(x.amount), 0);


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

    return `
      <div class="grid">
        ${[
          ['Баланс', inc - exp],
          ['Доходы', inc],
          ['Расходы', exp],
          ['Сбережения', inc ? Math.round(((inc - exp) / inc) * 100) + '%' : '—']
        ]
          .map(x => `
            <div class="card">
              <small>${x[0]}</small>
              <span class="value">${typeof x[1] === 'number' ? money(x[1]) : x[1]}</span>
            </div>
          `)
          .join('')}
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
          ${catEntries.slice(0, 5).map(([cat, amt]) => {
            const pct = exp > 0 ? Math.round((amt / exp) * 100) : 0;
            return `
              <div style="margin: 12px 0;">
                <div class="row" style="margin-bottom: 5px;">
                  <span><b>${esc(cat)}</b></span>
                  <span><b>${money(amt)}</b> <small style="color: #8c9890">(${pct}%)</small></span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill safe" style="width: ${pct}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div class="card">
        <div class="row">
          <div>
            <h2>✦ Финансовый ментор Finkaif</h2>
            <p class="sub">Персональные советы, оптимизация бюджета и поддержка ваших целей.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button data-tab="analytics" class="secondary">📊 Аналитика</button>
            <button data-tab="assistant">Открыть чат</button>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'transactions') {
    return `
      <div class="card">
        <h2>Операции</h2>
        <form class="form" id="opform">
          <select id="type">
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
          <input id="category" placeholder="Категория" required>
          <input id="description" placeholder="Описание">
          <input id="amount" type="number" min="1" placeholder="Сумма" required>
          <input id="date" type="date" value="${new Date().toISOString().slice(0, 10)}">
          <button>Сохранить</button>
        </form>
        ${list(
          data.transactions,
          x => `${esc(x.category)} · ${x.type === 'income' ? '+' : '−'}${money(x.amount)}<small>${esc(x.description || 'Без описания')} · ${x.occurred_on}</small>`,
          'transactions'
        )}
      </div>
    `;
  }

  if (tab === 'budgets') {
    return `
      <div class="card">
        <div class="row">
          <div>
            <h2>▦ Месячные бюджеты</h2>
            <small>Контроль расходов в текущем месяце</small>
          </div>
          <button id="addbudget">＋ Лимит</button>
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
                  <b style="font-size: 16px;">${esc(b.category)}</b>
                  <div style="margin-top: 4px;">${badgeText}</div>
                </div>
                <div style="text-align: right;">
                  <div><b>${money(spent)}</b> <small style="color: #8c9890">/ ${money(limit)}</small></div>
                  <small style="color: #8c9890">${pct <= 100 ? 'Осталось ' + money(limit - spent) : 'Лимит превышен'}</small>
                </div>
                <button class="delete" data-del="budgets:${b.id}">×</button>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${cls}" style="width: ${Math.min(100, pct)}%;"></div>
              </div>
            </div>
          `;
        }).join('') : '<p class="sub">Бюджеты пока не добавлены. Нажмите «＋ Лимит», чтобы контролировать категории расходов.</p>'}
      </div>
    `;
  }

  if (tab === 'goals') {
    return `
      <div class="card">
        <div class="row">
          <div>
            <h2>☆ Финансовые цели</h2>
            <small>Накопления без стресса</small>
          </div>
          <button id="addgoal">＋ Цель</button>
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
                  <b style="font-size: 16px;">${esc(g.name)}</b>
                  <div style="margin-top: 4px;">
                    <span class="badge ${pct >= 100 ? 'safe' : 'warn'}">
                      ${pct >= 100 ? '🎉 Цель достигнута!' : 'Собрано ' + pct + '%'}
                    </span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div><b>${money(saved)}</b> <small style="color: #8c9890">из ${money(target)}</small></div>
                  <small style="color: #8c9890">${remains > 0 ? 'Осталось ' + money(remains) : 'Цель закрыта'}</small>
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
        }).join('') : '<p class="sub">Цели пока не созданы. Нажмите «＋ Цель», чтобы копить на важное.</p>'}
      </div>
    `;
  }

  if (tab === 'analytics') {
    const isW = analyticsPeriod === 'week';

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
        <div class="switch-tabs">
          <button class="active" data-period="week">📅 За неделю</button>
          <button data-period="month">🗓️ За месяц</button>
        </div>

        <div class="grid">
          <div class="card">
            <small>РАСХОДЫ НЕДЕЛИ</small>
            <span class="value" style="color: #feb2b2;">${money(wExp)}</span>
          </div>
          <div class="card">
            <small>ДОХОДЫ НЕДЕЛИ</small>
            <span class="value" style="color: #9ae6b4;">${money(wInc)}</span>
          </div>
          <div class="card">
            <small>В ДЕНЬ В СРЕДНЕМ</small>
            <span class="value">${money(wAvgDay)}</span>
          </div>
          <div class="card">
            <small>ДЕЛЬТА НЕДЕЛИ</small>
            <span class="value">${money(wInc - wExp)}</span>
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
                <b>#${idx + 1} ${esc(t.category)}</b>
                <small>${esc(t.description || 'Без описания')} · ${t.occurred_on}</small>
              </div>
              <b style="font-size: 16px; color: #feb2b2;">−${money(t.amount)}</b>
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
        <div class="switch-tabs">
          <button data-period="week">📅 За неделю</button>
          <button class="active" data-period="month">🗓️ За месяц</button>
        </div>

        <div class="grid">
          <div class="card">
            <small>РАСХОДЫ МЕСЯЦА</small>
            <span class="value" style="color: #feb2b2;">${money(mExp)}</span>
          </div>
          <div class="card">
            <small>ДОХОДЫ МЕСЯЦА</small>
            <span class="value" style="color: #9ae6b4;">${money(mInc)}</span>
          </div>
          <div class="card">
            <small>СБЕРЕЖЕНО В МЕСЯЦЕ</small>
            <span class="value">${money(mDelta)}</span>
          </div>
          <div class="card">
            <small>НОРМА СБЕРЕЖЕНИЙ</small>
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
              <span class="ratio-dot" style="background: #4299e1;"></span>
              <span>Базовые нужды: <b>${pNeeds}%</b> (${money(needs)}) [Норма 50%]</span>
            </div>
            <div class="ratio-legend-item">
              <span class="ratio-dot" style="background: #ed8936;"></span>
              <span>Желания и комфорт: <b>${pWants}%</b> (${money(wants)}) [Норма 30%]</span>
            </div>
            <div class="ratio-legend-item">
              <span class="ratio-dot" style="background: #48bb78;"></span>
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


  return `
    <div class="card">

      <h2>
        ✦ Финансовый ИИ-помощник
      </h2>

      <p class="sub">
        Пример: «У меня доход 60 000,
        сколько откладывать на отпуск и резерв?»
      </p>

      <div class="messages">

        ${data.chat
          .map(x => `
            <div class="msg ${x.role}">
              ${formatMsg(x.content)}
            </div>
          `)
          .join('')}

      </div>

      <form
        class="ask"
        id="ask"
      >

        <textarea
          id="question"
          placeholder="Опишите финансовую ситуацию…"
        ></textarea>

        <button>
          Отправить
        </button>

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


  $('#quick').onclick = () => {

    tab = 'transactions';

    render();

  };


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
}


/* =========================
   ЗАПУСК
========================= */

async function boot() {

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
