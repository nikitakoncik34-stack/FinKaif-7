const $ = s => document.querySelector(s);

let me = null;
let tab = 'home';
let mode = 'login';

let data = {
  transactions: [],
  budgets: [],
  goals: [],
  chat: []
};

const api = async (p, o = {}) => {
  const r = await fetch('/api/' + p, {
    headers: {
      'Content-Type': 'application/json',
      ...(o.headers || {})
    },
    ...o
  });

  const j = await r.json();

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

  if (!form || !switchButton) {
    return;
  }

  form.onsubmit = async e => {

    e.preventDefault();

    const email = $('#email').value.trim();
    const password = $('#password').value;

    try {

      await api('auth/' + mode, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        })
      });

      await boot();

    } catch (err) {

      $('#notice').textContent = err.message;

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

    return `
      <div class="grid">

        ${[
          ['Баланс', inc - exp],
          ['Доходы', inc],
          ['Расходы', exp],
          [
            'Сбережения',
            inc
              ? Math.round((inc - exp) / inc * 100) + '%'
              : '—'
          ]
        ]
          .map(x => `
            <div class="card">

              <small>
                ${x[0]}
              </small>

              <span class="value">
                ${
                  typeof x[1] === 'number'
                    ? money(x[1])
                    : x[1]
                }
              </span>

            </div>
          `)
          .join('')}

      </div>

      <div class="card">

        <h2>
          Финансовый помощник
        </h2>

        <p class="sub">
          Задавайте вопросы обычным языком.
          ИИ использует операции, цели и лимиты вашего аккаунта.
        </p>

        <button data-tab="assistant">
          Открыть чат
        </button>

      </div>
    `;
  }


  if (tab === 'transactions') {

    return `
      <div class="card">

        <h2>
          Операции
        </h2>

        <form
          class="form"
          id="opform"
        >

          <select id="type">

            <option value="expense">
              Расход
            </option>

            <option value="income">
              Доход
            </option>

          </select>

          <input
            id="category"
            placeholder="Категория"
            required
          >

          <input
            id="description"
            placeholder="Описание"
          >

          <input
            id="amount"
            type="number"
            min="1"
            placeholder="Сумма"
            required
          >

          <input
            id="date"
            type="date"
            value="${new Date().toISOString().slice(0, 10)}"
          >

          <button>
            Сохранить
          </button>

        </form>

        ${list(
          data.transactions,
          x =>
            `${esc(x.category)}
            · ${x.type === 'income' ? '+' : '−'}${money(x.amount)}
            <small>
              ${esc(x.description || 'Без описания')}
              · ${x.occurred_on}
            </small>`,
          'transactions'
        )}

      </div>
    `;
  }


  if (tab === 'budgets') {

    return `
      <div class="card">

        <div class="row">

          <h2>
            Бюджеты
          </h2>

          <button id="addbudget">
            ＋ Лимит
          </button>

        </div>

        ${list(
          data.budgets,
          x => `
            ${esc(x.category)}
            <small>
              Лимит: ${money(x.limit_amount)}
            </small>
          `,
          'budgets'
        )}

      </div>
    `;
  }


  if (tab === 'goals') {

    return `
      <div class="card">

        <div class="row">

          <h2>
            Цели
          </h2>

          <button id="addgoal">
            ＋ Цель
          </button>

        </div>

        ${list(
          data.goals,
          x => `
            ${esc(x.name)}
            <small>
              ${money(x.saved_amount)}
              из
              ${money(x.target_amount)}
            </small>
          `,
          'goals'
        )}

      </div>
    `;
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
              ${esc(x.content)}
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

    await api('auth/logout', {
      method: 'POST'
    });

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

    ask.onsubmit = async e => {

      e.preventDefault();

      const q =
        $('#question').value.trim();

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

    await load();

  } catch {

    $('#app').innerHTML = auth();

    setupAuth();

  }

}
window.addEventListener('error', function(e) {
  alert('Ошибка JavaScript: ' + e.message);
});

boot();
