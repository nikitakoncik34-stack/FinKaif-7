// ==========================================================================
// FINKAIF MODERN AVATAR SYSTEM & NEURAL LIVING CORE
// ==========================================================================
function renderDefaultAvatarSvg(size = 38) {
  const uid = Math.round(Math.random() * 10000);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-default-svg" style="border-radius: 50%;">
      <defs>
        <radialGradient id="defAvBg_${uid}" cx="32" cy="24" r="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#142426"/>
          <stop offset="100%" stop-color="#0B1317"/>
        </radialGradient>
        <linearGradient id="defAvGrad_${uid}" x1="20" y1="16" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#5EEAD4"/>
          <stop offset="100%" stop-color="#0D9488"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="url(#defAvBg_${uid})" stroke="#2DD4BF" stroke-width="1.5" stroke-opacity="0.5"/>
      <circle cx="32" cy="24" r="9.5" fill="url(#defAvGrad_${uid})"/>
      <path d="M17 48C17 39.5 23.5 37 32 37C40.5 37 47 39.5 47 48C47 51 45 52 32 52C19 52 17 51 17 48Z" fill="url(#defAvGrad_${uid})" opacity="0.88"/>
    </svg>
  `;
}

function getAvatarHtml(avatarKey, userInitial = 'Н', size = 38) {
  const key = String(avatarKey || '').trim();

  // If user uploaded a custom photo (data URI or URL)
  if (key.startsWith('data:image/') || key.startsWith('http')) {
    return `<img src="${esc(key)}" alt="Avatar" class="custom-avatar-img" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(45, 212, 191, 0.4); display: block;">`;
  }

  // Default elegant investor avatar
  return renderDefaultAvatarSvg(size);
}

function renderAssistantOrb(state = 'idle', size = 34) {
  return `
    <div class="assistant-living-orb" data-state="${state}" style="width: ${size}px; height: ${size}px;">
      <div class="orb-ambient-glow"></div>
      <div class="orb-orbital-ring orb-ring-1"></div>
      <div class="orb-orbital-ring orb-ring-2"></div>
      <div class="orb-core">
        <div class="orb-nucleus"></div>
      </div>
    </div>
  `;
}

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
let customRange = { from: '', to: '' };
let customRangeOpen = false;
let analyticsPeriod = '30d';
let cashflowChartMode = 'bars';
try { cashflowChartMode = localStorage.getItem('finkaif_cf_mode') || 'bars'; } catch (_) {}
let activeAnalyticsCat = null;
let hoveredAnalyticsCat = null;
let txFilter = 'all';
let txMonthFilter = 'all';
let txSearch = '';
let selectedTxIds = new Set();
let isTxSelectMode = false;
let modalType = 'expense';
let editingTxId = null;
let profileModalOpen = false;
let finscoreModalOpen = false;
let privacyMode = false;
try { privacyMode = localStorage.getItem('finkaif_privacy') === 'true'; } catch (_) {}
let paydaySplitData = null;
let isAiThinking = false;
let aiThinkingPhase = 0;
let aiThinkingInterval = null;
let simState = {
  open: false,
  initial: 100000,
  monthly: 25000,
  years: 5,
  rate: 12
};

let userCategories = [];
try {
  const savedCats = localStorage.getItem('finkaif_custom_cats');
  if (savedCats) userCategories = JSON.parse(savedCats);
} catch (_) {}

let profile = {
  display_name: '',
  avatar: 'default',
  currency: 'RUB'
};
try {
  profile.display_name = localStorage.getItem('finkaif_name') || '';
  profile.avatar = localStorage.getItem('finkaif_avatar') || 'default';
  profile.currency = localStorage.getItem('finkaif_currency') || 'RUB';
} catch (_) {}
window.profile = profile;

let data = {
  transactions: [],
  budgets: [],
  goals: [],
  chat: [],
  subscriptions: []
};
let subModalOpen = false;
window.data = data;
window.renderApp = renderApp;

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

// Live CBR Exchange Rates Engine
let currentRates = {
  base: 'RUB',
  date: new Date().toISOString().slice(0, 10),
  rates: { RUB: 1, USD: 0.010811, EUR: 0.009881, KZT: 5.2632 },
  quotes: { USD: 92.5, EUR: 101.2, KZT: 0.19 },
  updated_at: new Date().toISOString()
};

async function fetchExchangeRates() {
  try {
    const res = await fetch('/api/rates');
    if (res.ok) {
      const data = await res.json();
      if (data && data.quotes) {
        currentRates = data;
        const banner = document.getElementById('cbr-rates-list-el');
        if (banner) {
          banner.innerHTML = `
            <span>1 $ = ${(currentRates.quotes.USD || 92.5).toFixed(2)} ₽</span>
            <span>1 € = ${(currentRates.quotes.EUR || 101.2).toFixed(2)} ₽</span>
            <span>1 ₸ = ${(currentRates.quotes.KZT || 0.19).toFixed(2)} ₽</span>
          `;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch exchange rates, using fallback:', err.message);
  }
}

function convertFromRub(amountInRub, targetCur = profile.currency) {
  const rub = Number(amountInRub) || 0;
  if (targetCur === 'RUB' || !targetCur) return rub;
  const quote = currentRates?.quotes?.[targetCur] || (targetCur === 'USD' ? 92.5 : targetCur === 'EUR' ? 101.2 : 0.19);
  if (!quote || quote <= 0) return rub;
  return rub / quote;
}

function convertToRub(amountInForeign, cur = profile.currency) {
  const amt = Number(amountInForeign) || 0;
  if (cur === 'RUB' || !cur) return amt;
  const quote = currentRates?.quotes?.[cur] || (cur === 'USD' ? 92.5 : cur === 'EUR' ? 101.2 : 0.19);
  if (!quote || quote <= 0) return amt;
  return amt * quote;
}

const money = (n, force = false, isAlreadyConverted = false) => {
  const cur = profile.currency || 'RUB';
  const sym = currencySymbols[cur] || '₽';
  if (privacyMode && !force) {
    return '•••• ' + sym;
  }
  const rawNum = Number(n) || 0;
  const converted = isAlreadyConverted ? rawNum : convertFromRub(rawNum, cur);
  const hasDecimals = Math.abs(converted * 100 - Math.round(converted) * 100) > 0.001;

  if (cur === 'USD' || cur === 'EUR') {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(converted);
    return (cur === 'USD' ? '$' : '€') + formatted;
  } else {
    // RUB or KZT - preserve exact kopecks when present (e.g. 1 250,50 ₽)
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(converted);
    return formatted + ' ' + sym;
  }
};

// Kinetic Number Ticker & Spotlight Helpers (FinKaif 8.20)
const prevAnimatedNumbers = {};

function animateNumber(el, targetVal, duration = 650, prefix = '', suffix = '') {
  if (!el || privacyMode) return;
  const key = el.id || el.getAttribute('data-num-key') || 'num_' + targetVal;
  const startVal = prevAnimatedNumbers[key] !== undefined ? prevAnimatedNumbers[key] : 0;
  prevAnimatedNumbers[key] = targetVal;

  const cur = profile.currency || 'RUB';
  const formatVal = val => {
    const hasDecimals = Math.abs(val * 100 - Math.round(val) * 100) > 0.001;
    if (cur === 'USD' || cur === 'EUR') {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2
      }).format(val);
    }
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(val);
  };

  if (startVal === targetVal) {
    el.textContent = `${prefix}${formatVal(targetVal)}${suffix}`;
    return;
  }

  const startTime = performance.now();
  const diff = targetVal - startVal;

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = startVal + diff * ease;

    el.textContent = `${prefix}${formatVal(current)}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.textContent = `${prefix}${formatVal(targetVal)}${suffix}`;
    }
  }

  requestAnimationFrame(frame);
}

function initSpotlightCards() {
  const cards = document.querySelectorAll('.stat-card, .hero-balance-card, .budget-card, .goal-card, .quick-action-btn, .tx-card, .create-card');
  cards.forEach(card => {
    if (card.__spotlightBound) return;
    card.__spotlightBound = true;
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, x => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[x]));
}


function renderDialogIcon(iconKey, size = 22) {
  if (typeof iconKey === 'string' && iconKey.trim().startsWith('<svg')) return iconKey;
  const map = {
    trash: 'trash',
    delete: 'trash',
    warning: 'alertTriangle',
    danger: 'alertTriangle',
    alert: 'alertTriangle',
    alertTriangle: 'alertTriangle',
    logout: 'logout',
    edit: 'edit',
    pencil: 'edit',
    info: 'info',
    sparkle: 'sparkle',
    chart: 'chart',
    target: 'target',
    chat: 'chat'
  };
  const resolved = map[iconKey] || iconKey || 'alertTriangle';
  return icon(resolved, size);
}

// ── In-App Toast Notification Engine ──
function showToast(message, type = 'info', duration = 3600) {
  let container = document.getElementById('finkaif-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'finkaif-toast-container';
    container.className = 'finkaif-toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: icon('checkCircle', 16),
    error: icon('alertTriangle', 16),
    warning: icon('bell', 16),
    info: icon('info', 16)
  };

  const toast = document.createElement('div');
  toast.className = `finkaif-toast-card ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icon('sparkle', 16)}</span>
    <span class="toast-msg">${esc(message)}</span>
    <button type="button" class="toast-close" aria-label="Закрыть">✕</button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));

  let timer;
  const closeToast = () => {
    if (timer) clearTimeout(timer);
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 240);
  };

  toast.querySelector('.toast-close').onclick = closeToast;
  if (duration > 0) {
    timer = setTimeout(closeToast, duration);
  }
}

// ── Beautiful Custom In-App Confirmation Modal ──
function showConfirmDialog({
  title = 'Подтверждение',
  message = 'Вы уверены, что хотите выполнить это действие?',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = true,
  icon = 'alertTriangle'
} = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'custom-confirm-modal';
    backdrop.className = 'confirm-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-dialog-card">
        <div class="confirm-dialog-icon-wrap ${danger ? 'danger' : 'info'}">
          <span>${renderDialogIcon(icon)}</span>
        </div>
        <h3 class="confirm-dialog-title">${esc(title)}</h3>
        <p class="confirm-dialog-message">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="btn-confirm-cancel" id="confirm-btn-cancel">${esc(cancelText)}</button>
          <button type="button" class="${danger ? 'btn-confirm-danger' : 'btn-confirm-primary'}" id="confirm-btn-ok">${esc(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      backdrop.querySelector('#confirm-btn-ok')?.focus();
    });

    let resolved = false;
    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      backdrop.classList.remove('visible');
      setTimeout(() => {
        backdrop.remove();
        resolve(result);
      }, 190);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    document.addEventListener('keydown', onKeyDown);

    backdrop.querySelector('#confirm-btn-cancel').onclick = () => cleanup(false);
    backdrop.querySelector('#confirm-btn-ok').onclick = () => cleanup(true);
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cleanup(false);
    };
  });
}

// ── Beautiful Custom In-App Input / Prompt Modal ──
function showPromptDialog({
  title = 'Ввод данных',
  message = 'Введите значение:',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Сохранить',
  cancelText = 'Отмена',
  icon = 'edit'
} = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById('custom-prompt-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'custom-prompt-modal';
    backdrop.className = 'confirm-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-dialog-card prompt-card">
        <div class="confirm-dialog-icon-wrap info">
          <span>${icon}</span>
        </div>
        <h3 class="confirm-dialog-title">${esc(title)}</h3>
        <p class="confirm-dialog-message">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="prompt-input-box">
          <input type="text" id="prompt-input-field" class="prompt-input-field" placeholder="${esc(placeholder)}" value="${esc(defaultValue)}" autocomplete="off">
        </div>
        <div class="confirm-dialog-actions">
          <button type="button" class="btn-confirm-cancel" id="prompt-btn-cancel">${esc(cancelText)}</button>
          <button type="button" class="btn-confirm-primary" id="prompt-btn-ok">${esc(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('#prompt-input-field');

    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      input?.focus();
      input?.select();
    });

    let resolved = false;
    const cleanup = (val) => {
      if (resolved) return;
      resolved = true;
      backdrop.classList.remove('visible');
      setTimeout(() => {
        backdrop.remove();
        resolve(val);
      }, 190);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(null);
      if (e.key === 'Enter') cleanup(input ? input.value : null);
    };
    document.addEventListener('keydown', onKeyDown);

    backdrop.querySelector('#prompt-btn-cancel').onclick = () => cleanup(null);
    backdrop.querySelector('#prompt-btn-ok').onclick = () => cleanup(input ? input.value : null);
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cleanup(null);
    };
  });
}

// ── Beautiful Custom In-App Alert Modal ──
function showAlertDialog({
  title = 'Внимание',
  message = '',
  buttonText = 'Понятно',
  icon = 'sparkle',
  danger = false
} = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById('custom-alert-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'custom-alert-modal';
    backdrop.className = 'confirm-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-dialog-card">
        <div class="confirm-dialog-icon-wrap ${danger ? 'danger' : 'info'}">
          <span>${icon}</span>
        </div>
        <h3 class="confirm-dialog-title">${esc(title)}</h3>
        <p class="confirm-dialog-message">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="confirm-dialog-actions" style="justify-content: center;">
          <button type="button" class="btn-confirm-primary" id="alert-btn-ok" style="min-width: 130px;">${esc(buttonText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      backdrop.querySelector('#alert-btn-ok')?.focus();
    });

    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      backdrop.classList.remove('visible');
      setTimeout(() => {
        backdrop.remove();
        resolve();
      }, 190);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') cleanup();
    };
    document.addEventListener('keydown', onKeyDown);

    backdrop.querySelector('#alert-btn-ok').onclick = cleanup;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cleanup();
    };
  });
}

// Global Native Dialog Interceptors (Zero System Dialogs)
window.alert = function(msg) {
  showToast(String(msg || ''), 'error');
};
window.confirm = function(msg) {
  return showConfirmDialog({ message: String(msg || '') });
};
window.prompt = function(msg, def) {
  return showPromptDialog({ message: String(msg || ''), defaultValue: def });
};

const formatMarkdown = s => {
  if (!s) return '';
  let str = esc(s);
  // Bold **text**
  str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text* (single asterisk, avoid capturing bullet lines)
  str = str.replace(/(^|[^\*])\*([^\*\s\n][^\*\n]*?)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  // Code
  str = str.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 4px;">$1</code>');
  // Newlines
  str = str.replace(/\n/g, '<br>');
  return str;
};

// Cache to track executed agentic actions so they don't execute repeatedly on re-render
const executedActionCache = new Set();

async function executeAssistantAction(actType, actData) {
  const actionKey = `${actType}_${JSON.stringify(actData)}`;
  if (executedActionCache.has(actionKey)) return;
  executedActionCache.add(actionKey);

  try {
    if (actType === 'create_goal') {
      const name = actData.name || 'Финансовая цель';
      const target_amount = Number(actData.target_amount) || 100000;
      const saved_amount = Number(actData.saved_amount) || 0;
      await api('goals', {
        method: 'POST',
        body: JSON.stringify({ name, target_amount, saved_amount })
      });
      await refreshAllData();
      renderApp();
    } else if (actType === 'create_budget') {
      const category = actData.category || 'Прочие расходы';
      const limit_amount = Number(actData.limit_amount) || 25000;
      await api('budgets', {
        method: 'POST',
        body: JSON.stringify({ category, limit_amount })
      });
      await refreshAllData();
      renderApp();
    } else if (actType === 'create_tx') {
      const type = actData.type === 'income' ? 'income' : 'expense';
      const amount = Number(actData.amount) || 1000;
      const category = actData.category || (type === 'income' ? 'Доходы' : 'Разное');
      const description = actData.description || 'Запись через ассистента';
      const occurred_on = actData.occurred_on || toDateIso(getMskDate());
      await api('transactions', {
        method: 'POST',
        body: JSON.stringify({ type, amount, category, description, occurred_on })
      });
      await refreshAllData();
      renderApp();
    } else if (actType === 'deposit_goal') {
      const gName = String(actData.name || '').toLowerCase();
      const amt = Number(actData.amount) || 0;
      const goal = (data.goals || []).find(g => (g.name || '').toLowerCase().includes(gName)) || data.goals[0];
      if (goal && amt > 0) {
        const newSaved = Number(goal.saved_amount || 0) + amt;
        await api('goals/' + goal.id, {
          method: 'PUT',
          body: JSON.stringify({ saved_amount: newSaved })
        });
        await refreshAllData();
        renderApp();
      }
    } else if (actType === 'delete_goal' || actType === 'clear_goals') {
      const gName = String(actData.name || '').trim().toLowerCase();
      const gId = actData.id;
      if (actType === 'clear_goals' || gName === 'all' || gName === 'все' || gName === 'все цели') {
        const allGoals = [...(data.goals || [])];
        for (const g of allGoals) {
          try { await api('goals/' + g.id, { method: 'DELETE' }); } catch (_) {}
        }
      } else {
        let targetGoal = null;
        if (gId) {
          targetGoal = (data.goals || []).find(g => String(g.id) === String(gId));
        } else if (gName) {
          targetGoal = (data.goals || []).find(g => {
            const name = (g.name || '').toLowerCase();
            return name === gName || name.includes(gName) || gName.includes(name);
          });
        }
        if (!targetGoal && (data.goals || []).length > 0 && (!gName || gName === 'последнюю' || gName === 'последняя')) {
          targetGoal = data.goals[data.goals.length - 1];
        }
        if (targetGoal) {
          await api('goals/' + targetGoal.id, { method: 'DELETE' });
        }
      }
      await refreshAllData();
      renderApp();
    } else if (actType === 'delete_budget' || actType === 'clear_budgets') {
      const bCat = String(actData.category || '').trim().toLowerCase();
      const bId = actData.id;
      if (actType === 'clear_budgets' || bCat === 'all' || bCat === 'все' || bCat === 'все бюджеты') {
        const allBudgets = [...(data.budgets || [])];
        for (const b of allBudgets) {
          try { await api('budgets/' + b.id, { method: 'DELETE' }); } catch (_) {}
        }
      } else {
        let targetBudget = null;
        if (bId) {
          targetBudget = (data.budgets || []).find(b => String(b.id) === String(bId));
        } else if (bCat) {
          targetBudget = (data.budgets || []).find(b => {
            const cat = (b.category || '').toLowerCase();
            return cat === bCat || cat.includes(bCat) || bCat.includes(cat);
          });
        }
        if (targetBudget) {
          await api('budgets/' + targetBudget.id, { method: 'DELETE' });
        }
      }
      await refreshAllData();
      renderApp();
    } else if (actType === 'delete_tx') {
      const txId = actData.id;
      let targetTx = null;
      if (txId) {
        targetTx = (data.transactions || []).find(t => String(t.id) === String(txId));
      } else if (actData.last || (!actData.amount && !actData.description)) {
        targetTx = (data.transactions || [])[0];
      } else {
        const amt = Number(actData.amount) || 0;
        const desc = String(actData.description || '').toLowerCase();
        targetTx = (data.transactions || []).find(t => {
          const matchAmt = amt > 0 ? Math.abs(Number(t.amount) - amt) < 0.01 : true;
          const matchDesc = desc ? (t.description || '').toLowerCase().includes(desc) || (t.category || '').toLowerCase().includes(desc) : true;
          return matchAmt && matchDesc;
        });
      }
      if (targetTx) {
        await api('transactions/' + targetTx.id, { method: 'DELETE' });
        await refreshAllData();
        renderApp();
      }
    }
  } catch (err) {
    console.warn('Agentic action execution notice:', err.message);
  }
}

// Rich Action Parser and Markdown formatter for Assistant replies
const formatAssistantMessage = (raw) => {
  if (!raw) return '';
  const actions = [];
  const execActions = [];

  // Parse [ACTION_EXEC:type:json]
  let cleanText = String(raw).replace(/\[ACTION_EXEC:([^:]+):(\{.+?\})\]/g, (_, actType, actPayload) => {
    try {
      const parsed = JSON.parse(actPayload);
      execActions.push({ type: actType.trim(), data: parsed });
      // Asynchronously trigger execution
      setTimeout(() => executeAssistantAction(actType.trim(), parsed), 50);
    } catch (e) {
      console.warn('JSON parse error in ACTION_EXEC:', e);
    }
    return '';
  });

  // Parse [ACTION:tab:target:label]
  cleanText = cleanText.replace(/\[ACTION:([^:]+):([^:]+):([^\]]+)\]/g, (_, actTab, actTarget, actLabel) => {
    actions.push({ tab: actTab.trim(), target: actTarget.trim(), label: actLabel.trim() });
    return '';
  });

  let html = formatMarkdown(cleanText.trim());

  // Render Agentic Action Cards
  if (execActions.length > 0) {
    html += execActions.map(act => {
      if (act.type === 'create_goal') {
        return `
          <div class="chat-action-card goal">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("target", 16)}</span>
                <span class="action-badge-label">Цель создана</span>
              </div>
              <span class="action-status-pill">✓ Добавлено на сайт</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">${esc(act.data.name)}</div>
              <div class="action-main-subtitle">Целевой ориентир: <strong>${money(act.data.target_amount)}</strong> • Сохранено в системе</div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="goals">
                <span>Смотреть в разделе «Цели»</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      } else if (act.type === 'create_budget') {
        return `
          <div class="chat-action-card budget">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("chart", 16)}</span>
                <span class="action-badge-label">Лимит бюджета</span>
              </div>
              <span class="action-status-pill">✓ Лимит активен</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">${esc(act.data.category)}</div>
              <div class="action-main-subtitle">Установлен лимит: <strong>${money(act.data.limit_amount)}/мес</strong></div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="budgets">
                <span>Управление бюджетами</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      } else if (act.type === 'create_tx') {
        const isInc = act.data.type === 'income';
        return `
          <div class="chat-action-card transaction">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("sparkle", 16)}</span>
                <span class="action-badge-label">${isInc ? 'Поступление' : 'Списание'}</span>
              </div>
              <span class="action-status-pill">✓ Записано в журнал</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">${isInc ? '+' : '−'}${money(act.data.amount)}</div>
              <div class="action-main-subtitle">${esc(act.data.category || 'Операция')} • ${esc(act.data.description || '')}</div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="transactions">
                <span>В историю операций</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      } else if (act.type === 'deposit_goal') {
        return `
          <div class="chat-action-card goal">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("banknote", 16)}</span>
                <span class="action-badge-label">Взнос в цель</span>
              </div>
              <span class="action-status-pill">✓ Баланс цели обновлён</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">+${money(act.data.amount)}</div>
              <div class="action-main-subtitle">Цель: «${esc(act.data.name)}»</div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="goals">
                <span>Открыть цели</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      } else if (act.type === 'delete_goal' || act.type === 'clear_goals') {
        const isAll = act.type === 'clear_goals' || String(act.data.name || '').toLowerCase() === 'all' || String(act.data.name || '').toLowerCase() === 'все';
        return `
          <div class="chat-action-card delete">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("trash", 16)}</span>
                <span class="action-badge-label">Цель удалена</span>
              </div>
              <span class="action-status-pill danger">✓ Удалено из системы</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">${isAll ? 'Все цели удалены' : esc(act.data.name || 'Финансовая цель')}</div>
              <div class="action-main-subtitle">${isAll ? 'Портфель целей полностью очищен' : 'Цель снята с отслеживания и удалена из портфеля'}</div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="goals">
                <span>Раздел «Цели»</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      } else if (act.type === 'delete_budget' || act.type === 'clear_budgets') {
        const isAll = act.type === 'clear_budgets' || String(act.data.category || '').toLowerCase() === 'all' || String(act.data.category || '').toLowerCase() === 'все';
        return `
          <div class="chat-action-card delete">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("trash", 16)}</span>
                <span class="action-badge-label">Лимит бюджета удален</span>
              </div>
              <span class="action-status-pill danger">✓ Лимит снят</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">${isAll ? 'Все бюджетные лимиты сняты' : esc(act.data.category || 'Категория')}</div>
              <div class="action-main-subtitle">Ограничение трат снято, автоконтроль категории отключен</div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="budgets">
                <span>Раздел «Бюджеты»</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      } else if (act.type === 'delete_tx') {
        return `
          <div class="chat-action-card delete">
            <div class="action-card-header">
              <div class="action-card-badge">
                <span class="action-badge-icon">${icon("trash", 16)}</span>
                <span class="action-badge-label">Операция удалена</span>
              </div>
              <span class="action-status-pill danger">✓ Запись стёрта</span>
            </div>
            <div class="action-card-body">
              <div class="action-main-title">${act.data.amount ? money(act.data.amount) : 'Операция'}</div>
              <div class="action-main-subtitle">${esc(act.data.description || 'Последняя транзакция')} • Баланс скорректирован</div>
            </div>
            <div class="action-card-footer">
              <button type="button" class="btn-action-navigate" data-nav-tab="transactions">
                <span>История операций</span>
                <span class="action-arrow">→</span>
              </button>
            </div>
          </div>
        `;
      }
      return '';
    }).join('');
  }

  // Render Navigation action buttons
  if (actions.length > 0) {
    const actionsHtml = `
      <div class="chat-actions-strip">
        ${actions.map(a => `
          <button type="button" class="chat-action-btn" data-action-tab="${esc(a.tab)}" data-action-target="${esc(a.target)}">
            <span class="action-sparkle">✦</span>
            <span>${esc(a.label)}</span>
            <span class="action-arrow">→</span>
          </button>
        `).join('')}
      </div>
    `;
    html += actionsHtml;
  }
  return html;
};

// FinScore Financial Health Index (0-100)
function calculateFinScore() {
  const inc = (data.transactions || []).filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount || 0), 0);
  const exp = (data.transactions || []).filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount || 0), 0);
  const bal = inc - exp;
  const monthlyExp = exp > 0 ? exp : 40000;
  const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : (bal > 0 ? 35 : 0);
  const totalSaved = (data.goals || []).reduce((s, g) => s + Number(g.saved_amount || 0), 0);
  const cushion = Math.max(0, bal) + totalSaved * 0.5;
  const runway = monthlyExp > 0 ? cushion / monthlyExp : 3;

  const sCushion = Math.min(25, Math.round(runway * 6));
  const sSavings = Math.min(25, Math.max(0, Math.round(savingsRate)));
  const sBudgets = (data.budgets || []).length > 0 ? 25 : 12;
  const sCapital = bal >= 0 ? 25 : 5;
  const score = Math.max(15, Math.min(100, sCushion + sSavings + sBudgets + sCapital));

  let label = 'Устойчивый';
  let badgeClass = 'jade';
  if (score >= 85) { label = 'Превосходно'; badgeClass = 'emerald'; }
  else if (score >= 70) { label = 'Высокий'; badgeClass = 'jade'; }
  else if (score >= 50) { label = 'Средний'; badgeClass = 'amber'; }
  else { label = 'Внимание'; badgeClass = 'coral'; }

  return {
    score,
    label,
    badgeClass,
    runway: runway.toFixed(1),
    savingsRate,
    sCushion,
    sSavings,
    sBudgets,
    sCapital,
    totalSaved,
    bal,
    monthlyExp
  };
}

// Central Moscow Time (Europe/Moscow, UTC+3) helper
function getMskDate(d = new Date()) {
  const dateObj = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : (d || new Date());
  if (isNaN(dateObj.getTime())) return new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(dateObj);
    const p = {};
    for (const { type, value } of parts) p[type] = value;
    return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  } catch (e) {
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
  }
}

// Local Date YYYY-MM-DD helper without UTC timezone distortion
const toDateIso = d => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Current Moscow Date in YYYY-MM-DD
const getTodayMskIso = () => toDateIso(getMskDate());

// Safe ISO Date extractor (YYYY-MM-DD) from string, Date or object
const getTxIso = t => {
  if (!t) return '';
  const val = t.occurred_on || t.date || '';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toDateIso(getMskDate(d));
  return s.slice(0, 10);
};

// Intraday transaction minute parser (0..1439) with Moscow timezone awareness
const getTxMinutes = t => {
  if (!t) return 12 * 60;
  if (t.time && /^\d{1,2}:\d{2}$/.test(String(t.time).trim())) {
    const p = String(t.time).trim().split(':');
    return Math.min(1439, Math.max(0, Number(p[0]) * 60 + Number(p[1])));
  }
  const raw = t.created_at || t.occurred_at || '';
  if (raw) {
    const s = String(raw).trim();
    if (/^\d{1,2}:\d{2}/.test(s)) {
      const p = s.split(':');
      return Math.min(1439, Math.max(0, Number(p[0]) * 60 + Number(p[1])));
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const msk = getMskDate(d);
      return msk.getHours() * 60 + msk.getMinutes();
    }
  }
  return 12 * 60;
};

const formatTxTime = t => {
  if (!t) return '12:00';
  if (t.time && /^\d{1,2}:\d{2}$/.test(String(t.time).trim())) {
    return String(t.time).trim();
  }
  const raw = t.created_at || t.occurred_at;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const msk = getMskDate(d);
      const hh = String(msk.getHours()).padStart(2, '0');
      const mm = String(msk.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }
  return '12:00';
};

const SYSTEM_EXPENSE_CATEGORIES = [
  'Продукты', 'Кафе', 'Рестораны', 'Транспорт', 'Такси', 'Хобби',
  'Подписки', 'Здоровье', 'Спорт', 'Покупки', 'Жилье',
  'ЖКХ', 'Путешествия', 'Развлечения', 'Авто', 'Инвестиции'
];

const SYSTEM_INCOME_CATEGORIES = [
  'Зарплата', 'Фриланс', 'Дивиденды', 'Кэшбэк', 'Переводы'
];

const SYSTEM_CATEGORIES = [...SYSTEM_EXPENSE_CATEGORIES, ...SYSTEM_INCOME_CATEGORIES];
const defaultCategories = SYSTEM_CATEGORIES;

function addCustomCategory(name, emoji = 'tag') {
  if (!name || !String(name).trim()) return null;
  const clean = String(name).trim();
  const formatted = clean.match(/^[\p{Emoji}\u200d]+/u) ? clean : `${emoji} ${clean}`;
  if (!userCategories.includes(formatted)) {
    userCategories.push(formatted);
    try {
      localStorage.setItem('finkaif_custom_cats', JSON.stringify(userCategories));
    } catch (_) {}
  }
  return formatted;
}

const getAllCategories = () => {
  const cats = new Set([...SYSTEM_CATEGORIES, ...userCategories]);
  (data.transactions || []).forEach(t => {
    if (t.category && String(t.category).trim()) {
      cats.add(String(t.category).trim());
    }
  });
  return Array.from(cats);
};

// ==========================================================================
// ROBUST NEURAL VOICE INPUT CONTROLLER (Web Speech API + Micro permissions)
// ==========================================================================
function setupVoiceInputHandler({ btnEl, inputEl, onResult, onEnd, defaultPlaceholder, listeningPlaceholder }) {
  if (!btnEl || !inputEl) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btnEl.onclick = (e) => {
      e.preventDefault();
      showToast('Голосовой ввод не поддерживается данным браузером.', 'warning');
    };
    return;
  }

  let activeRecognition = null;
  let silenceTimer = null;

  function stopCurrentSession() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (activeRecognition) {
      try {
        activeRecognition.onend = null;
        activeRecognition.onerror = null;
        activeRecognition.onresult = null;
        activeRecognition.stop();
      } catch (_) {}
      activeRecognition = null;
    }
    btnEl.classList.remove('recording');
    inputEl.classList.remove('voice-active');
    if (defaultPlaceholder) inputEl.placeholder = defaultPlaceholder;
    if (typeof onEnd === 'function') onEnd();
  }

  btnEl.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle off if already recording
    if (activeRecognition) {
      stopCurrentSession();
      return;
    }

    // Solicit mic permissions first to avoid silent rejection in Chrome/Safari/Edge
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (micErr) {
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
          showToast('Доступ к микрофону заблокирован. Разрешите микрофон в настройках браузера.', 'warning');
          return;
        }
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          stopCurrentSession();
        }, 2200); // 2.2s of silence stops recording
      };

      recognition.onstart = () => {
        activeRecognition = recognition;
        btnEl.classList.add('recording');
        inputEl.classList.add('voice-active');
        if (listeningPlaceholder) inputEl.placeholder = listeningPlaceholder;
        resetSilenceTimer();
      };

      recognition.onresult = (event) => {
        resetSilenceTimer();
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          inputEl.value = transcript;
          if (typeof onResult === 'function') onResult(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          showToast('Микрофон недоступен. Разрешите доступ в браузере.', 'warning');
        } else if (event.error === 'network') {
          showToast('Сетевая ошибка распознавания речи.', 'warning');
        }
        stopCurrentSession();
      };

      recognition.onend = () => {
        stopCurrentSession();
      };

      recognition.start();
    } catch (startErr) {
      console.warn('SpeechRecognition start failed:', startErr);
      showToast('Не удалось запустить микрофон: ' + (startErr.message || startErr), 'warning');
      stopCurrentSession();
    }
  };
}

// Russian pluralization helper for categories
const pluralizeCats = n => {
  const num = Math.abs(Number(n) || 0) % 100;
  const num1 = num % 10;
  if (num > 10 && num < 20) return 'категорий';
  if (num1 > 1 && num1 < 5) return 'категории';
  if (num1 === 1) return 'категория';
  return 'категорий';
};

// Russian pluralization helper for operations
const pluralizeOps = n => {
  const num = Math.abs(Number(n) || 0) % 100;
  const num1 = num % 10;
  if (num > 10 && num < 20) return 'операций';
  if (num1 > 1 && num1 < 5) return 'операции';
  if (num1 === 1) return 'операция';
  return 'операций';
};

// Compact currency formatter for axis scales (e.g. 50K ₽, 1.2M ₽, $1.5K)
const compactMoney = (num, force = false) => {
  const cur = profile.currency || 'RUB';
  const sym = currencySymbols[cur] || '₽';
  if (privacyMode && !force) return '••• ' + sym;
  const raw = Math.abs(Number(num) || 0);
  const n = convertFromRub(raw, cur);
  let str = '';
  if (n >= 1000000) str = (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  else if (n >= 1000) str = Math.round(n / 1000) + 'K';
  else str = (cur === 'USD' || cur === 'EUR') ? n.toFixed(1).replace('.0', '') : Math.round(n);

  if (cur === 'USD') return '$' + str;
  if (cur === 'EUR') return '€' + str;
  return str + ' ' + sym;
};

// Smart Natural Language Financial Parser (with Full Russian Slang & Colloquial Support)

// // Smart Natural Language Financial Parser (with Full Russian Slang, Livestock/Pets, Composite Numbers & 0ms Latency)
function parseQuickTxInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const lower = ' ' + text.toLowerCase().replace(/ё/g, 'е') + ' ';
  let cleanWords = ' ' + text + ' ';
  let amount = 0;
  let matchedNumStr = '';

  // 0. Explicit price with currency or preposition: "за 100 рублей", "100 руб", "100р", "100 ₽", "за 350", "на 500"
  const explicitCurrency = lower.match(/(?:^|[^а-яa-z0-9])(?:(?:за|на)\s+)?(\d[\d\s]*(?:[.,]\d+)?)\s*(?:₽|\$|€|₸|рублей|рубля|рубль|руб\.?|р\.?)(?:$|[^а-яa-z0-9])/i);
  if (explicitCurrency) {
    const cleanNum = explicitCurrency[1].replace(/\s+/g, '').replace(',', '.');
    const val = Math.round(parseFloat(cleanNum) * 100) / 100;
    if (!isNaN(val) && val > 0) {
      amount = val;
      matchedNumStr = explicitCurrency[0].trim();
    }
  }

  if (!amount) {
    const zaNaDigits = lower.match(/(?:^|[^а-яa-z0-9])(?:за|на)\s+(\d[\d\s]*(?:[.,]\d+)?)(?:$|[^а-яa-z0-9])/i);
    if (zaNaDigits) {
      const cleanNum = zaNaDigits[1].replace(/\s+/g, '').replace(',', '.');
      const val = Math.round(parseFloat(cleanNum) * 100) / 100;
      if (!isNaN(val) && val > 0) {
        amount = val;
        matchedNumStr = zaNaDigits[0].trim();
      }
    }
  }

  // 1. Extract amount using advanced compound Russian number & slang recognizer
  // A. "X с половиной [миллиарда/миллиона/тысяч/ляма/косаря/куска]"
  if (!amount) {
    const sPolovinoi = lower.match(/(?:^|[^а-яa-z0-9])(один|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|\d+(?:[.,]\d+)?)\s+с\s+половиной\s*(миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон(?:\b|а|ов)|тысяч[а-я]*|тыщ[а-я]*|косар[а-я]*|куск[а-я]*)(?:$|[^а-яa-z0-9])/i);
    if (sPolovinoi) {
      const wordMap = { 'один': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10 };
      const base = wordMap[sPolovinoi[1]] || parseFloat(sPolovinoi[1].replace(',', '.'));
      const unit = sPolovinoi[2].toLowerCase();
      let mult = 1000;
      if (/миллиард|млрд|ярд/.test(unit)) mult = 1000000000;
      else if (/миллион|млн|лям|лимон/.test(unit)) mult = 1000000;
      amount = Math.round((base + 0.5) * mult);
      matchedNumStr = sPolovinoi[0].trim();
    }
  }

  // B. "полтора / полторы" + scale
  if (!amount) {
    const poltora = lower.match(/(?:^|[^а-яa-z0-9])полтор[ыа]\s*(миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон(?:\b|а|ов)|тысяч[а-я]*|тыщ[а-я]*|косар[а-я]*|куск[а-я]*)(?:$|[^а-яa-z0-9])/i);
    if (poltora) {
      const unit = poltora[1].toLowerCase();
      let mult = 1000;
      if (/миллиард|млрд|ярд/.test(unit)) mult = 1000000000;
      else if (/миллион|млн|лям|лимон/.test(unit)) mult = 1000000;
      amount = Math.round(1.5 * mult);
      matchedNumStr = poltora[0].trim();
    }
  }

  // C. "полмиллиона", "пол-ляма", "полтыщи"
  if (!amount) {
    const polMil = lower.match(/(?:^|[^а-яa-z0-9])(?:полмиллион[а-я]*|пол[- ]?лям[а-я]*)(?:$|[^а-яa-z0-9])/i);
    if (polMil) {
      amount = 500000;
      matchedNumStr = polMil[0].trim();
    }
  }
  if (!amount) {
    const polTys = lower.match(/(?:^|[^а-яa-z0-9])(?:полтыщ[а-я]*|пол[- ]?тысяч[а-я]*)(?:$|[^а-яa-z0-9])/i);
    if (polTys) {
      amount = 500;
      matchedNumStr = polTys[0].trim();
    }
  }

  // D. Digits with explicit multiplier:
  // Billions: 1.5 млрд, 1ккк
  if (!amount) {
    const digBillion = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|ккк|kkk)(?:$|[^а-яa-z0-9])/i);
    if (digBillion) {
      amount = Math.round(parseFloat(digBillion[1].replace(',', '.')) * 1000000000);
      matchedNumStr = digBillion[0].trim();
    }
  }

  // Millions: 1.5 млн, 1.5 ляма, 2.5кк, 10 лимонов, 5 миллионов
  if (!amount) {
    const digMillion = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон[а-я]*|кк|kk)(?:$|[^а-яa-z0-9])/i);
    if (digMillion) {
      amount = Math.round(parseFloat(digMillion[1].replace(',', '.')) * 1000000);
      matchedNumStr = digMillion[0].trim();
    }
  }

  // Thousands: 85 тысяч, 15 тыщ, 3 косаря, 100к, 50к
  if (!amount) {
    const digThousand = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:тысяч[а-я]*|тыщ[а-я]*|тыс[а-я]*|косар[а-я]*|куск[а-я]*|штук[а-я]*|тонн[а-я]*|к|k)(?:$|[^а-яa-z0-9])/i);
    if (digThousand) {
      amount = Math.round(parseFloat(digThousand[1].replace(',', '.')) * 1000);
      matchedNumStr = digThousand[0].trim();
    }
  }

  // Hundreds: 25 сотен
  if (!amount) {
    const digHundreds = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:сот[ен|ни]|сотен)(?:$|[^а-яa-z0-9])/i);
    if (digHundreds) {
      amount = Math.round(parseFloat(digHundreds[1].replace(',', '.')) * 100);
      matchedNumStr = digHundreds[0].trim();
    }
  }

  // E. Russian compound text words ("триста пятьдесят тысяч", "миллион рублей")
  if (!amount) {
    const ONES = { 'один': 1, 'одна': 1, 'одно': 1, 'одну': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9 };
    const TEENS = { 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14, 'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19 };
    const TENS = { 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50, 'шестьдесят': 60, 'семьдесят': 70, 'восемьдесят': 80, 'девяносто': 90 };
    const HUNDREDS = { 'сто': 100, 'двести': 200, 'триста': 300, 'четыреста': 400, 'пятьсот': 500, 'шестьсот': 600, 'семьсот': 700, 'восемьсот': 800, 'девятьсот': 900 };
    const MULTIPLIERS = [
      { regex: /^(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*)$/i, scale: 1000000000 },
      { regex: /^(?:миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон(?:\b|а|ов))$/i, scale: 1000000 },
      { regex: /^(?:тысяч[а-я]*|тыщ[а-я]*|тыс[а-я]*|косар[а-я]*|куск[а-я]*|штук[а-я]*|тонн[а-я]*)$/i, scale: 1000 },
      { regex: /^(?:сот[ен|ни]|сотен)$/i, scale: 100 }
    ];

    const words = text.toLowerCase().replace(/ё/g, 'е').replace(/[^\sа-яa-z0-9]/gi, ' ').trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      let currentTotal = 0;
      let currentGroup = 0;
      let hasMultiplier = false;
      const matchedTokens = [];

      for (let j = i; j < words.length; j++) {
        const w = words[j];
        let val = null;
        let isScale = false;
        let scaleVal = 1;

        for (const m of MULTIPLIERS) {
          if (m.regex.test(w)) {
            isScale = true;
            scaleVal = m.scale;
            break;
          }
        }

        if (isScale) {
          if (currentGroup === 0 && currentTotal === 0) currentGroup = 1;
          currentTotal += currentGroup * scaleVal;
          currentGroup = 0;
          hasMultiplier = true;
          matchedTokens.push(w);
          continue;
        }

        if (HUNDREDS[w] !== undefined) val = HUNDREDS[w];
        else if (TENS[w] !== undefined) val = TENS[w];
        else if (TEENS[w] !== undefined) val = TEENS[w];
        else if (ONES[w] !== undefined) val = ONES[w];

        if (val !== null) {
          currentGroup += val;
          matchedTokens.push(w);
        } else {
          break;
        }
      }

      const finalSum = currentTotal + currentGroup;
      if (finalSum > 0 && (hasMultiplier || matchedTokens.length >= 2 || finalSum >= 100)) {
        amount = finalSum;
        matchedNumStr = matchedTokens.join(' ');
        break;
      }
    }
  }

  // F. Slang fixed denominations
  if (!amount) {
    const isIncomeContext = /(?:заработ|получил|поднял|срубил|выплат|перечисл|начисл|скинули|пришл|приход|капнул|упал|прилетел|доход|выручк|прибыл|гонорар|преми|бонус|оклад|зарплат|аванс|получк|фриланс)/i.test(lower);
    const slangRules = [
      { re: /(?:^|[^а-яa-z0-9])(?:сорокет[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 40000 },
      { re: /(?:^|[^а-яa-z0-9])(?:полтос[а-я]*|полтинник[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 50000 },
      { re: /(?:^|[^а-яa-z0-9])(?:сотка|сотку|сотен|соточк[а-я]*)\s*(?:тыс[а-я]*|тыщ[а-я]*|к\b|k\b)(?:$|[^а-яa-z0-9])/i, val: 100000 },
      { re: /(?:^|[^а-яa-z0-9])(?:сотка|сотку|сотен|соточк[а-я]*)\s*(?:руб[а-я]*|р\b)(?:$|[^а-яa-z0-9])/i, val: 100 },
      { re: /(?:^|[^а-яa-z0-9])(?:сотка|сотку|сотен|соточк[а-я]*)(?:$|[^а-яa-z0-9])/i, val: isIncomeContext ? 100000 : (/(?:руб|кофе|билет|проезд|чай|булк|чипс|жвачк)/i.test(lower) ? 100 : 100000) },
      { re: /(?:^|[^а-яa-z0-9])(?:пятихат[а-я]*|пять сотен)(?:$|[^а-яa-z0-9])/i, val: 500 },
      { re: /(?:^|[^а-яa-z0-9])(?:двушк[а-я]|две штуки)(?:$|[^а-яa-z0-9])/i, val: 2000 },
      { re: /(?:^|[^а-яa-z0-9])(?:трешк[а-я]|трёшк[а-я]|трояк)(?:$|[^а-яa-z0-9])/i, val: 3000 },
      { re: /(?:^|[^а-яa-z0-9])(?:пятерк[а-я]|пятёрк[а-я])(?:$|[^а-яa-z0-9])/i, val: 5000 },
      { re: /(?:^|[^а-яa-z0-9])(?:чирик[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 10000 },
      { re: /(?:^|[^а-яa-z0-9])(?:косарь[а-я]*|косар[яей]*|кусок[а-я]*|куск[а-я]*|штук[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 1000 },
      { re: /(?:^|[^а-яa-z0-9])(?:миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон(?:\b|а|ов))(?:$|[^а-яa-z0-9])/i, val: 1000000 },
      { re: /(?:^|[^а-яa-z0-9])(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 1000000000 }
    ];

    for (const s of slangRules) {
      const m = lower.match(s.re);
      if (m) {
        amount = s.val;
        matchedNumStr = m[0].trim();
        break;
      }
    }
  }

  // G. Standard digits fallback
  if (!amount) {
    const stdNum = lower.match(/(?:^|[^а-яa-z0-9])(\d[\d\s]*(?:[.,]\d+)?)(?:\s*(?:₽|\$|€|₸|руб\.?|р\.?))?(?:$|[^а-яa-z0-9])/i);
    if (stdNum) {
      const cleanNum = stdNum[1].replace(/\s+/g, '').replace(',', '.');
      const val = Math.round(parseFloat(cleanNum) * 100) / 100;
      if (!isNaN(val) && val > 0) {
        amount = val;
        matchedNumStr = stdNum[0].trim();
      }
    }
  }

  // Remove matched number from description string
  if (matchedNumStr) {
    cleanWords = cleanWords.replace(new RegExp(matchedNumStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }

  // 2. Relative Dates (Synchronized with Moscow Time)
  const mskNow = getMskDate();
  let occurred_on = toDateIso(mskNow);
  let dateLabel = 'Сегодня';

  if (/(?:^|[^а-яa-z0-9])позавчера(?:$|[^а-яa-z0-9])/i.test(cleanWords)) {
    const d = new Date(mskNow);
    d.setDate(d.getDate() - 2);
    occurred_on = toDateIso(d);
    dateLabel = 'Позавчера';
    cleanWords = cleanWords.replace(/(?:^|[^а-яa-z0-9])позавчера(?:$|[^а-яa-z0-9])/gi, ' ');
  } else if (/(?:^|[^а-яa-z0-9])вчера(?:$|[^а-яa-z0-9])/i.test(cleanWords)) {
    const d = new Date(mskNow);
    d.setDate(d.getDate() - 1);
    occurred_on = toDateIso(d);
    dateLabel = 'Вчера';
    cleanWords = cleanWords.replace(/(?:^|[^а-яa-z0-9])вчера(?:$|[^а-яa-z0-9])/gi, ' ');
  } else {
    const daysMatch = cleanWords.match(/(\d+)\s*(?:дн[яей]+|дня)\s*назад/i);
    if (daysMatch) {
      const n = parseInt(daysMatch[1], 10);
      const d = new Date(mskNow);
      d.setDate(d.getDate() - n);
      occurred_on = toDateIso(d);
      dateLabel = `${n} дн. назад`;
      cleanWords = cleanWords.replace(daysMatch[0], ' ');
    } else {
      // Day of week support (понедельник, вторник, среду, четверг, пятницу, субботу, воскресенье)
      const dowMatch = cleanWords.match(/(?:в|во)?\s*(прошл[уюыйое]+)?\s*(понедельник|вторник|сред[уа]|четверг|пятниц[уа]|суббот[уа]|воскресень[ея])/i);
      if (dowMatch) {
        const dNames = { 'воскресень': 0, 'понедельник': 1, 'вторник': 2, 'сред': 3, 'четверг': 4, 'пятниц': 5, 'суббот': 6 };
        const rawKey = Object.keys(dNames).find(k => dowMatch[2].toLowerCase().startsWith(k));
        if (rawKey !== undefined) {
          const targetDow = dNames[rawKey];
          const curDow = mskNow.getDay();
          let diff = curDow - targetDow;
          if (diff < 0) diff += 7;
          if (diff === 0 && dowMatch[1]) diff = 7; // "в прошлый понедельник" on Monday
          const d = new Date(mskNow);
          d.setDate(d.getDate() - diff);
          occurred_on = toDateIso(d);
          dateLabel = diff === 0 ? 'Сегодня' : (diff === 1 ? 'Вчера' : `${diff} дн. назад`);
          cleanWords = cleanWords.replace(dowMatch[0], ' ');
        }
      }
    }
  }

  // 3. Category & Type Detection (Income vs Expense)
  let type = 'expense';
  let category = 'Прочее';
  let iconEmoji = 'creditCard';

  // Comprehensive Income Regex Patterns
  const isIncome = /(?:заработ|получил|поднял|срубил|намайнил|выплат|перевел.*мне|перечисл|начисл|скинули|закинули|пришл|приход|капнул|упал[а-я]*\s+ден|прилетел|залетел|поступлен|поступил|доход|выручк|прибыл|гонорар|преми|бонус|оклад|отпускн|больничн|зарплат|аванс|получк|продал|подар|чаев|донат|вернули долг|отдали долг)/i.test(lower);

  if (isIncome) {
    type = 'income';
    if (/фриланс|проект|клиент|заказ|шабашк|халтур|калым|подработк|смен[аы]|дизайн|верстк|разработк|сайт/i.test(lower)) {
      category = 'Фриланс';
      iconEmoji = 'briefcase';
    } else if (/дивиденд|купон|процент|вклад|акци|инвест|крипт|биток|eth|usdt|тон\b/i.test(lower)) {
      category = 'Инвестиции';
      iconEmoji = 'trendUp';
    } else if (/продал|авито|юла|сбыт/i.test(lower)) {
      category = 'Продажи';
      iconEmoji = 'tag';
    } else if (/подар|день рожден|др\b|чаев|донат/i.test(lower)) {
      category = 'Подарки';
      iconEmoji = 'gift';
    } else if (/кэшбэк|бонус|возврат|вычет/i.test(lower)) {
      category = 'Кэшбэк';
      iconEmoji = 'creditCard';
    } else if (/долг|вернули|отдали/i.test(lower)) {
      category = 'Возврат долга';
      iconEmoji = 'wallet';
    } else {
      category = 'Зарплата';
      iconEmoji = 'banknote';
    }
  } else {
    type = 'expense';

    // A. Coffee, Bakery & Hot Drinks (Кафе)
    if (/кофе|кофей[а-я]*|латте|капуч[а-я]*|флэт.*уайт|раф[а-я]*|эспрессо|американо|матча|какао|чай\b|чаёк|чаек|булочн[а-я]*|пекарн[а-я]*|круассан[а-я]*|слойк[а-я]*|чизкейк[а-я]*|десерт[а-я]*|пончик[а-я]*|донат[а-я]*|синнабон[а-я]*|эклер[а-я]*|пирожн[а-я]*|торт[а-я]*/i.test(lower)) {
      category = 'Кафе';
      iconEmoji = 'coffee';
    }
    // B. Fast food, Asian/Caucasian/European dishes, Dining out & Delivery (Рестораны)
    else if (/шав[ауе][а-я]*|шаверм[а-я]*|шаурм[а-я]*|донер[а-я]*|кебаб[а-я]*|шашлык[а-я]*|люля|пицц[а-я]*|додо|папа.*джонс|бургер[а-я]*|воппер|бигмак|макдак|мак\b|вкусно.*точк|вит\b|кфс|kfc|ростикс|наггетс[а-я]*|стрипс[а-я]*|хот[- ]?дог[а-я]*|ролл[а-я]*|суши|сет.*ролл|филадельфи[а-я]*|калифорни[а-я]*|якитори|тануки|том.*ям|том.*кха|фо.*бо|фо.*га|рамен[а-я]*|рамэн[а-я]*|вок[а-я]*|лапш[а-я]*.*вок|пад.*тай|удон|соба|фунчоз[а-я]*|димсам[а-я]*|бао|хинкал[а-я]*|хачапур[а-я]*|плов[а-я]*|лагман[а-я]*|мант[а-я]*|самс[а-я]*|шурп[а-я]*|чебурек[а-я]*|беляш[а-я]*|борщ[а-я]*|солянк[а-я]*|харчо|ух[а-я]\b|крем[- ]?суп|суп[- ]?пюре|лапш[а-я]*.*курин|карбонар[а-я]*|болоньез[а-я]*|лазань[а-я]*|ризотто|стейк[а-я]*|рибай|медальон[а-я]*|тартар[а-я]*|карпаччо|цезар[а-я]*|оливье|греческ.*салат|бизнес[- ]?ланч[а-я]*|ланч[а-я]*|обед[а-я]*|ужин[а-я]*|завтрак[а-я]*|столовк[а-я]*|столов[а-я]*|рестик[а-я]*|ресторан[а-я]*|кафешк[а-я]*|бистро|трактир|чайхон[а-я]*|фудкорт|посидели|покушать|пожрать|пообедать|поужинать|доставк.*еды|яндекс.*еда|деливери|купер.*еда|пиво|пивас|пивко|крафт|сидр|сидрери[а-я]*|вино|бар\b|паб\b|кальян[а-я]*/i.test(lower)) {
      category = 'Рестораны';
      iconEmoji = 'utensils';
    }
    // C0. Hobbies, Fishing & Outdoor Gear (Хобби)
    else if (/рыбал[а-я]*|рыболов[а-я]*|снаст[а-я]*|блесн[а-я]*|спиннинг[а-я]*|удочк[а-я]*|клёв[а-я]*|хищник|трофей|spinningline|fmagazin|kaida|кайда|охота и рыбалка|серебряный ручей|хобби|леонардо|моделизм|настолк[а-я]*/i.test(lower)) {
      category = 'Хобби';
      iconEmoji = 'compass';
    }
    // C. Groceries & Supermarkets & Staples at home (Продукты)
    else if (/макарон[а-я]*|спагетти|паст[а-я]*|вермишел[а-я]*|рожк[а-я]*|гречк[а-я]*|греч[а-я]*|рис[а-я]*|пшен[а-я]*|овсянк[а-я]*|геркулес[а-я]*|хлопь[а-я]*|круп[а-я]*|булгур[а-я]*|кускус[а-я]*|киноа|чечевиц[а-я]*|фасол[а-я]*|горох[а-я]*|мук[а-я]*|сахар[а-я]*|сол[иь][а-я]*|сод[а-я]*|крахмал[а-я]*|дрожж[а-я]*|специ[а-я]*|приправ[а-я]*|масл[а-я]*|подсолнечн[а-я]*|оливков[а-я]*|сливочн.*масл[а-я]*|майонез[а-я]*|мазик[а-я]*|кетчуп[а-я]*|соус[а-я]*|томатн.*паст[а-я]*|горчиц[а-я]*|хрен[а-я]*|уксус[а-я]*|консерв[а-я]*|тушенк[а-я]*|шпрот[а-я]*|сайр[а-я]*|тун[ец][а-я]*|паштет[а-я]*|горошек[а-я]*|кукуруз[а-я]*|колбас[а-я]*|сосиск[а-я]*|сардельк[а-я]*|ветчин[а-я]*|сервелат[а-я]*|карбонад[а-я]*|бекон[а-я]*|мяс[а-я]*|фарш[а-я]*|котлет[а-я]*|говядин[а-я]*|свинин[а-я]*|телятин[а-я]*|баранин[а-я]*|индейк[а-я]*|куриц[а-я]*|кур[а-я]*|курин[а-я]*|цыплят[а-я]*|цыпленок|грудк[а-я]*|филе|бедрышк[а-я]*|окороч[а-я]*|крылышк[а-я]*|пельмен[а-я]*|вареник[а-я]*|рыб\b|рыб[ауые]|рыбк[а-я]*|рыбн[а-я]*|лосос[а-я]*|семг[а-я]*|сёмг[а-я]*|форел[а-я]*|селедк[а-я]*|минта[а-я]*|треск[а-я]*|скумбри[а-я]*|креветк[а-я]*|кальмар[а-я]*|крабов.*палочк[а-я]*|молок[а-я]*|молочк[а-я]*|творог[а-я]*|творож[а-я]*|сыр[а-я]*|сырок[а-я]*|сырочк[а-я]*|сметан[а-я]*|кефир[а-я]*|ряженк[а-я]*|йогурт[а-я]*|сливк[а-я]*|сгущенк[а-я]*|сгущёнк[а-я]*|яйц[а-я]*|яичк[а-я]*|яиц|овощ[а-я]*|картох[а-я]*|картошк[а-я]*|картофел[а-я]*|помидор[а-я]*|томат[а-я]*|огур[ец][а-я]*|капуст[а-я]*|морков[а-я]*|морковк[а-я]*|лук[а-я]*|чеснок[а-я]*|зелен[а-я]*|укроп[а-я]*|петрушк[а-я]*|салат[а-я]*|свекл[а-я]*|свёкл[а-я]*|кабач[а-я]*|баклажан[а-я]*|перец|перц[а-я]*|гриб[а-я]*|шампиньон[а-я]*|фрукт[а-я]*|яблок[а-я]*|банан[а-я]*|апельсин[а-я]*|мандарин[а-я]*|лимон[а-я]*|груш[а-я]*|виноград[а-я]*|персик[а-я]*|нектарин[а-я]*|ягод[а-я]*|клубник[а-я]*|малин[а-я]*|черник[а-я]*|голубик[а-я]*|арбуз[а-я]*|дыня|дыни|ананас[а-я]*|авокадо|манго|хлеб[а-я]*|хлебушек|батон[а-я]*|лаваш[а-я]*|булк[а-я]*|булочк[а-я]*|багет[а-я]*|тост[а-я]*|сухар[а-я]*|печень[а-я]*|пряник[а-я]*|вафл[а-я]*|конфет[а-я]*|шоколад[а-я]*|шоколадк[а-я]*|батончик[а-я]*|чипс[а-я]*|снек[а-я]*|снэк[а-я]*|сухарик[а-я]*|семечк[а-я]*|орех[а-я]*|арахис[а-я]*|мармелад[а-я]*|зефир[а-я]*|минералк[а-я]*|газировк[а-я]*|лимонад[а-я]*|сочок|соки|сок\b|магазин[а-я]*|супермаркет[а-я]*|гипермаркет[а-я]*|гастроном[а-я]*|универсам[а-я]*|пятерочк[а-я]*|пятёрочк[а-я]*|пятак[а-я]*|магнит[а-я]*|перекресток[а-я]*|перекрёсток[а-я]*|перек[а-я]*|вкусвилл[а-я]*|лент[а-я]*|ашан[а-я]*|дикси|спар\b|spar\b|глобус[а-я]*|чижик[а-я]*|красное.*белое|кб\b|к&б|бристол[а-я]*|ярче|верный|азбук[а-я].*вкус[а-я]*|окей|самокат.*продукт|лавка.*продукт|сбермаркет|продукт[а-я]*|еда домой|покушать домой|закупился|покупки домой/i.test(lower)) {
      category = 'Продукты';
      iconEmoji = 'cart';
    }
    // D. Transport, Auto & Fuel
    else if (/такс|uber|убер|яндекс.*гоу|яндекс.*такси|карш|каршеринг|делимобиль|ситидрайв|белк[а]|заправил|бенз|дизель|солярк|азс|лукойл|газпром|роснефть|татнефть|тебойл|мойка|самомойк|детейлинг|помыл тачк|помыл машин|шиномонтаж|переобул|резин[аы]|балансировк|метро|проездной|тройк|стрелк|автобус|маршрутк|трамвай|электричк|мцд|мцк|сапсан|ласточк|ржд|поезд|самолет|авиабилет|побед|аэрофлот|s7|парковк|штраф|гибдд|платка|осаго|каско/i.test(lower)) {
      category = 'Транспорт';
      iconEmoji = 'car';
    }
    // E. Animals / Pets
    else if (/коров[а-я]*|бык[а-я]*|телят[а-я]*|теленок|телк[а-я]*|коз[а-я]*|свин[а-я]*|хрюш[а-я]*|поросят[а-я]*|лошад[а-я]*|кон[яеь][а-я]*|жереб[а-я]*|овц[а-я]*|баран[а-я]*|ягнят[а-я]*|кур[а-я]*|петух[а-я]*|цыплят[а-я]*|гус[а-я]*|утк[а-я]*|индюк[а-я]*|скот[а-я]*|ферм[а-я]*|пасек[а-я]*|пчел[а-я]*|улей|питом[а-я]*|собак[а-я]*|щен[а-я]*|пес[а-я]*|пёсел[а-я]*|кошк[а-я]*|кот[а-я]*|котят[а-я]*|котейк[а-я]*|хомяк[а-я]*|попуга[а-я]*|рыбк[а-я]*|аквариум[а-я]*|грызун[а-я]*|корм[а-я]*|ветеринар[а-я]*|ветклиник[а-я]*|груминг[а-я]*|поводок|лоток|наполнитель/i.test(lower)) {
      category = 'Питомцы';
      iconEmoji = 'heart';
    }
    // F. Tech & Gaming
    else if (/плойк|соньк|playstation|ps5|ps4|xbox|иксбокс|нинтендо|switch|стимдек|видяха|видюх|видеокарт|rtx|geforce|проц|процессор|ссд|ssd|оперативк|монитор|моник|клав|мышк|айфон|iphone|эйрподс|airpods|макбук|macbook|ipad|айпад|эппл.*вотч|ноут|ноутбук|комп|пк|системник|телевизор|телик|техник|гаджет|наушник|колонк|алис[а]|станци[яи]|пылесос|стиралк|холодильник|микроволновк/i.test(lower)) {
      category = 'Техника';
      iconEmoji = 'laptop';
    }
    // G. Subscriptions
    else if (/спотик|spotify|эппл.*мьюзик|apple.*music|яндекс.*плюс|плюс\b|телег|telegram.*prem|tg.*prem|нетфликс|netflix|ютуб|youtube|кинопоиск|иви|ivi|окко|okko|кион|kion|premier|start|впн|vpn|хостинг|сервер|vps|vds|домен|айклауд|icloud|гугл.*диск|облако|подписк|chatgpt|gpt|midjourney|github|figma/i.test(lower)) {
      category = 'Подписки';
      iconEmoji = 'layers';
    }
    // H. Shopping & Clothes
    else if (/шмот|педал|тяги|кросс|кед|сникер|ботинк|худи|зипк|толстовк|свитшот|куртк|пуховик|пальто|джинс|штаны|брюк|футболк|мерч|вб\b|вэбэ|вайлдберриз|wildberries|озон|ozon|яндекс.*маркет|маркетплейс|мегамаркет|авито|цум|гум|стокманн|зарин|лайм|lime|befree|lamoda|ламода|косметик|духи|парфюм|золот.*яблок|зя\b|летуаль|шопинг|покупк/i.test(lower)) {
      category = 'Покупки';
      iconEmoji = 'gift';
    }
    // I. Health & Sports
    else if (/зал\b|качалк|спортзал|фитнес|трен[яе]|тренировк|тренер|персоналк|абонемент|протеин|креатин|бцаа|аптек|таблетк|колес[а]|витамин|омег[а]|врач|доктор|терапевт|стоматолог|зуб|пломб|брекет|элайнер|мрт|кт|узи|анализ|инвитро|гемотест|kdl|здоровь|массаж|психолог|остиопат|спа\b/i.test(lower)) {
      category = 'Здоровье';
      iconEmoji = 'heart';
    }
    // J. Housing & Utilities
    else if (/аренд|квартир|хат|ипотек|жкх|коммуналк|квартплат|свет|электричеств|вод[аы]|отоплен|газ\b|домофон|капремонт|интернет|вайфай|провайдер|ростелеком|домру|клининг|уборк|ремонт|стройк|обои|краск|плитк|ламинат|сантехник|леруа|лемана.*про|петрович|оби|obi|мебель|икеа|ikea|hoff|диван|кровать|шкаф|стол|матрас/i.test(lower)) {
      category = 'Жилье';
      iconEmoji = 'home';
    }
    // K. Entertainment
    else if (/стим\b|steam|донат|скин|батлпас|battle.*pass|бп\b|вбакс|v-bucks|кино|фильм|сеанс|театр|спектакль|концерт|фест|фестивал|стендап|квест|боулинг|бильярд|страйкбол|парк|аттракцион|зоопарк|аквапарк|баня|сауна|настолк|игры/i.test(lower)) {
      category = 'Развлечения';
      iconEmoji = 'sparkles';
    }
    // L. Investments
    else if (/акци|облигац|офз|брокер|тинькофф.*инвест|бкс|крипт|биткоин|биток|btc|эфир|eth|usdt|тезер|тон\b|ton\b|байбит|bybit|бинанс|binance/i.test(lower)) {
      category = 'Инвестиции';
      iconEmoji = 'trendUp';
    }
  }

  // Clean description: remove stop words, action prefixes, and slang words
  const stopWords = new Set([
    'за', 'на', 'в', 'во', 'из', 'по', 'с', 'со', 'от', 'для', 'к', 'ко',
    'рублей', 'руб', 'рубля', 'р', 'сегодня', 'вчера', 'позавчера',
    'я', 'мне', 'у', 'меня', 'мы', 'нам',
    'тысяч', 'тысячи', 'тыщ', 'тыс', 'миллион', 'миллиона', 'миллионов', 'млн', 'лям', 'лямов',
    'миллиард', 'миллиарда', 'миллиардов', 'млрд', 'ярд', 'ярдов',
    'косарь', 'косаря', 'косарей', 'кусок', 'куска', 'кусков', 'штука', 'штуки', 'штук', 'тонна', 'тонн',
    'сотка', 'сотку', 'сотен', 'соточку', 'соточка', 'полтос', 'полтинник', 'сорокет', 'пятихатка', 'пятихат', 'двушка', 'трешка', 'пятерка', 'чирик',
    'баксов', 'долларов', 'евро', 'юаней', 'usdt'
  ]);
  const actionPrefixes = [
    'получил', 'получила', 'заработал', 'заработала', 'поднял', 'подняла', 'срубил', 'срубила',
    'купил', 'купила', 'купили', 'потратил', 'потратила', 'потратили', 'взял', 'взяла', 'взяли',
    'зацепил', 'зацепила', 'скинул', 'скинула', 'скинули', 'перевел', 'перевела', 'перевели',
    'перечислил', 'перечислила', 'капнул', 'капнуло', 'начислили', 'начислил', 'отдал', 'отдала',
    'упал', 'упали', 'упало', 'прилетел', 'прилетело', 'прилетели', 'залетел', 'залетело',
    'оплатил', 'оплатила', 'оплатили', 'закупился', 'закупились'
  ];

  const canonicalMap = [
    { re: /^арбуз/i, name: 'Арбуз' },
    { re: /^лимон/i, name: 'Лимоны' },
    { re: /^макарон/i, name: 'Макароны' },
    { re: /^греч[ка]*$/i, name: 'Гречка' },
    { re: /^шав[уае][а-я]*$/i, name: 'Шаурма' },
    { re: /^хинкал/i, name: 'Хинкали' },
    { re: /^хачапур/i, name: 'Хачапури' },
    { re: /^бургер/i, name: 'Бургер' },
    { re: /^додо/i, name: 'Додо Пицца' },
    { re: /^том\s*ям/i, name: 'Том ям' },
    { re: /^фо\s*бо/i, name: 'Фо бо' },
    { re: /^рамен/i, name: 'Рамен' },
    { re: /^плов/i, name: 'Плов' },
    { re: /^борщ/i, name: 'Борщ' },
    { re: /^пятерочк|^пятёрочк/i, name: 'Пятёрочка' },
    { re: /^перекресток|^перекрёсток/i, name: 'Перекрёсток' },
    { re: /^вкусвилл/i, name: 'ВкусВилл' },
    { re: /^магнит/i, name: 'Магнит' }
  ];

  const remainingWords = cleanWords
    .trim()
    .split(/\s+/)
    .filter(w => {
      const low = w.toLowerCase().replace(/[^а-яa-z0-9]/gi, '');
      if (!low) return false;
      if (stopWords.has(low)) return false;
      if (actionPrefixes.some(p => low.startsWith(p))) return false;
      return true;
    });

  let cleanDesc = remainingWords.join(' ').trim();
  if (cleanDesc) {
    const matchedCanonical = canonicalMap.find(c => c.re.test(cleanDesc));
    if (matchedCanonical) {
      cleanDesc = matchedCanonical.name;
    } else {
      cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
    }
  }

  return {
    raw: text,
    amount,
    type,
    category,
    icon: iconEmoji,
    occurred_on,
    dateLabel,
    description: cleanDesc || (type === 'income' ? 'Поступление средств' : category)
  };
}


// Collision-free axis label spacing ensuring last label is always visible
const isLabelVisible = (idx, total) => {
  if (total <= 8) return true;
  if (total <= 16) {
    if (idx === total - 1) return true;
    if (idx === total - 2) return false;
    return idx % 2 === 0;
  }
  if (idx === total - 1) return true;
  if (idx === total - 2 || idx === total - 3) return false;
  const step = total > 25 ? 5 : 4;
  return idx % step === 0;
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
    return { title: 'Финансовый стратег', badge: 'crown', desc: 'Уверенный капитал и системный контроль над будущим' };
  }
  if (totalCapital >= 100000 || totalSaved >= 40000) {
    return { title: 'Капиталист', badge: 'gem', desc: 'Стабильный рост сбережений и надежный инвестиционный резерв' };
  }
  if (totalCapital >= 25000 || (goals && goals.length > 0)) {
    return { title: 'Мастер бюджета', badge: 'sparkle', desc: 'Осознанные расходы и дисциплина лимитов' };
  }
  return { title: 'Первые шаги', badge: 'activity', desc: 'Начало построения финансовой свободы и подушки безопасности' };
}

// Friendly Category SVG Icon Key Map (Anti-Slop, 100% Vector)
const categoryIcons = {
  'Продукты': 'cart',
  'Рестораны': 'utensils',
  'Кафе': 'coffee',
  'Транспорт': 'car',
  'Такси': 'compass',
  'Зарплата': 'banknote',
  'Фриланс': 'briefcase',
  'Дивиденды': 'trendUp',
  'Инвестиции': 'trendUp',
  'Продажи': 'tag',
  'Кэшбэк': 'creditCard',
  'Возврат долга': 'wallet',
  'Подписки': 'layers',
  'Здоровье': 'heart',
  'Спорт': 'dumbbell',
  'Покупки': 'tag',
  'Техника': 'laptop',
  'Жилье': 'home',
  'ЖКХ': 'home',
  'Питомцы': 'heart',
  'Животные': 'heart',
  'Хозяйство': 'home',
  'Путешествия': 'plane',
  'Образование': 'book',
  'Развлечения': 'sparkles',
  'Подарки': 'gift',
  'Авто': 'car',
  'Хобби': 'compass'
};

const getCategoryIcon = (cat, type, size = 15) => {
  let iconName = categoryIcons[cat];
  if (!iconName) {
    const c = String(cat || '').toLowerCase();
    if (type === 'income') {
      if (/фриланс|проект|клиент|заказ|дизайн|разработк/i.test(c)) iconName = 'briefcase';
      else if (/инвест|дивиденд|купон|акци|крипт/i.test(c)) iconName = 'trendUp';
      else if (/продаж|авито/i.test(c)) iconName = 'tag';
      else if (/подар|чаев|донат/i.test(c)) iconName = 'gift';
      else if (/кэшбэк|бонус/i.test(c)) iconName = 'creditCard';
      else if (/долг|возврат/i.test(c)) iconName = 'wallet';
      else iconName = 'banknote';
    } else {
      if (/рыбал|снаст|охот|хобби|модел|творчеств/i.test(c)) iconName = 'compass';
      else if (/питом|животн|собак|кошк|корм|вет/i.test(c)) iconName = 'heart';
      else if (/хозяйств|ферм|сад/i.test(c)) iconName = 'home';
      else if (/такси/i.test(c)) iconName = 'compass';
      else if (/транспорт|авто|машин|бензин|метро/i.test(c)) iconName = 'car';
      else if (/кофе|кафе|пекарн/i.test(c)) iconName = 'coffee';
      else if (/ресторан|бар|пицц|бургер|еда|доставк/i.test(c)) iconName = 'utensils';
      else if (/техник|гаджет|комп|айфон|ноут/i.test(c)) iconName = 'laptop';
      else if (/подписк|сервис|онлайн/i.test(c)) iconName = 'layers';
      else if (/покупк|одежд|шмот|шопинг/i.test(c)) iconName = 'tag';
      else if (/спорт|фитнес/i.test(c)) iconName = 'dumbbell';
      else if (/здоров|аптек|врач/i.test(c)) iconName = 'heart';
      else if (/жил|аренд|квартир|жкх|коммунал/i.test(c)) iconName = 'home';
      else if (/развлечен|кино|игра|парк/i.test(c)) iconName = 'sparkles';
      else if (/продукт|супермаркет/i.test(c)) iconName = 'cart';
      else if (/путешеств|отпуск|билет/i.test(c)) iconName = 'plane';
      else if (/книг|учеб|курс/i.test(c)) iconName = 'book';
      else iconName = 'tag';
    }
  }
  return `<span class="category-svg-badge ${type === 'income' ? 'income' : 'expense'}">${icon(iconName, size)}</span>`;
};

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
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"></path><path d="M5 3v4M3 5h4M19 17v4M17 19h4"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    checkCircle: '<circle cx="12" cy="12" r="10"></circle><polyline points="16 9 10 15 7 12"></polyline>',
    wallet: '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"></path>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    chevronRight: '<polyline points="9 18 15 12 9 6"></polyline>',
    target: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
    alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    cart: '<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>',
    utensils: '<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"></path><path d="M15 11v11"></path><path d="M5 2v10a3 3 0 0 0 3 3h1v7"></path><path d="M9 2v4"></path>',
    coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
    laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>',
    gift: '<polyline points="20 12 20 22 4 22 4 12"></polyline><rect width="20" height="5" x="2" y="7" rx="1"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10M6 10h10"></path>',
    compass: '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
    briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
    creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>',
    tag: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><circle cx="7" cy="7" r="1"></circle>',
    dumbbell: '<path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1a2 2 0 0 0-2.83 0l-.88.88a2 2 0 0 1-2.83 0l-1.58-1.58a2 2 0 0 1 0-2.83l.88-.88a2 2 0 0 0 0-2.83l-1-1"></path><path d="m3 3 1 1a2 2 0 0 0 2.83 0l.88-.88a2 2 0 0 1 2.83 0l1.58 1.58a2 2 0 0 1 0 2.83l-.88.88a2 2 0 0 0 0 2.83l1 1"></path>',
    globe: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"></path>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>',
    tv: '<rect width="20" height="15" x="2" y="7" rx="2"></rect><polyline points="17 2 12 7 7 2"></polyline>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.3-1.8 1.1l-.3 1.2c-.2.7.2 1.5.9 1.8l6.2 3.2-3.3 3.3-2.4-.6c-.5-.1-1 .2-1.3.6l-.4.6c-.3.5-.1 1.2.4 1.5l3.2 2 2 3.2c.4.5 1.1.7 1.6.4l.6-.4c.4-.3.7-.8.6-1.3l-.6-2.4 3.3-3.3 3.2 6.2c.3.7 1.1 1.1 1.8.9l1.2-.3c.8-.2 1.3-1 1.1-1.8z"></path>',
    refresh: '<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>',
    crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>',
    gem: '<polygon points="6 3 18 3 22 9 12 22 2 9"></polygon><path d="M12 22V9M2 9h20M7.5 3 12 9l4.5-6"></path>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
    award: '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
    radar: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="12" x2="19" y2="7"></line>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
  };

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="svg-icon svg-icon-${name}">${icons[name] || ''}</svg>`;
}

/* ==========================================================================
   AMBIENT BACKGROUND: SOOTHING FLUID AURORA
   ========================================================================== */
function initAmbientCanvas() {
  try {
    const canvas = document.getElementById('ambient-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      try {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      } catch (_) {}
    });

    let t = 0;
    let animId = null;

    function draw() {
      try {
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
      } catch (_) {}
    }

    document.addEventListener('visibilitychange', () => {
      try {
        if (document.hidden) {
          cancelAnimationFrame(animId);
        } else {
          draw();
        }
      } catch (_) {}
    });

    draw();
  } catch (err) {
    console.warn('Ambient canvas safely disabled:', err);
  }
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

  const avatarDisplay = getAvatarHtml(profile.avatar, userInitial, 36);

  // Today's cashflow delta (MSK)
  const todayIso = getTodayMskIso();
  const todayTxs = (data.transactions || []).filter(t => (t.occurred_on || '').startsWith(todayIso));
  const todayInc = todayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const todayExp = todayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const todayDelta = todayInc - todayExp;
  const showDelta = !privacyMode && todayDelta !== 0;

  return `
    <header class="masthead">
      <div class="masthead-left">
        <div class="brand" data-tab="home" title="FinKaif — На главную">
          <div class="brand-logo-mark">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="fk-grad-bg" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#121D24"/>
                  <stop offset="100%" stop-color="#080E12"/>
                </linearGradient>
                <linearGradient id="fk-grad-pillar" x1="7" y1="7" x2="12" y2="27" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#5EEAD4"/>
                  <stop offset="50%" stop-color="#2DD4BF"/>
                  <stop offset="100%" stop-color="#0D9488"/>
                </linearGradient>
                <linearGradient id="fk-grad-wing1" x1="11" y1="7" x2="26" y2="13" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#FFFFFF"/>
                  <stop offset="50%" stop-color="#A7F3D0"/>
                  <stop offset="100%" stop-color="#2DD4BF"/>
                </linearGradient>
                <linearGradient id="fk-grad-wing2" x1="11" y1="14" x2="22" y2="19" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#5EEAD4"/>
                  <stop offset="100%" stop-color="#0D9488"/>
                </linearGradient>
                <filter id="fk-glow-core" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.2" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <!-- Squircle Chassis with subtle specular highlight -->
              <rect width="34" height="34" rx="10" fill="url(#fk-grad-bg)"/>
              <rect x="0.5" y="0.5" width="33" height="33" rx="9.5" stroke="rgba(45, 212, 191, 0.28)" stroke-width="1"/>
              <path d="M6 1.5C11 0.9 23 0.9 28 1.5" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1" stroke-linecap="round"/>
              <!-- Architectural Kinetic Emblem -->
              <g filter="url(#fk-glow-core)">
                <!-- Vertical Core Pillar -->
                <rect x="8" y="7.5" width="4" height="19" rx="2" fill="url(#fk-grad-pillar)"/>
                <!-- Upper Aerodynamic Wing -->
                <path d="M12 7.5H23C24.38 7.5 25.5 8.62 25.5 10C25.5 11.38 24.38 12.5 23 12.5H12V7.5Z" fill="url(#fk-grad-wing1)"/>
                <!-- Mid Harmonic Wing -->
                <path d="M12 14.5H19.5C20.6 14.5 21.5 15.4 21.5 16.5C21.5 17.6 20.6 18.5 19.5 18.5H12V14.5Z" fill="url(#fk-grad-wing2)"/>
                <!-- Kinetic Amber/Jade Precision Spark -->
                <circle cx="21" cy="24" r="2" fill="#5EEAD4"/>
              </g>
            </svg>
          </div>
          <div class="brand-wordmark">
            <span class="brand-wordmark-fin">Fin</span><span class="brand-wordmark-kaif">Kaif</span>
            <span class="brand-wordmark-dot"></span>
          </div>
        </div>

        <div class="brand-cloud-status" id="brand-cloud-status" title="Синхронизировано с защищённым облаком FinKaif OS (AES-GCM)">
          <span class="cloud-pulse-wrap">
            <span class="cloud-pulse-dot"></span>
          </span>
          <span class="cloud-status-text">Синхронизировано</span>
        </div>
      </div>

      <nav class="nav-controller" role="tablist">
        <div class="nav-glider" id="nav-glider"></div>
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
        <div class="balance-pill num" id="masthead-balance-pill" title="${privacyMode ? 'Показать баланс (горячая клавиша P)' : 'Скрыть баланс (горячая клавиша P)'}">
          <span class="pulse-dot"></span>
          <span id="masthead-balance-figure">${money(balance)}</span>
          ${showDelta ? `
            <span class="balance-delta ${todayDelta >= 0 ? 'pos' : 'neg'}" title="Денежный поток за сегодня (${todayDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('ru-RU').format(todayDelta)} ₽)">
              ${todayDelta >= 0 ? '▲ +' : '▼ −'}${new Intl.NumberFormat('ru-RU').format(Math.abs(todayDelta))} ₽
            </span>
          ` : ''}
          <button class="privacy-toggle-btn ${privacyMode ? 'active' : ''}" id="btn-toggle-privacy" title="${privacyMode ? 'Показать баланс' : 'Скрыть баланс'}">
            ${privacyMode ? icon('eyeOff', 14) : icon('eye', 14)}
          </button>
        </div>

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
   SUBSCRIPTION RADAR & RECURRING BILLS COMPONENT
   ========================================================================== */
function renderSubscriptionRadar() {
  const subs = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const now = getMskDate();
  const today = now.getDate();
  const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const getSubMeta = (s) => {
    const day = Math.min(31, Math.max(1, parseInt(s.day_of_month, 10) || 1));
    let daysLeft = 0;
    if (day === today) {
      daysLeft = 0;
    } else if (day > today) {
      daysLeft = day - today;
    } else {
      daysLeft = (daysInCurMonth - today) + day;
    }

    let badgeText = '';
    let badgeClass = 'normal';
    let cardClass = '';

    if (daysLeft === 0) {
      badgeText = 'Сегодня!';
      badgeClass = 'critical';
      cardClass = 'critical';
    } else if (daysLeft === 1) {
      badgeText = 'Завтра!';
      badgeClass = 'critical';
      cardClass = 'critical';
    } else if (daysLeft <= 3) {
      badgeText = `Через ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`;
      badgeClass = 'warning';
      cardClass = 'warning';
    } else {
      badgeText = `Через ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`;
      badgeClass = 'normal';
      cardClass = '';
    }

    const nameLower = (s.name || '').toLowerCase();
    let iconEmoji = 'layers';
    if (/яндекс|yandex|плюс/i.test(nameLower)) iconEmoji = 'layers';
    else if (/telegram|телег/i.test(nameLower)) iconEmoji = 'plane';
    else if (/spotify|спотик|музык|apple\s*music/i.test(nameLower)) iconEmoji = 'headphones';
    else if (/cloud|облак|icloud|drive/i.test(nameLower)) iconEmoji = 'cloud';
    else if (/зал|спорт|фитнес|gym/i.test(nameLower)) iconEmoji = 'dumbbell';
    else if (/интернет|провайдер|связь|мтс|мегафон|билайн|т2/i.test(nameLower)) iconEmoji = 'globe';
    else if (/ютуб|youtube|netflix|нетфликс|кинопоиск|иви/i.test(nameLower)) iconEmoji = 'tv';

    return { daysLeft, badgeText, badgeClass, cardClass, iconEmoji, day };
  };

  const enrichedSubs = subs.map(s => ({ ...s, meta: getSubMeta(s) }))
    .sort((a, b) => a.meta.daysLeft - b.meta.daysLeft);

  const totalMonthly = subs.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalAnnual = totalMonthly * 12;

  const existingNames = new Set(subs.map(s => (s.name || '').toLowerCase().trim()));
  const presetSuggestions = [
    { name: 'Яндекс Плюс', amount: 299, day: 25, icon: 'layers', cat: 'Подписки' },
    { name: 'Telegram Premium', amount: 299, day: 12, icon: 'plane', cat: 'Подписки' },
    { name: 'Spotify Premium', amount: 299, day: 1, icon: 'headphones', cat: 'Подписки' },
    { name: 'Облако iCloud / Drive', amount: 1490, day: 15, icon: 'cloud', cat: 'Подписки' },
    { name: 'Фитнес-клуб', amount: 2500, day: 5, icon: 'dumbbell', cat: 'Здоровье' },
    { name: 'Домашний интернет', amount: 650, day: 1, icon: 'globe', cat: 'Жилье' }
  ].filter(p => !existingNames.has(p.name.toLowerCase()));

  return `
    <div class="subscription-radar-card" id="subscription-radar">
      <div class="sub-radar-header">
        <div class="sub-radar-title-wrap">
          <div class="sub-radar-kicker">
            <span class="sub-radar-dot"></span>
            <span>Радар регулярных списаний</span>
          </div>
          <h3 class="sub-radar-title">Подписки и периодические платежи</h3>
          <p class="sub-radar-sub">Умный контроль повторяющихся трат: календарный таймер списаний и защита от скрытых утечек капитала.</p>
        </div>

        <div class="sub-radar-actions">
          <button type="button" class="btn-sub-action secondary" id="btn-sub-audit" title="Запустить детальный разбор подписок с ИИ-ментором">
            ${icon('sparkle', 14)}
            <span>Аудит подписок</span>
          </button>
          <button type="button" class="btn-sub-action primary" id="btn-sub-add-open">
            ${icon('plus', 13)}
            <span>+ Добавить</span>
          </button>
        </div>
      </div>

      ${enrichedSubs.length > 0 ? `
        <div class="sub-radar-grid">
          ${enrichedSubs.map(s => `
            <div class="sub-card ${s.meta.cardClass}" data-id="${esc(s.id)}">
              <div class="sub-card-top">
                <div class="sub-icon-box">${icon(s.meta.iconEmoji || 'layers', 16)}</div>
                <span class="sub-badge ${s.meta.badgeClass}">${s.meta.badgeText}</span>
              </div>
              <div>
                <div class="sub-card-name" title="${esc(s.name)}">${esc(s.name)}</div>
                <div class="sub-card-meta">
                  <span>${esc(s.category || 'Подписки')}</span>
                  <span class="sub-dot-sep">•</span>
                  <span>${s.meta.day}-е число</span>
                </div>
              </div>
              <div class="sub-card-foot">
                <div class="sub-amount">
                  <span class="val num">${money(s.amount)}</span>
                  <span class="period">/ мес</span>
                </div>
                <button type="button" class="sub-delete-btn" data-id="${esc(s.id)}" data-name="${esc(s.name)}" title="Удалить подписку из радара">
                  ${icon('trash', 13)}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="sub-empty-state">
          <div class="sub-empty-icon" style="display: flex; justify-content: center; margin-bottom: 8px;">${icon('radar', 30)}</div>
          <div style="font-size: 14.5px; font-weight: 700; color: #FFFFFF; margin-bottom: 4px;">Радар пока чист</div>
          <p style="font-size: 12.5px; color: var(--text-muted); max-width: 480px; margin: 0 auto 16px auto;">
            Добавьте ваши регулярные сервисы (Яндекс, Telegram, облачные хранилища, фитнес или интернет), чтобы видеть предстоящие списания и годовую стоимость.
          </p>
        </div>
      `}

      ${presetSuggestions.length > 0 ? `
        <div class="quick-pills-strip" style="margin-bottom: 14px; padding-top: 6px;">
          <span class="quick-pills-label">${icon('radar', 13)} Радар:</span>
          ${presetSuggestions.slice(0, 4).map(p => `
            <button type="button" class="quick-pill-btn sub-preset-add-btn" data-name="${esc(p.name)}" data-amt="${p.amount}" data-day="${p.day}" data-cat="${esc(p.cat)}">
              <span>${icon(p.icon, 13)}</span>
              <span>+ ${esc(p.name)} (${money(p.amount)}/мес)</span>
            </button>
          `).join('')}
        </div>
      ` : ''}

      <div class="sub-radar-summary">
        <div class="sub-summary-left">
          <span class="sub-active-chip">Сервисов: ${subs.length}</span>
          <span>В месяц: <strong class="num" style="color: #FFFFFF;">${money(totalMonthly)}</strong></span>
        </div>
        <div>
          <span>В год незаметно уходит: <strong class="num" style="color: ${totalAnnual > 25000 ? 'var(--accent-coral)' : 'var(--accent-jade)'};">~${money(totalAnnual)}</strong></span>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   SUBSCRIPTION MODAL
   ========================================================================== */
function renderSubscriptionModal() {
  return `
    <div id="sub-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${icon('calendar', 18)}</span>
            <h3 class="modal-title">Новое списание в Радар</h3>
          </div>
          <button type="button" class="btn-icon" id="btn-close-sub-modal">${icon('close', 16)}</button>
        </div>

        <div class="quick-pills-strip" style="margin-bottom: 14px;">
          <span class="quick-pills-label">Шаблоны:</span>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Яндекс Плюс" data-amt="299" data-day="25" data-cat="Подписки">
            <span>${icon('layers', 12)}</span> <span>Яндекс 299 ₽</span>
          </button>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Telegram Premium" data-amt="299" data-day="12" data-cat="Подписки">
            <span>${icon('plane', 12)}</span> <span>TG 299 ₽</span>
          </button>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Spotify" data-amt="299" data-day="1" data-cat="Подписки">
            <span>${icon('headphones', 12)}</span> <span>Spotify 299 ₽</span>
          </button>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Облако" data-amt="1490" data-day="15" data-cat="Подписки">
            <span>${icon('cloud', 12)}</span> <span>Облако 1 490 ₽</span>
          </button>
        </div>

        <form id="sub-modal-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Название сервиса или списания</label>
            <input class="form-input" id="sub-form-name" placeholder="Напр. Яндекс Плюс, Облако, Фитнес" required autocomplete="off">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div class="form-group">
              <label class="form-label">Сумма в месяц (${currencySymbols[profile.currency] || '₽'})</label>
              <div class="number-stepper-wrap">
                <input class="form-input num" id="sub-form-amount" type="number" min="1" step="any" placeholder="299" required>
                <div class="input-spin-steppers">
                  <button type="button" class="spin-step-btn" data-target="sub-form-amount" data-step="100" title="Увеличить на 100 ₽" aria-label="Увеличить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                  <button type="button" class="spin-step-btn" data-target="sub-form-amount" data-step="-100" title="Уменьшить на 100 ₽" aria-label="Уменьшить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">День списания (1-31)</label>
              <div class="number-stepper-wrap">
                <input class="form-input num" id="sub-form-day" type="number" min="1" max="31" value="1" placeholder="1" required>
                <div class="input-spin-steppers">
                  <button type="button" class="spin-step-btn" data-target="sub-form-day" data-step="1" title="Увеличить на 1 день" aria-label="Увеличить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                  <button type="button" class="spin-step-btn" data-target="sub-form-day" data-step="-1" title="Уменьшить на 1 день" aria-label="Уменьшить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Категория учета</label>
            <input class="form-input" id="sub-form-category" value="Подписки" placeholder="Подписки">
          </div>

          <div class="modal-footer" style="padding-top: 14px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn-secondary" id="btn-cancel-sub-modal">Отмена</button>
            <button type="submit" class="btn-primary" id="btn-save-sub-modal">${icon('plus', 13)} Добавить в радар</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   BANK STATEMENT IMPORT ENGINE & AI INTEGRATION ARCHITECTURE
   ========================================================================== */

// Configurable External AI Ingestion Hook
window.FINKAIF_AI_IMPORT_CONFIG = {
  apiEndpoint: localStorage.getItem('finkaif_ai_import_endpoint') || '',
  apiKey: localStorage.getItem('finkaif_ai_import_key') || '',
  modelName: localStorage.getItem('finkaif_ai_import_model') || 'custom-fin-llm',

  save(endpoint, key, model) {
    this.apiEndpoint = (endpoint || '').trim();
    this.apiKey = (key || '').trim();
    this.modelName = (model || '').trim();
    localStorage.setItem('finkaif_ai_import_endpoint', this.apiEndpoint);
    localStorage.setItem('finkaif_ai_import_key', this.apiKey);
    localStorage.setItem('finkaif_ai_import_model', this.modelName);
  },

  hasCustomAI() {
    return Boolean(this.apiEndpoint);
  }
};

let bankImportParsed = [];
let bankImportSelectedPreset = 'auto';

function autoCategorizeDescription(desc) {
  if (!desc) return 'Прочее';
  const low = String(desc).toLowerCase();

  // 1. Fishing, Tackle & Outdoor Hobbies (Evaluated FIRST so "рыболовный магазин/снасти" doesn't hit restaurants/shops)
  if (/рыбал[а-я]*|рыболов[а-я]*|снаст[а-я]*|хищник|трофей|клёв[а-я]*|spinningline|fmagazin|kaida|кайда|воблер[а-я]*|блесн[а-я]*|удочк[а-я]*|спиннинг[а-я]*|охота и рыбалка|серебряный ручей|silver stream|мир охоты|охотактив|леонардо|хобби геймс|hobby games|мосигра|моделизм|рукоделие|активный отдых/i.test(low)) {
    return 'Хобби';
  }

  // 2. Metro & Public Transit (Evaluated BEFORE groceries so "метро / мосметро" doesn't hit supermarket Metro Cash & Carry)
  if (!/(?:кэш|cash|c&c|гипер)/i.test(low) && /(?:метрополитен|мосметро|московский метрополитен|петербургский метрополитен|станци[а-я]*\s+метро|оплата проезда|тройк[а-я]*|подорожник|мцд|мцк|валидатор|автобус|трамвай|троллейбус|цппк|ржд|rzd|электричк[а-я]*|метро)/i.test(low)) {
    return 'Транспорт';
  }

  // 3. Coffee, Bakeries & Hot Drinks
  if (/кофе|кофейн[а-я]*|пекарн[а-я]*|шоколадниц[а-я]*|кофемания|coffeemania|surf coffee|дринкит|drinkit|stars coffee|старбакс|one price|булочн[а-я]*|буханка|вольчек|цех 85|skuratov|даблби|раф\b|латте|капуч[а-я]*|эспрессо|круассан|пончик|донат/i.test(low)) {
    return 'Кафе';
  }

  // 4. Restaurants, Fast Food, Dining Out & Food Delivery
  if (/додо|макдоналдс|mcdonalds|вкусно и точка|бургер кинг|burger king|kfc|ростикс|теремок|доставка еды|яндекс еда|деливери|купер еда|ресторан|бар\b|паб\b|суши|пицц[а-я]*|чайхон[а-я]*|чайхан[а-я]*|якитори[а-я]*|тануки|токио сити|бахрома|сыроварня|frank|хинкальн[а-я]*|шаурм[а-я]*|донер|бургер\b/i.test(low)) {
    return 'Рестораны';
  }

  // 5. Groceries & Supermarkets
  if (/пятерочк[а-я]*|пятёрочк[а-я]*|перекресток|перекрёсток|магнит|дикси|лента|ашан|окей|о'кей|вкусвилл|чижик|спар\b|spar\b|eurospar|верный|красное и белое|красное & белое|к&б|кб\b|бристоль|ярче|азбука вкуса|самокат|яндекс лавка|купер|сбермаркет|глобус\b|бахетле|мираторг|ермолино|мясницкий|metro cash|metro c&c|метро кэш|супермаркет|продукты|гастроном|универсам/i.test(low)) {
    return 'Продукты';
  }

  // 6. Transport, Taxis, Carshare, Fuel & Roads
  if (/такси|яндекс go|яндекс такси|яндекс\.такси|uber|ситимобил|каршеринг|делимобиль|ситидрайв|белкакар|лукойл|газпромнефть|роснефть|татнефть|тебойл|азс|бензин|дизель|аэрофлот|победа|s7|парковк[а-я]*|платные дороги|автодор|зсд|шиномонтаж|автомойка|автозапчасти|exist|autodoc/i.test(low)) {
    return 'Транспорт';
  }

  // 7. Health, Clinics, Pharmacies & Fitness
  if (/аптек[а-я]*|горздрав|ригла|планета здоровья|вита\b|апрель|еаптека|клиника|инвитро|гемотест|медси|хеликс|стоматолог|зубной|доктор|здоровье|фитнес|world class|ddx|тренажер|анализы/i.test(low)) {
    return 'Здоровье';
  }

  // 8. Shopping, Marketplaces & Apparel
  if (/вайлдберриз|wildberries|озон|ozon|яндекс маркет|мегамаркет|авито|lamoda|ламода|aliexpress|золотое яблоко|летуаль|рив гош|befree|lime|лайм|zarina|gloria jeans|спортмастер|dns|днс|м\.видео|мвидео|эльдорадо|ситилинк|re:store|restore|одежда|обувь|электроника/i.test(low)) {
    return 'Покупки';
  }

  // 9. Subscriptions & Digital Services
  if (/подписк|яндекс плюс|кинопоиск|иви|окко|premier|start|vk combo|вк музыка|spotify|apple|telegram|ютуб|youtube|chatgpt|vpn|облако|icloud|steam|psn|playstation/i.test(low)) {
    return 'Подписки';
  }

  // 10. Housing & Utilities (ЖКХ)
  if (/жкх|квартплат[а-я]*|еирц|мосэнергосбыт|мособлеирц|ростелеком|дом\.ru|домру|мтс|билайн|мегафон|т-мобайл|tele2|t2|интернет|аренда жилья|петрович|леруа|лемана про|домофон|тсж|ук\b/i.test(low)) {
    return 'Жилье';
  }

  // 11. Entertainment & Leisure
  if (/кинотеатр|театр|концерт|парк|аттракцион|аквапарк|боулинг|бильярд|билет|квест|развлечения/i.test(low)) {
    return 'Развлечения';
  }

  // 12. Income & Investment Categories
  if (/зарплат[а-я]*|аванс|оклад|расчет|преми[яи]|гонорар|зачисление зарплаты|вознаграждение/i.test(low)) return 'Зарплата';
  if (/дивиденд[а-я]*|купон[а-я]*|брокер|вклад|процент по вкладу|выплата процентов/i.test(low)) return 'Инвестиции';
  if (/перевод от|пополнение счета|сбп/i.test(low)) return 'Поступления';

  return 'Прочее';
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseBankAmount(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const clean = String(str).replace(/[\s\u00A0₽$€₸]/g, '').replace(',', '.');
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

function parseBankDate(raw) {
  if (!raw) return toDateIso(getMskDate());
  const s = String(raw).trim().split(/\s+/)[0];
  const dotM = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotM) {
    let year = parseInt(dotM[3], 10);
    if (year < 100) year += 2000;
    const month = dotM[2].padStart(2, '0');
    const day = dotM[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const isoM = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoM) {
    return `${isoM[1]}-${isoM[2].padStart(2, '0')}-${isoM[3].padStart(2, '0')}`;
  }
  const slashM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashM) {
    let year = parseInt(slashM[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${slashM[2].padStart(2, '0')}-${slashM[1].padStart(2, '0')}`;
  }
  return toDateIso(getMskDate());
}

function parseStatementBuiltin(content, fileName = '', preset = 'auto') {
  const text = String(content || '').trim();
  if (!text) return [];

  // Check JSON format
  if (text.startsWith('[') || (text.startsWith('{') && text.includes('"transactions"'))) {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
      return list.map(item => ({
        occurred_on: parseBankDate(item.date || item.occurred_on),
        amount: Math.abs(parseBankAmount(item.amount)),
        type: item.type === 'income' ? 'income' : (parseBankAmount(item.amount) > 0 && item.type !== 'expense' ? 'income' : 'expense'),
        category: item.category || autoCategorizeDescription(item.description),
        description: item.description || item.category || 'Операция из выписки',
        selected: true
      })).filter(x => x.amount > 0);
    } catch (_) {}
  }

  // Check 1C / Client-Bank TXT format (ВТБ, Сбер, Альфа 1С экспорт)
  if (text.includes('1CClientBankExchange') || text.includes('СекцияДокумент')) {
    const docs = text.split(/СекцияДокумент\s*=/i);
    const results = [];
    for (let i = 1; i < docs.length; i++) {
      const doc = docs[i];
      const dateM = doc.match(/Дата(?:Документа)?\s*=\s*([^\r\n]+)/i);
      const amtM = doc.match(/Сумма\s*=\s*([^\r\n]+)/i);
      const purpM = doc.match(/НазначениеПлатежа\s*=\s*([^\r\n]+)/i);
      const payerM = doc.match(/Плательщик\s*=\s*([^\r\n]+)/i);
      const recipM = doc.match(/Получатель\s*=\s*([^\r\n]+)/i);

      const amt = amtM ? parseBankAmount(amtM[1]) : 0;
      if (amt > 0) {
        const desc = (purpM ? purpM[1] : (recipM ? recipM[1] : (payerM ? payerM[1] : 'Банковский платеж'))).trim();
        const isIncome = doc.includes('Платежное требование') || /зачисление|возврат|поступление|оплата от покупателя/i.test(desc);
        results.push({
          occurred_on: dateM ? parseBankDate(dateM[1]) : toDateIso(getMskDate()),
          amount: amt,
          type: isIncome ? 'income' : 'expense',
          category: autoCategorizeDescription(desc),
          description: desc,
          selected: true
        });
      }
    }
    if (results.length > 0) return results;
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const sample = lines.slice(0, 5).join('\n');
  const semiCount = (sample.match(/;/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  let delimiter = ';';
  if (tabCount > semiCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semiCount) delimiter = ',';

  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = splitCsvLine(lines[i], delimiter).map(c => c.toLowerCase().replace(/['"]/g, '').trim());
    if (cols.some(c => c.includes('дата') || c.includes('date') || c.includes('сумма') || c.includes('amount'))) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }

  if (headerIdx === -1) {
    headerIdx = 0;
    headers = splitCsvLine(lines[0], delimiter).map(c => c.toLowerCase().replace(/['"]/g, '').trim());
  }

  let dateIdx = headers.findIndex(c => c.includes('дата операции') || c.includes('дата платежа') || c.includes('дата') || c.includes('date'));
  let amtIdx = headers.findIndex(c => c.includes('сумма операции') || c.includes('сумма платежа') || c.includes('сумма') || c.includes('amount'));
  let catIdx = headers.findIndex(c => c.includes('категория') || c.includes('category'));
  let descIdx = headers.findIndex(c => c.includes('описание') || c.includes('назначение') || c.includes('контрагент') || c.includes('merchant') || c.includes('получатель'));
  let statusIdx = headers.findIndex(c => c.includes('статус') || c.includes('status'));

  if (dateIdx === -1) dateIdx = 0;
  if (amtIdx === -1) amtIdx = headers.findIndex((_, idx) => idx !== dateIdx);
  if (descIdx === -1) descIdx = headers.findIndex((_, idx) => idx !== dateIdx && idx !== amtIdx && idx !== catIdx);

  const results = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i], delimiter);
    if (row.length <= 1) continue;

    if (statusIdx !== -1 && row[statusIdx]) {
      const st = row[statusIdx].toLowerCase();
      if (st.includes('отказ') || st.includes('failed') || st.includes('ошибка') || st.includes('отклонен')) {
        continue;
      }
    }

    const rawAmt = row[amtIdx] || '0';
    const numAmt = parseBankAmount(rawAmt);
    if (!numAmt || Math.abs(numAmt) < 0.01) continue;

    const rawDate = row[dateIdx] || '';
    const date = parseBankDate(rawDate);
    const rawDesc = descIdx !== -1 && row[descIdx] ? row[descIdx].replace(/^["']|["']$/g, '').trim() : '';
    const rawCat = catIdx !== -1 && row[catIdx] ? row[catIdx].replace(/^["']|["']$/g, '').trim() : '';

    let type = 'expense';
    if (numAmt > 0) {
      if (String(rawAmt).includes('+') || (!String(rawAmt).includes('-') && (rawCat.includes('Пополнения') || rawCat.includes('Зарплата') || /зарплат|перевод от|пополнение/i.test(rawDesc)))) {
        type = 'income';
      }
    } else {
      type = 'expense';
    }

    if (numAmt > 0 && (rawCat.toLowerCase().includes('доход') || /зарплат|аванс|дивиденд|преми|пополнение/i.test(rawDesc))) {
      type = 'income';
    }

    const absAmt = Math.abs(numAmt);
    const finalDesc = rawDesc || '';
    let finalCat = autoCategorizeDescription(finalDesc);
    if (finalCat === 'Прочее' && rawCat && rawCat.length > 2 && rawCat !== 'Другое' && rawCat !== 'Прочее') {
      finalCat = rawCat;
    }
    // High-priority corrections for specific merchant misclassifications by banks
    if (/рыбал[а-я]*|рыболов[а-я]*|снаст[а-я]*|хищник|трофей|spinningline|fmagazin|kaida|кайда|воблер|блесн|удочк|спиннинг/i.test(finalDesc)) {
      finalCat = 'Хобби';
    } else if (!/(?:кэш|cash|c&c|гипер)/i.test(finalDesc) && /(?:метрополитен|мосметро|московский метрополитен|петербургский метрополитен|станци[а-я]*\s+метро|тройк|подорожник|метро)/i.test(finalDesc)) {
      finalCat = 'Транспорт';
    }

    results.push({
      occurred_on: date,
      amount: absAmt,
      type,
      category: finalCat,
      description: finalDesc,
      selected: true
    });
  }

  return results;
}

function calculateStatementPeriod(transactions) {
  if (!transactions || transactions.length === 0) return { from: '', to: '', label: 'Период не определен' };
  const dates = transactions.map(t => t.occurred_on || t.date).filter(Boolean).sort();
  if (dates.length === 0) return { from: '', to: '', label: 'Период не определен' };
  const minD = dates[0];
  const maxD = dates[dates.length - 1];
  const formatRu = (iso) => {
    const p = String(iso).split('-');
    if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
    return iso;
  };
  return {
    from: minD,
    to: maxD,
    label: `${formatRu(minD)} — ${formatRu(maxD)}`
  };
}

async function parseBankStatement(fileContent, fileName = '', bankPreset = 'auto', pdfBase64 = null) {
  // 1. Try server-side dedicated Gemini AI endpoint
  try {
    const reqBody = {
      filename: fileName,
      preset: bankPreset
    };
    if (pdfBase64) {
      reqBody.pdf_base64 = pdfBase64;
    } else {
      reqBody.content = fileContent;
    }

    const aiRes = await api('ai/parse-statement', {
      method: 'POST',
      body: JSON.stringify(reqBody)
    });

    if (aiRes && aiRes.success && Array.isArray(aiRes.transactions) && aiRes.transactions.length > 0) {
      const txs = aiRes.transactions.map(item => {
        const rawType = String(item.type || '').toLowerCase();
        const isTransfer = rawType === 'transfer';
        const isIncome = rawType === 'income';
        return {
          occurred_on: parseBankDate(item.date || item.occurred_on),
          amount: Math.abs(parseBankAmount(item.amount)),
          type: isIncome ? 'income' : 'expense',
          tx_kind: isTransfer ? 'transfer' : (isIncome ? 'income' : 'expense'),
          is_self_transfer: item.is_self_transfer === true,
          category: (() => {
            const rawDesc = String(item.description || '').trim();
            let cat = String(item.category || '').replace(/^[\p{Emoji}\u200d\s]+/u, '').trim();
            if (cat.includes('Хобби')) cat = 'Хобби';
            if (cat.includes('Транспорт')) cat = 'Транспорт';
            if (cat.includes('Продукты') && /метро|мосметро/i.test(rawDesc) && !/кэш|cash|c&c/i.test(rawDesc)) cat = 'Транспорт';
            if (!cat || cat === 'Прочее' || cat === 'Другое') {
              cat = isTransfer ? 'Переводы' : autoCategorizeDescription(rawDesc);
            }
            if (/рыбал[а-я]*|рыболов[а-я]*|снаст[а-я]*|хищник|трофей|spinningline|fmagazin|kaida|кайда|воблер|блесн|удочк|спиннинг/i.test(rawDesc)) {
              cat = 'Хобби';
            }
            return cat;
          })(),
          description: item.description || '',
          selected: true // all operations selected by default
        };
      }).filter(x => x.amount > 0);

      const period = aiRes.period && aiRes.period.label ? aiRes.period : calculateStatementPeriod(txs);

      return {
        engine: 'ai',
        engineLabel: aiRes.engine || 'FinKaif AI (Gemini Flash)',
        bank_name: aiRes.bank_name || (bankPreset !== 'auto' ? bankPreset : 'Банк РФ'),
        period,
        transactions: txs
      };
    }
  } catch (err) {
    console.warn('Server AI parse notice:', err.message);
  }

  // 2. Builtin Fallback Smart Engine (for text / CSV / 1C / Excel)
  const items = fileContent ? parseStatementBuiltin(fileContent, fileName, bankPreset) : [];
  const period = calculateStatementPeriod(items);
  let detectedBank = 'Банк РФ';
  if (bankPreset === 'tinkoff' || /тинькофф|т-банк|tinkoff/i.test(fileName + ' ' + (fileContent || '').slice(0, 1000))) detectedBank = 'Т-Банк';
  else if (bankPreset === 'sber' || /сбер|sber/i.test(fileName + ' ' + (fileContent || '').slice(0, 1000))) detectedBank = 'СберБанк';
  else if (bankPreset === 'alfa' || /альфа|alfa/i.test(fileName + ' ' + (fileContent || '').slice(0, 1000))) detectedBank = 'Альфа-Банк';
  else if (bankPreset === 'vtb' || /втб|vtb|1cclientbank/i.test(fileName + ' ' + (fileContent || '').slice(0, 1000))) detectedBank = 'ВТБ / 1C';

  return {
    engine: 'smart',
    engineLabel: 'Smart Built-in Engine',
    bank_name: detectedBank,
    period,
    transactions: items
  };
}

const GENERIC_TX_PLACEHOLDERS = [
  'банковская операция', 'банковский платеж', 'банковский платёж',
  'операция из выписки', 'операция по карте', 'платеж', 'платёж', 'платежи',
  'перевод', 'переводы', 'перевод физлицу', 'перевод клиенту', 'перевод частному лицу',
  'перевод по сбп', 'сбп', 'перевод между счетами', 'перевод между своими счетами',
  'свой счёт', 'свой счет', 'списание', 'списания', 'пополнение', 'пополнения',
  'прочие расходы', 'прочее', 'оплата', 'оплаты', 'покупка', 'покупки',
  'другое', 'не указано', 'без описания', 'карта', 'card', 'payment', 'retail', 'purchase'
];

const GENERIC_CATEGORIES = [
  'прочее', 'другое', 'не определено', 'без категории', 'неизвестно', 'разное', 'прочие расходы', 'прочие доходы'
];

function isTxClarificationNeeded(tx) {
  if (!tx || !tx.selected) return false;
  // 1. Category check
  if (!tx.category || typeof tx.category !== 'string') return true;
  const c = tx.category.trim().toLowerCase();
  if (c.length === 0 || GENERIC_CATEGORIES.includes(c)) return true;

  // 2. Description check
  if (!tx.description || typeof tx.description !== 'string') return true;
  const d = tx.description.trim().toLowerCase();
  if (d.length < 3) return true;
  if (d === c) return true;
  if (GENERIC_TX_PLACEHOLDERS.includes(d)) return true;
  if (/^списание|^покупка|^оплата\b|^retail\b|^pos\b|^card2card\b|^операция по карте/i.test(d)) return true;

  return false;
}

function isTxDescriptionNeeded(tx) {
  return isTxClarificationNeeded(tx);
}

function openRequiredClarificationModal(txsNeedingClarify, onComplete, allStatementTxs = null) {
  const existing = document.getElementById('import-desc-required-modal');
  if (existing) existing.remove();

  const allList = (allStatementTxs && allStatementTxs.length > 0)
    ? allStatementTxs
    : (bankImportParsed && bankImportParsed.length > 0 ? bankImportParsed : txsNeedingClarify);

  // Active tab state: if there are items needing attention, open attention tab, else all
  let activeTab = (txsNeedingClarify && txsNeedingClarify.length > 0) ? 'attention' : 'all';

  const backdrop = document.createElement('div');
  backdrop.id = 'import-desc-required-modal';
  backdrop.className = 'desc-modal-backdrop';

  // Dynamic tags mapping per category
  function getQuickTagsForCat(catName) {
    const c = String(catName || '').toLowerCase();
    if (/метро|транспорт/i.test(c)) return ['Поездка на метро', 'Карта Тройка', 'Билет на поезд', 'Проездной'];
    if (/такси/i.test(c)) return ['Яндекс Такси', 'Поездка по городу', 'Каршеринг'];
    if (/рыбал|снаст|хобби/i.test(c)) return ['Снасти для рыбалки', 'Спиннинг и приманки', 'Хобби и туризм', 'Товары для охоты'];
    if (/продукт/i.test(c)) return ['Продукты домой', 'Супермаркет', 'Овощи и фрукты'];
    if (/кафе/i.test(c)) return ['Кофе и круассан', 'Завтрак в кофейне', 'Бизнес-ланч'];
    if (/ресторан/i.test(c)) return ['Ужин с друзьями', 'Доставка еды', 'Праздничный обед'];
    if (/здоров|аптек/i.test(c)) return ['Аптека / Лекарства', 'Прием врача', 'Витамины'];
    if (/спорт/i.test(c)) return ['Абонемент в фитнес', 'Спортивная форма', 'Бассейн'];
    if (/подписк/i.test(c)) return ['Яндекс Плюс', 'Telegram Premium', 'Облако', 'Онлайн-кинотеатр'];
    if (/жкх|жил/i.test(c)) return ['Коммунальные платежи', 'Оплата интернета', 'Налоги ФНС', 'Аренда жилья'];
    if (/покупк/i.test(c)) return ['Одежда и обувь', 'Маркетплейс (Ozon/WB)', 'Электроника'];
    if (/зарплат/i.test(c)) return ['Аванс', 'Основная зарплата', 'Премия'];
    if (/фриланс/i.test(c)) return ['Оплата за проект', 'Гонорар'];
    return ['Поездка на метро', 'Снасти для рыбалки', 'Продукты домой', 'Обед в ресторане', 'Подарок', 'Возврат долга'];
  }

  function isItemValid(tx) {
    const c = (tx.category || '').trim().toLowerCase();
    const isCatOk = c.length > 0 && !GENERIC_CATEGORIES.includes(c);
    const d = (tx.description || '').trim().toLowerCase();
    const isDescOk = d.length >= 3 && d !== c && !GENERIC_TX_PLACEHOLDERS.includes(d);
    return isCatOk && isDescOk;
  }

  function renderModalContent() {
    const attentionList = (txsNeedingClarify && txsNeedingClarify.length > 0)
      ? txsNeedingClarify
      : allList.filter(t => isTxClarificationNeeded(t));
    const displayedTxs = activeTab === 'attention'
      ? attentionList
      : allList;
    const attentionCount = attentionList.length;

    backdrop.innerHTML = `
      <div class="desc-modal-card" style="max-width: 720px;">
        <!-- Swiss Neo-Bank Header -->
        <div class="clarify-modal-header-neo">
          <div class="clarify-head-left">
            <div class="clarify-head-icon">
              ${icon('overview', 18)}
            </div>
            <div>
              <div class="clarify-head-title">Классификация выписки</div>
              <div class="clarify-head-sub">Синхронизация категорий и проверка реестра операций</div>
            </div>
          </div>
          <div class="clarify-head-right">
            <span class="clarify-status-pill ${attentionCount === 0 ? 'jade' : 'amber'}" id="clarify-top-status">
              ${attentionCount === 0 ? icon('check', 11) + ' Все готовы' : icon('clock', 11) + ' ' + attentionCount + ' ' + pluralizeOps(attentionCount) + ' требуют решения'}
            </span>
            <button type="button" class="btn-icon" id="btn-close-desc-modal" title="Закрыть">
              ${icon('close', 16)}
            </button>
          </div>
        </div>

        <!-- Swiss Navigation Tabs -->
        <div class="clarify-tabs-bar">
          <button type="button" class="clarify-tab-btn ${activeTab === 'attention' ? 'active' : ''}" id="tab-btn-attention">
            <span>⚠️ Требуют внимания</span>
            <span class="clarify-tab-count" id="count-clarify-attention">${attentionCount}</span>
          </button>
          <button type="button" class="clarify-tab-btn ${activeTab === 'all' ? 'active' : ''}" id="tab-btn-all">
            <span>📑 Все операции файла</span>
            <span class="clarify-tab-count">${allList.length}</span>
          </button>
        </div>

        <!-- List of Operations -->
        <div class="desc-modal-body" id="desc-modal-items-list">
          ${displayedTxs.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 12px;">🎉</div>
              <div style="font-size: 15px; font-weight: 700; color: #FFFFFF;">Все операции успешно классифицированы!</div>
              <div style="font-size: 12.5px; margin-top: 6px;">Перейдите на вкладку «Все операции файла», чтобы при необходимости отредактировать любую запись.</div>
            </div>
          ` : displayedTxs.map((tx) => {
            const isInc = tx.type === 'income';
            const hasOrigNote = tx.description && tx.description.trim().length > 0;
            const valid = isItemValid(tx);
            const listIdx = allList.indexOf(tx);
            const currentCat = tx.category || '';
            const quickTags = getQuickTagsForCat(currentCat);
            const chipsToRender = isInc ? SYSTEM_INCOME_CATEGORIES : SYSTEM_EXPENSE_CATEGORIES;

            return `
              <div class="desc-modal-item ${valid ? 'completed' : ''}" data-list-idx="${listIdx}">
                <div class="desc-item-header">
                  <div class="desc-item-left">
                    <span class="desc-item-date num">${tx.occurred_on}</span>
                    <span class="clarify-status-pill ${valid ? 'jade' : 'amber'}" id="clarify-pill-${listIdx}">
                      ${valid ? icon('check', 11) + ' Готово' : icon('clock', 11) + ' Требует уточнения'}
                    </span>
                    ${tx.is_duplicate ? `<span class="badge-duplicate" title="Такая операция уже есть в реестре">Повтор</span>` : ''}
                  </div>
                  <div class="desc-item-amount num ${isInc ? 'inc' : 'exp'}">
                    ${isInc ? '+' : '−'}${money(tx.amount)}
                  </div>
                </div>

                ${hasOrigNote ? `<div class="desc-item-orig">Исходная выписка: <strong>${esc(tx.description)}</strong></div>` : ''}

                <!-- Category Selection (Luxury Chip Grid - No native select) -->
                <div class="clarify-field-group">
                  <div class="clarify-field-label">
                    <span>Категория:</span>
                    <strong style="color: var(--accent-jade);" id="clarify-cat-lbl-${listIdx}">${esc(currentCat || 'Не выбрана')}</strong>
                  </div>
                  <div class="clarify-cat-chips" data-list-idx="${listIdx}">
                    ${chipsToRender.map(qc => `
                      <button type="button" class="clarify-cat-chip ${currentCat === qc ? 'selected' : ''}" data-list-idx="${listIdx}" data-cat="${esc(qc)}">
                        ${getCategoryIcon(qc, isInc ? 'income' : 'expense', 12)}
                        <span>${esc(qc)}</span>
                      </button>
                    `).join('')}
                    <button type="button" class="btn-custom-cat-toggle" data-list-idx="${listIdx}">
                      <span>➕ Своя...</span>
                    </button>
                  </div>
                  <div class="custom-cat-inline" id="custom-cat-inline-${listIdx}">
                    <input type="text" class="custom-cat-input" id="custom-cat-input-${listIdx}" placeholder="Введите новую категорию..." maxlength="30">
                    <button type="button" class="btn-custom-cat-add" data-list-idx="${listIdx}">ОК</button>
                  </div>
                </div>

                <!-- Description Field with Context Quick Tags -->
                <div class="clarify-field-group" style="margin-top: 4px;">
                  <div class="clarify-field-label">
                    <span>Понятное назначение / Описание:</span>
                    <span style="font-size: 10.5px; color: var(--text-muted);">минимум 3 символа</span>
                  </div>
                  <input type="text" class="form-input desc-require-input" data-list-idx="${listIdx}" placeholder="Например: Поездка на метро, Снасти для рыбалки, Обед..." value="${esc(tx.description || '')}" autocomplete="off">
                  <div class="desc-quick-tags" data-list-idx="${listIdx}" style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
                    ${quickTags.map(tag => `
                      <button type="button" class="desc-tag-pill clarify-quick-tag" data-list-idx="${listIdx}" data-text="${esc(tag)}">
                        ${icon("tag", 11)} <span>${esc(tag)}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Modal Footer with Progress & Confirm Actions -->
        <div class="desc-modal-footer">
          <div class="desc-modal-counter">
            <span class="status-dot ${attentionCount === 0 ? 'jade' : 'amber'}"></span>
            <span>Требуют решения: <strong id="desc-unresolved-count">${attentionCount}</strong> из ${allList.length}</span>
          </div>
          <div class="desc-modal-footer-actions">
            <button type="button" class="btn-secondary" id="btn-cancel-desc-modal">Назад к выписке</button>
            <button type="button" class="btn-primary" id="btn-submit-required-descs">
              ${icon('check', 14)}
              <span>Сохранить классификацию (${allList.length})</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind all events
    bindModalEvents();
  }

  function bindModalEvents() {
    // Tab switching
    const btnTabAtt = backdrop.querySelector('#tab-btn-attention');
    const btnTabAll = backdrop.querySelector('#tab-btn-all');
    if (btnTabAtt) {
      btnTabAtt.onclick = () => {
        activeTab = 'attention';
        renderModalContent();
      };
    }
    if (btnTabAll) {
      btnTabAll.onclick = () => {
        activeTab = 'all';
        renderModalContent();
      };
    }

    // Category chips
    backdrop.querySelectorAll('.clarify-cat-chip').forEach(chip => {
      chip.onclick = (e) => {
        e.preventDefault();
        const listIdx = parseInt(chip.getAttribute('data-list-idx'), 10);
        const catName = chip.getAttribute('data-cat');
        if (allList[listIdx]) {
          allList[listIdx].category = catName;
          updateCardRow(listIdx);
          updateHeaderStatus();
        }
      };
    });

    // Custom Category toggle & input
    backdrop.querySelectorAll('.btn-custom-cat-toggle').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const listIdx = parseInt(btn.getAttribute('data-list-idx'), 10);
        const box = backdrop.querySelector(`#custom-cat-inline-${listIdx}`);
        if (box) {
          box.classList.toggle('open');
          if (box.classList.contains('open')) {
            const inp = box.querySelector('.custom-cat-input');
            if (inp) inp.focus();
          }
        }
      };
    });

    backdrop.querySelectorAll('.btn-custom-cat-add').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const listIdx = parseInt(btn.getAttribute('data-list-idx'), 10);
        const inp = backdrop.querySelector(`#custom-cat-input-${listIdx}`);
        if (inp && inp.value.trim() && allList[listIdx]) {
          const val = inp.value.trim();
          addCustomCategory(val);
          allList[listIdx].category = val;
          updateCardRow(listIdx);
          updateHeaderStatus();
          const box = backdrop.querySelector(`#custom-cat-inline-${listIdx}`);
          if (box) box.classList.remove('open');
        }
      };
    });

    backdrop.querySelectorAll('.custom-cat-input').forEach(inp => {
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const listIdx = parseInt(inp.id.replace('custom-cat-input-', ''), 10);
          const addBtn = backdrop.querySelector(`.btn-custom-cat-add[data-list-idx="${listIdx}"]`);
          if (addBtn) addBtn.click();
        }
      };
    });

    // Description inputs
    backdrop.querySelectorAll('.desc-require-input').forEach(inp => {
      inp.oninput = () => {
        const listIdx = parseInt(inp.getAttribute('data-list-idx'), 10);
        if (allList[listIdx]) {
          allList[listIdx].description = inp.value.trim();
          updateCardRow(listIdx);
          updateHeaderStatus();
        }
      };
    });

    // Quick tags
    backdrop.querySelectorAll('.clarify-quick-tag').forEach(tag => {
      tag.onclick = (e) => {
        e.preventDefault();
        const listIdx = parseInt(tag.getAttribute('data-list-idx'), 10);
        const text = tag.getAttribute('data-text');
        if (allList[listIdx]) {
          allList[listIdx].description = text;
          const inp = backdrop.querySelector(`.desc-require-input[data-list-idx="${listIdx}"]`);
          if (inp) inp.value = text;
          updateCardRow(listIdx);
          updateHeaderStatus();
        }
      };
    });

    // Close & Cancel
    const closeBtn = backdrop.querySelector('#btn-close-desc-modal');
    if (closeBtn) {
      closeBtn.onclick = () => {
        backdrop.remove();
        if (typeof window.renderBankPreviewRows === 'function') window.renderBankPreviewRows();
      };
    }
    const cancelBtn = backdrop.querySelector('#btn-cancel-desc-modal');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        backdrop.remove();
        if (typeof window.renderBankPreviewRows === 'function') window.renderBankPreviewRows();
      };
    }

    // Submit
    const btnSubmit = backdrop.querySelector('#btn-submit-required-descs');
    if (btnSubmit) {
      btnSubmit.onclick = () => {
        const attentionRemaining = allList.filter(t => isTxClarificationNeeded(t)).length;
        if (attentionRemaining > 0 && activeTab !== 'attention') {
          showToast(`Осталось ${attentionRemaining} ${pluralizeOps(attentionRemaining)}, требующих решения`, 'warning');
          activeTab = 'attention';
          renderModalContent();
          return;
        }

        backdrop.remove();
        if (typeof window.renderBankPreviewRows === 'function') {
          window.renderBankPreviewRows();
        }
        showToast('Все операции выписки успешно сохранены!', 'success');
        if (typeof onComplete === 'function') onComplete(allList);
      };
    }
  }

  function updateCardRow(listIdx) {
    const tx = allList[listIdx];
    if (!tx) return;
    const card = backdrop.querySelector(`.desc-modal-item[data-list-idx="${listIdx}"]`);
    if (!card) return;

    const valid = isItemValid(tx);
    card.classList.toggle('completed', valid);

    const pill = backdrop.querySelector(`#clarify-pill-${listIdx}`);
    if (pill) {
      pill.className = `clarify-status-pill ${valid ? 'jade' : 'amber'}`;
      pill.innerHTML = valid ? `${icon('check', 11)} Готово` : `${icon('clock', 11)} Требует уточнения`;
    }

    const catLbl = backdrop.querySelector(`#clarify-cat-lbl-${listIdx}`);
    if (catLbl) {
      catLbl.innerText = tx.category || 'Не выбрана';
    }

    card.querySelectorAll('.clarify-cat-chip').forEach(ch => {
      ch.classList.toggle('selected', ch.getAttribute('data-cat') === tx.category);
    });
  }

  function updateHeaderStatus() {
    const attentionCount = allList.filter(t => isTxClarificationNeeded(t)).length;
    const topStatus = backdrop.querySelector('#clarify-top-status');
    if (topStatus) {
      topStatus.className = `clarify-status-pill ${attentionCount === 0 ? 'jade' : 'amber'}`;
      topStatus.innerHTML = attentionCount === 0
        ? `${icon('check', 11)} Все готовы`
        : `${icon('clock', 11)} ${attentionCount} требуют решения`;
    }

    const counterAtt = backdrop.querySelector('#count-clarify-attention');
    if (counterAtt) counterAtt.innerText = String(attentionCount);

    const bottomCounter = backdrop.querySelector('#desc-unresolved-count');
    if (bottomCounter) bottomCounter.innerText = String(attentionCount);

    const dot = backdrop.querySelector('.desc-modal-counter .status-dot');
    if (dot) dot.className = `status-dot ${attentionCount === 0 ? 'jade' : 'amber'}`;
  }

  document.body.appendChild(backdrop);
  renderModalContent();
}

const openRequiredDescModal = openRequiredClarificationModal;

function openBankImportModal() {
  const m = document.getElementById('import-bank-modal');
  if (m) {
    m.style.display = 'flex';
  }
}

function closeBankImportModal() {
  const m = document.getElementById('import-bank-modal');
  if (m) {
    m.style.display = 'none';
  }
}

function renderImportBankModal() {
  return `
    <div id="import-bank-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-card import-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="modal-header-icon-badge">
              ${icon('upload', 18)}
            </div>
            <div>
              <h3 class="modal-title">Импорт банковской выписки</h3>
              <p class="modal-subtitle">Загрузите файл выписки (.PDF, .XLSX, .CSV, .TXT, .JSON) для автоматического переноса операций</p>
            </div>
          </div>
          <button type="button" class="btn-icon" id="btn-close-import-modal">${icon('close', 16)}</button>
        </div>

        <!-- Source Mode Switcher: Bank vs Custom App Archive -->
        <div class="import-source-switcher">
          <button type="button" class="import-source-btn active" data-imode="bank">
            ${icon('building', 14)}
            <span>Выписка банка</span>
          </button>
          <button type="button" class="import-source-btn" data-imode="archive">
            ${icon('fileText', 14)}
            <span>Своя таблица / Архив (Excel, TXT, CoinKeeper, 1С)</span>
          </button>
        </div>

        <!-- Bank Preset Selector Bar with Active AI Badge -->
        <div class="import-presets-bar">
          <span class="import-presets-lbl">Банк:</span>
          <div class="import-bank-pills">
            <button type="button" class="import-bank-pill active" data-bank="auto">Все банки (Авто)</button>
            <button type="button" class="import-bank-pill" data-bank="tinkoff">Т-Банк (Тинькофф)</button>
            <button type="button" class="import-bank-pill" data-bank="sber">СберБанк</button>
            <button type="button" class="import-bank-pill" data-bank="alfa">Альфа-Банк</button>
            <button type="button" class="import-bank-pill" data-bank="vtb">ВТБ / 1C</button>
          </div>
          <div class="import-ai-status-pill" title="Искусственный интеллект FinKaif обучен и готов к распознаванию PDF, Excel, периодов, дат и категорий">
            <span class="ai-pulse-dot"></span>
            <span class="ai-pill-text">FinKaif AI активен</span>
          </div>
        </div>

        <!-- Upload Drop Zone -->
        <div id="import-dropzone" class="import-drop-zone">
          <input type="file" id="bank-file-input" accept=".csv,.txt,.tsv,.json,.pdf,.xlsx,.xls" style="display: none;">
          <div class="drop-zone-icon">
            ${icon('fileText', 32)}
          </div>
          <div class="drop-zone-title" id="drop-zone-title">Перетащите файл выписки или архива сюда</div>
          <div class="drop-zone-subtitle">или <span class="drop-browse-link">выберите на устройстве</span></div>
          <div class="drop-zone-badges">
            <span class="drop-badge">PDF выписки банков</span>
            <span class="drop-badge">Excel (.XLSX / .XLS)</span>
            <span class="drop-badge">Текстовые файлы (.TXT / .CSV)</span>
            <span class="drop-badge">Архивы (CoinKeeper / 1C / Заметки)</span>
          </div>
          <div id="import-scanning-overlay" class="import-scanning-overlay" style="display: none;">
            <div class="scanning-spinner"></div>
            <div class="scanning-title">FinKaif AI анализирует выписку...</div>
            <div class="scanning-sub">Распознаем файл (PDF / Excel / CSV), период, даты и категории</div>
          </div>
        </div>

        <!-- Preview & Action Section (Hidden initially) -->
        <div id="import-preview-section" class="import-preview-section" style="display: none;">
          <!-- Statement Period & Bank Banner -->
          <div class="import-period-banner" id="import-period-banner">
            <div class="import-period-main">
              <span class="import-period-icon">${icon('calendar', 18)}</span>
              <div class="import-period-details">
                <span class="import-period-title">Период выписки:</span>
                <span class="import-period-dates" id="import-period-text">—</span>
              </div>
            </div>
            <div class="import-bank-tag" id="import-bank-tag">
              <span class="bank-tag-dot"></span>
              <span id="import-bank-name">Банк РФ</span>
            </div>
          </div>

          <!-- Stats Strip -->
          <div class="import-stats-strip">
            <div class="import-stat-item">
              <span class="import-stat-lbl">Всего операций</span>
              <span class="import-stat-val num" id="import-stat-count">0</span>
            </div>
            <div class="import-stat-item">
              <span class="import-stat-lbl">Поступления</span>
              <span class="import-stat-val num inc" id="import-stat-inc">+0 ₽</span>
            </div>
            <div class="import-stat-item">
              <span class="import-stat-lbl">Списания</span>
              <span class="import-stat-val num exp" id="import-stat-exp">-0 ₽</span>
            </div>
            <div class="import-stat-item">
              <span class="import-stat-lbl">Переводы</span>
              <span class="import-stat-val num" id="import-stat-transfers" style="color: rgba(160,185,255,0.85);">0 шт.</span>
            </div>
            <div class="import-stat-item engine-item">
              <span class="import-stat-lbl">Движок</span>
              <span class="import-stat-val" id="import-stat-engine">FinKaif AI</span>
            </div>
          </div>

          <!-- Preview Table Controls -->
          <div class="import-table-controls" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <label class="import-select-all-label">
              <input type="checkbox" id="import-select-all-cb" checked>
              <span id="import-selected-count-label">Выбрано: 0 операций</span>
            </label>
            <button type="button" class="btn-bulk-sec" id="btn-open-clarify-full" style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; border-radius: 12px; padding: 5px 12px; cursor: pointer;">
              ${icon('edit', 12)}
              <span>Классификация категорий</span>
            </button>
            <span class="import-table-hint">Снимите галочки с операций, которые не нужно загружать</span>
          </div>

          <!-- Table Container -->
          <div class="import-table-wrap">
            <table class="import-table">
              <thead>
                <tr>
                  <th style="width: 36px;"></th>
                  <th style="width: 100px;">Дата</th>
                  <th style="width: 140px;">Категория</th>
                  <th>Описание / Назначение</th>
                  <th style="width: 120px; text-align: right;">Сумма</th>
                </tr>
              </thead>
              <tbody id="import-table-tbody">
                <!-- Dynamic rows -->
              </tbody>
            </table>
          </div>

          <!-- Footer Action Buttons -->
          <div class="import-footer-actions">
            <button type="button" class="btn-secondary" id="btn-import-change-file">
              Выбрать другой файл
            </button>
            <button type="button" class="btn-primary" id="btn-import-submit">
              ${icon('check', 16)}
              <span id="btn-import-submit-label">Импортировать операции</span>
            </button>
          </div>
        </div>
      </div>
    </div>
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
  const totalCapital = inc - exp;
  const savedInGoals = (data.goals || []).reduce((s, g) => s + Number(g.saved_amount || 0), 0);
  const freeBalance = totalCapital - savedInGoals;
  const balance = freeBalance; // Primary focus is spendable liquid cash

  // Calculate Runway (Financial Safety Cushion)
  const nowMs = getMskDate().getTime();
  const thirtyDaysAgo = new Date(nowMs - 30 * 86400000);
  const last30dExp = (data.transactions || [])
    .filter(t => t.type === 'expense' && new Date(getTxIso(t)) >= thirtyDaysAgo)
    .reduce((s, t) => s + Number(t.amount), 0);

  const monthlyBurn = last30dExp > 0 ? last30dExp : (exp > 0 ? exp : 45000);
  const runwayCapital = Math.max(0, totalCapital);
  const runwayMonths = monthlyBurn > 0 ? (runwayCapital / monthlyBurn) : 0;

  let runwayMonthsFormatted = '';
  if (totalCapital <= 0) {
    runwayMonthsFormatted = '0 мес.';
  } else if (runwayMonths >= 10) {
    runwayMonthsFormatted = `${Math.round(runwayMonths)} мес.`;
  } else if (runwayMonths >= 1) {
    runwayMonthsFormatted = `${runwayMonths.toFixed(1)} мес.`;
  } else {
    const days = Math.max(1, Math.round(runwayMonths * 30));
    runwayMonthsFormatted = `${days} дн.`;
  }

  let runwayTierClass = 'runway-secure';
  let runwayStatus = 'Крепость';
  let runwayDot = 'jade';
  let runwayDesc = `Автономность: капитала хватит на ${runwayMonthsFormatted} комфортной жизни при текущем темпе трат (${money(monthlyBurn)}/мес)`;

  if (totalCapital <= 0) {
    runwayTierClass = 'runway-danger';
    runwayStatus = 'Дефицит';
    runwayDot = 'coral';
    runwayDesc = 'Дефицит капитала: требуется оптимизация расходов';
  } else if (runwayMonths < 1) {
    runwayTierClass = 'runway-danger';
    runwayStatus = 'Критично';
    runwayDot = 'coral';
    runwayDesc = `Запас менее 1 месяца (${runwayMonthsFormatted}). Рекомендуется сократить некритичные траты`;
  } else if (runwayMonths < 3) {
    runwayTierClass = 'runway-warning';
    runwayStatus = 'Базовый';
    runwayDot = 'amber';
    runwayDesc = `Запас на ${runwayMonthsFormatted}. Рекомендуется сформировать подушку от 3 до 6 месяцев`;
  } else if (runwayMonths < 6) {
    runwayTierClass = 'runway-good';
    runwayStatus = 'Стабильно';
    runwayDot = 'jade';
    runwayDesc = `Уверенный запас на ${runwayMonthsFormatted}. До золотого стандарта (6 мес.) осталось немного`;
  } else {
    runwayTierClass = 'runway-secure';
    runwayStatus = 'Крепость';
    runwayDot = 'jade';
    runwayDesc = `Превосходная финансовая крепость: запас на ${runwayMonthsFormatted} без дополнительных доходов!`;
  }

  const runwayPercent = Math.min(100, Math.max(4, (runwayMonths / 6) * 100));

  const savingsRate = inc > 0 ? Math.max(0, Math.round(((inc - exp) / inc) * 100)) : 0;

  // Build continuous intraday capital timeline (Synchronized with Moscow Time)
  const now = getMskDate();
  const svgW = 760;
  const svgH = 120;
  const padX = 28;
  const padTop = 18;
  const padBottom = 16;
  const plotW = svgW - 2 * padX;
  const plotH = svgH - padTop - padBottom;

  const dayBuckets = [];

  if (period === 'custom' && customRange.from && customRange.to) {
    const fromD = new Date(customRange.from);
    const toD = new Date(customRange.to);
    const diffTime = Math.max(0, toD.getTime() - fromD.getTime());
    const diffDays = Math.min(60, Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1));
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate() + i);
      const iso = toDateIso(d);
      const isToday = (iso === toDateIso(now));
      const dayTxs = (data.transactions || []).filter(t => getTxIso(t) === iso);
      const dayExp = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const dayInc = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const wkShort = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      const capWk = wkShort.charAt(0).toUpperCase() + wkShort.slice(1);
      dayBuckets.push({
        date: iso,
        dayDate: d,
        dayNum: d.getDate(),
        wkShort: capWk,
        isToday,
        isFuture: iso > toDateIso(now),
        dayLabel: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        dayDisplay: `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dayExp,
        inc: dayInc,
        txs: dayTxs
      });
    }
  } else if (period === 'year') {
    // 12 calendar month buckets
    for (let m = 11; m >= 0; m--) {
      const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = target.getFullYear();
      const monthNum = String(target.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${monthNum}`;

      const mTxs = (data.transactions || []).filter(t => getTxIso(t).startsWith(prefix));
      const mExp = mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const mInc = mTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);

      dayBuckets.push({
        date: prefix,
        dayDate: target,
        dayNum: target.getMonth() + 1,
        dayLabel: target.toLocaleDateString('ru-RU', { month: 'short' }),
        dayDisplay: target.toLocaleDateString('ru-RU', { month: 'short' }),
        fullDate: target.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        exp: mExp,
        inc: mInc,
        txs: mTxs
      });
    }
  } else if (period === '7d') {
    // Current Calendar Week: Monday to Sunday (Пн — Вс) in Moscow Time
    const mskNow = getMskDate();
    const todayIso = toDateIso(mskNow);
    const dow = mskNow.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const dayFromMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate() - dayFromMonday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = toDateIso(d);
      const isToday = (iso === todayIso);
      const isFuture = (iso > todayIso);

      const dayTxs = (data.transactions || [])
        .filter(t => getTxIso(t) === iso)
        .sort((a, b) => getTxMinutes(a) - getTxMinutes(b));
      const dayExp = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const dayInc = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);

      const wkShort = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      const capWk = wkShort.charAt(0).toUpperCase() + wkShort.slice(1);

      dayBuckets.push({
        date: iso,
        dayDate: d,
        dayNum: d.getDate(),
        wkShort: capWk,
        isToday,
        isFuture,
        dayLabel: capWk,
        dayDisplay: `${capWk} ${d.getDate()}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dayExp,
        inc: dayInc,
        txs: dayTxs
      });
    }
  } else {
    // 30 days
    const numDays = 30;
    const todayIso = toDateIso(now);
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = toDateIso(d);
      const isToday = (iso === todayIso);
      const dayTxs = (data.transactions || [])
        .filter(t => getTxIso(t) === iso)
        .sort((a, b) => getTxMinutes(a) - getTxMinutes(b));
      const dayExp = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const dayInc = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);

      const wkShort = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      const capWk = wkShort.charAt(0).toUpperCase() + wkShort.slice(1);

      dayBuckets.push({
        date: iso,
        dayDate: d,
        dayNum: d.getDate(),
        wkShort: capWk,
        isToday,
        isFuture: false,
        dayLabel: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        dayDisplay: `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dayExp,
        inc: dayInc,
        txs: dayTxs
      });
    }
  }

  // True Cumulative Capital Trajectory:
  // Start from opening balance prior to current window
  const windowNet = dayBuckets.reduce((s, p) => s + (p.inc - p.exp), 0);
  let runningBal = balance - windowNet;

  const pointsWithBal = dayBuckets.map((bucket, idx) => {
    const openBal = runningBal;
    runningBal += (bucket.inc - bucket.exp);
    const closeBal = runningBal;
    bucket.openBalance = openBal;
    bucket.closeBalance = closeBal;
    return {
      ...bucket,
      openBal,
      closeBal,
      balance: closeBal
    };
  });

  const periodInc = dayBuckets.reduce((s, p) => s + p.inc, 0);
  const periodExp = dayBuckets.reduce((s, p) => s + p.exp, 0);
  const periodFootnote = period === '7d' ? 'За текущую неделю (Пн–Вс)' : (period === '30d' ? 'За последние 30 дней' : 'За последние 12 месяцев');

  const minVal = Math.min(...pointsWithBal.map(p => p.balance));
  const maxVal = Math.max(...pointsWithBal.map(p => p.balance));
  const balDiff = maxVal - minVal;
  const netDelta = balance - (balance - windowNet);

  const isDeficit = balance < 0;
  const accentColor = isDeficit ? '#FB7185' : '#2DD4BF';
  const glowColor = isDeficit ? 'rgba(251, 113, 133, 0.45)' : 'rgba(45, 212, 191, 0.45)';

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
    if (dayBuckets[idx]) dayBuckets[idx].xMid = x;
    p.xMid = x;
    return { x, y, idx, ...p };
  });

  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const curvePath = pointsToSmoothPath(points);
  const areaPath = `${curvePath} L ${lastPt.x},${svgH - padBottom} L ${firstPt.x},${svgH - padBottom} Z`;

  window.__homePoints = points;
  window.__homeDayBuckets = dayBuckets;
  window.__homeCurrentBalance = balance;
  window.__homeSvgH = svgH;
  window.__homeSvgW = svgW;
  window.__homePadX = padX;
  window.__homePlotW = plotW;
  window.__homeAccentColor = accentColor;
  window.__homeIsDeficit = isDeficit;
  window.__homePeriod = period;

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
    const isToday = !!pt.isToday;
    const isFuture = !!pt.isFuture;
    const isLatest = (!isToday && idx === points.length - 1);
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

    let stateClass = '';
    if (isToday) stateClass = 'is-today is-latest';
    else if (isFuture) stateClass = 'is-future';
    else if (isLatest) stateClass = 'is-latest';

    return `
      <div class="home-axis-item ${stateClass}" data-idx="${idx}" style="left: ${leftPct}%;">
        <div class="axis-tick-pip"></div>
        <div class="axis-date-badge">
          ${badgeContent}
        </div>
      </div>
    `;
  }).join('');

  // HTML-based live terminal beacon (positioned on today's point!)
  const beaconPt = (period === '7d' && points.some(p => p.isToday))
    ? (points.find(p => p.isToday) || lastPt)
    : lastPt;

  const terminalBeaconHtml = `
    <div id="home-terminal-beacon" class="home-terminal-beacon" style="left: ${((beaconPt.x / svgW) * 100).toFixed(2)}%; top: ${((beaconPt.y / svgH) * 100).toFixed(2)}%;">
      <div class="terminal-pulse-ring" style="border-color: ${accentColor}; background: ${isDeficit ? 'rgba(251, 113, 133, 0.15)' : 'rgba(45, 212, 191, 0.15)'};"></div>
      <div class="terminal-core-dot" style="background: ${accentColor};"></div>
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

  const mskHour = getMskDate().getHours();
  let timeGreeting = 'Добрый день';
  let timeOfDayClass = 'day';
  let timeOfDayIcon = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  `;

  if (mskHour >= 5 && mskHour < 12) {
    timeGreeting = 'Доброе утро';
    timeOfDayClass = 'morning';
    timeOfDayIcon = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      </svg>
    `;
  } else if (mskHour >= 12 && mskHour < 18) {
    timeGreeting = 'Добрый день';
    timeOfDayClass = 'day';
  } else if (mskHour >= 18 && mskHour < 23) {
    timeGreeting = 'Добрый вечер';
    timeOfDayClass = 'evening';
    timeOfDayIcon = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 18a5 5 0 0 0-10 0"/>
        <line x1="12" y1="9" x2="12" y2="2"/>
        <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
        <line x1="1" y1="18" x2="3" y2="18"/>
        <line x1="21" y1="18" x2="23" y2="18"/>
        <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
        <line x1="23" y1="22" x2="1" y2="22"/>
      </svg>
    `;
  } else {
    timeGreeting = 'Доброй ночи';
    timeOfDayClass = 'night';
    timeOfDayIcon = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;
  }

  return `
    <div class="view-header">
      <div>
        <div class="view-greeting-pill">
          <span class="greeting-icon-box ${timeOfDayClass}">
            ${timeOfDayIcon}
          </span>
          <span class="greeting-text">
            <span class="greeting-prefix">${timeGreeting},</span>
            <span class="greeting-name">${esc(userName)}</span>
          </span>
          <span class="greeting-live-dot" title="Терминал активен"></span>
        </div>
        <h1 class="view-title">Финансовый баланс</h1>
        <p class="view-subtitle">Сводный обзор капитала, ежедневные потоки и операционные записи.</p>
      </div>
    </div>

    <!-- Main Capital Hero Card -->
    <div class="hero-balance-card ${isDeficit ? 'deficit' : ''}">
      <div class="hero-topline">
        <div class="hero-label-group">
          <span class="hero-label" id="hero-balance-lbl">Свободно на расходы</span>
          <span class="hero-label-sub" title="Свободный остаток средств за вычетом отложенного в финансовые цели">за вычетом целей</span>
        </div>
        <div class="period-tabs">
          <button class="period-tab ${period === '7d' ? 'active' : ''}" data-period="7d">Неделя</button>
          <button class="period-tab ${period === '30d' ? 'active' : ''}" data-period="30d">30 дней</button>
          <button class="period-tab ${period === 'year' ? 'active' : ''}" data-period="year">Год</button>
          <button class="period-tab ${period === 'custom' ? 'active' : ''}" id="btn-toggle-custom-period" title="Выбрать свой период дат">
            ${icon('calendar', 12)}
            <span>${period === 'custom' && customRange.from ? `${customRange.from.slice(5)}...` : 'Период'}</span>
          </button>
        </div>
      </div>

      <!-- Custom Date Range Popover Panel -->
      <div class="custom-range-picker-bar" id="home-custom-range-bar" style="display: ${customRangeOpen ? 'flex' : 'none'};">
        <div class="custom-range-inputs">
          <label>C <input type="date" id="custom-range-from" value="${customRange.from || toDateIso(new Date(now.getFullYear(), now.getMonth(), 1))}"></label>
          <label>По <input type="date" id="custom-range-to" value="${customRange.to || toDateIso(now)}"></label>
        </div>
        <div class="custom-range-buttons">
          <button type="button" class="btn-primary-xs" id="btn-apply-home-range">Применить</button>
          <button type="button" class="btn-ghost-xs" id="btn-close-home-range">✕</button>
        </div>
      </div>

      <div class="hero-balance-row">
        <div class="hero-balance-figure num" id="hero-balance-val" data-base="${money(freeBalance)}">${money(freeBalance)}</div>
        ${badgeHtml}
      </div>

      <!-- Capital & Goals Sub-Row Strip with Runway Pill -->
      <div class="hero-capital-substrip">
        <div class="capital-sub-item" title="Средства, замороженные в целях накопления">
          <span class="capital-sub-icon">${icon("target", 13)}</span>
          <span class="capital-sub-lbl">В целях:</span>
          <span class="capital-sub-val num">${money(savedInGoals)}</span>
        </div>
        <div class="capital-sub-bullet">•</div>
        <div class="capital-sub-item" title="Общий капитал со всеми накоплениями">
          <span class="capital-sub-icon">${icon("briefcase", 13)}</span>
          <span class="capital-sub-lbl">Общий капитал:</span>
          <span class="capital-sub-val num ${totalCapital >= 0 ? 'inc' : 'exp'}">${money(totalCapital)}</span>
        </div>
        <div class="capital-sub-bullet">•</div>
        <div class="capital-sub-item runway-pill ${runwayTierClass}" id="hero-runway-pill" title="${esc(runwayDesc)}">
          <span class="capital-sub-icon"><span class="status-dot ${runwayDot}"></span></span>
          <span class="capital-sub-lbl">Подушка:</span>
          <span class="capital-sub-val num ${runwayTierClass}">${runwayMonthsFormatted}</span>
        </div>
      </div>

      <!-- Runway Safety Gauge Strip -->
      <div class="runway-gauge-strip" title="${esc(runwayDesc)}">
        <div class="runway-gauge-header">
          <div class="runway-gauge-title">
            <span class="runway-gauge-icon">${icon("shield", 14)}</span>
            <span class="runway-gauge-label">Финансовая подушка (Runway):</span>
            <span class="runway-gauge-months num ${runwayTierClass}">${runwayMonthsFormatted}</span>
          </div>
          <div class="runway-gauge-badge ${runwayTierClass}">
            <span class="runway-badge-dot"></span>
            <span>${runwayStatus}</span>
          </div>
        </div>
        <div class="runway-track-wrap">
          <div class="runway-track">
            <div class="runway-fill ${runwayTierClass}" style="width: ${runwayPercent}%;"></div>
            <div class="runway-target-pip" style="left: 50%;" title="Минимальная норма: 3 месяца"></div>
            <div class="runway-target-pip" style="left: 100%;" title="Золотой стандарт: 6 месяцев"></div>
          </div>
          <div class="runway-markers">
            <span class="runway-marker">0 мес</span>
            <span class="runway-marker center">3 мес (комфорт)</span>
            <span class="runway-marker right">6+ мес (крепость)</span>
          </div>
        </div>
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
          <span class="hero-meta-val num">${money(points[0].balance)}</span>
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

      <!-- Interactive Day Breakdown Dock (Responsive Mobile & Desktop Sheet) -->
      <div id="home-day-breakdown" class="home-day-breakdown"></div>
    </div>

    <!-- Stats Row (2 Cards) -->
    <div class="stats-strip">
      <div class="stat-card">
        <div class="stat-card-head">
          <span class="stat-card-title">Поступления за период</span>
          <div class="stat-icon inc">${icon('trendUp', 16)}</div>
        </div>
        <div class="stat-amount inc num" id="stat-amount-inc">+${money(periodInc)}</div>
        <div class="stat-footnote">${periodFootnote}</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-head">
          <span class="stat-card-title">Расходы за период</span>
          <div class="stat-icon exp">${icon('trendDown', 16)}</div>
        </div>
        <div class="stat-amount exp num" id="stat-amount-exp">−${money(periodExp)}</div>
        <div class="stat-footnote">${periodFootnote}</div>
      </div>
    </div>

    <!-- Smart Quick-Input Express Card -->
    <div class="quick-express-card" id="quick-express-card">
      <div class="quick-express-top">
        <div class="quick-input-wrap">
          <div class="quick-ai-badge">
            <span class="quick-input-icon">${icon('sparkle', 16)}</span>
          </div>
          <input id="quick-express-input" placeholder="Экспресс-запись: «кофе 250», «получил 50к», «зарплата 80к вчера»..." autocomplete="off" aria-label="Быстрая запись расхода или дохода">
          <div class="quick-input-right-actions">
            <button type="button" class="btn-clear-quick" id="btn-clear-quick" style="display: none;" title="Очистить" aria-label="Очистить поле ввода">${icon('close', 12)}</button>
            <button type="button" class="btn-voice-express" id="btn-voice-express" title="Голосовой ввод: нажмите и говорите" aria-label="Голосовой ввод расхода или дохода">
              ${icon('mic', 15)}
            </button>
          </div>
        </div>
        <button class="btn-submit-express" id="btn-submit-express" title="Записать операцию (Enter)">
          ${icon('plus', 14)}
          <span>Записать</span>
          <kbd class="express-kbd-hint">↵</kbd>
        </button>
      </div>

      <!-- Live parse preview bar -->
      <div id="quick-parse-preview" class="quick-parse-preview" style="display: none;"></div>

      <!-- Express Smart Guide Explanation Banner -->
      <div class="express-guide-banner">
        <div class="express-guide-header">
          <div class="express-ai-chip">
            <span class="express-ai-sparkle">✦</span>
            <span>ИИ-ввод</span>
          </div>
          <div class="express-guide-desc">
            Пишите в свободной форме или надиктуйте через <span class="express-mic-tag">${icon('mic', 12)} микрофон</span> — система сама определит сумму, категорию и дату
          </div>
        </div>
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

    <!-- Subscription Radar & Recurring Bills -->
    ${renderSubscriptionRadar()}

    <!-- Recent Transactions Stream -->
    <div class="section-head">
      <h2 class="section-title">Последние операции</h2>
      <a class="section-link" data-tab="transactions">
        <span>Смотреть все (${data.transactions.length})</span>
        <span>→</span>
      </a>
    </div>

    <div class="tx-list">
      ${recentTransactions.length > 0 ? recentTransactions.map(t => renderTxCard(t, { allowSelect: false })).join('') : `
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
  const mskNow = getMskDate();
  const now = mskNow;

  // Filter transactions for chosen period
  let periodTxs = [...data.transactions];
  let daysCount = 30;

  const dow = mskNow.getDay();
  const dayFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate() - dayFromMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const mondayIso = toDateIso(monday);
  const sundayIso = toDateIso(sunday);

  if (analyticsPeriod === 'custom' && customRange.from && customRange.to) {
    periodTxs = data.transactions.filter(t => {
      const iso = getTxIso(t);
      return iso >= customRange.from && iso <= customRange.to;
    });
    const fromD = new Date(customRange.from);
    const toD = new Date(customRange.to);
    daysCount = Math.max(1, Math.ceil(Math.abs(toD - fromD) / (1000 * 60 * 60 * 24)) + 1);
  } else if (analyticsPeriod === '7d') {
    daysCount = 7;
    periodTxs = data.transactions.filter(t => {
      const iso = getTxIso(t);
      return iso >= mondayIso && iso <= sundayIso;
    });
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

  // Current balance across all recorded transactions
  const totalInc = data.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = data.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const currentBalance = totalInc - totalExp;

  // Calendar month dates & expenses
  const curMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
  const curMonthExp = data.transactions
    .filter(t => t.type === 'expense' && getTxIso(t) >= curMonthStart)
    .reduce((s, t) => s + Number(t.amount), 0);
  const curMonthInc = data.transactions
    .filter(t => t.type === 'income' && getTxIso(t) >= curMonthStart)
    .reduce((s, t) => s + Number(t.amount), 0);

  // Month-End Projection Calculation
  const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(0, daysInCurMonth - now.getDate());
  const dailyIncomeRate = Math.round(pInc / (daysCount || 1));

  // Expected remaining expenses till end of month based on daily velocity
  const expectedRemainingExp = Math.round(dailyVelocity * daysRemainingInMonth);
  // Conservative projected balance at month end: current balance minus expected remaining spend
  const projectedBalance = currentBalance - expectedRemainingExp;
  const projectedMonthExp = curMonthExp + expectedRemainingExp;

  // Spending Pace Assessment (Burn Rate Status)
  let burnStatus = 'safe';
  let burnText = 'Комфортный темп';

  if (dailyVelocity === 0) {
    burnStatus = 'safe';
    burnText = 'Расходов нет (0 ₽/день)';
  } else if (dailyIncomeRate > 0) {
    // Primary benchmark: spend velocity relative to incoming daily flow
    const incRatio = dailyVelocity / dailyIncomeRate;
    const incPct = Math.round(incRatio * 100);
    if (incRatio <= 0.45) {
      burnStatus = 'safe';
      burnText = `Экономный темп (${incPct}% дохода)`;
    } else if (incRatio <= 0.75) {
      burnStatus = 'safe';
      burnText = `Комфортный (${incPct}% дохода)`;
    } else if (incRatio <= 1.0) {
      burnStatus = 'warn';
      burnText = `Плотный (${incPct}% дохода)`;
    } else {
      burnStatus = 'alert';
      burnText = `Превышает доход (+${incPct - 100}%)`;
    }
  } else if (currentBalance > 0) {
    // Runway-based evaluation when no income recorded in period
    const runwayDays = Math.round(currentBalance / (dailyVelocity || 1));
    if (runwayDays >= 90) {
      burnStatus = 'safe';
      burnText = `Запас на ${Math.round(runwayDays / 30)} мес.`;
    } else if (runwayDays >= 30) {
      burnStatus = 'warn';
      burnText = `Запас на ${runwayDays} дн.`;
    } else {
      burnStatus = 'alert';
      burnText = `Запас всего ${runwayDays} дн.`;
    }
  } else {
    burnStatus = 'alert';
    burnText = 'Дефицит средств';
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
  const prevMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthSameDay = toDateIso(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));

  const prevMonthExp = data.transactions
    .filter(t => t.type === 'expense' && getTxIso(t) >= prevMonthStart && getTxIso(t) <= prevMonthSameDay)
    .reduce((s, t) => s + Number(t.amount), 0);

  let momExpDeltaPct = 0;
  if (prevMonthExp > 0) {
    momExpDeltaPct = Math.round(((curMonthExp - prevMonthExp) / prevMonthExp) * 100);
  }

  // Build smart adaptive dual cashflow timeline
  const allTxs = data.transactions || [];
  const sortedTxDates = allTxs
    .map(t => getTxIso(t))
    .filter(Boolean)
    .sort();

  const minTxIso = sortedTxDates.length > 0 ? sortedTxDates[0] : null;
  const cashflowPoints = [];
  let cfSubtitle = 'Сравнение поступлений и списаний по дням с интерактивным курсором';

  if (analyticsPeriod === '7d') {
    cfSubtitle = 'Сравнение поступлений и списаний по дням за текущую неделю (Пн–Вс)';
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = toDateIso(d);
      const wkShort = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      const capWk = wkShort.charAt(0).toUpperCase() + wkShort.slice(1);
      const dExp = allTxs.filter(t => t.type === 'expense' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
      const dInc = allTxs.filter(t => t.type === 'income' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
      cashflowPoints.push({
        date: iso,
        dayLabel: `${capWk} ${d.getDate()}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }),
        exp: dExp,
        inc: dInc,
        txCount: allTxs.filter(t => getTxIso(t) === iso).length
      });
    }
  } else if (analyticsPeriod === 'month') {
    const curMonthDays = now.getDate();
    cfSubtitle = `Сравнение поступлений и списаний по дням за ${now.toLocaleDateString('ru-RU', { month: 'long' })}`;
    const count = Math.max(7, curMonthDays);
    for (let i = 1; i <= count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      const iso = toDateIso(d);
      const dExp = allTxs.filter(t => t.type === 'expense' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
      const dInc = allTxs.filter(t => t.type === 'income' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
      cashflowPoints.push({
        date: iso,
        dayLabel: `${i} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dExp,
        inc: dInc,
        txCount: allTxs.filter(t => getTxIso(t) === iso).length
      });
    }
  } else if (analyticsPeriod === '30d') {
    cfSubtitle = 'Сравнение поступлений и списаний по дням за последние 30 дней';
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = toDateIso(d);
      const dExp = allTxs.filter(t => t.type === 'expense' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
      const dInc = allTxs.filter(t => t.type === 'income' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
      cashflowPoints.push({
        date: iso,
        dayLabel: `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
        fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        exp: dExp,
        inc: dInc,
        txCount: allTxs.filter(t => getTxIso(t) === iso).length
      });
    }
  } else {
    // analyticsPeriod === 'all' (Все время)
    if (!minTxIso) {
      cfSubtitle = 'Денежный поток (нет сохранённых операций)';
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        cashflowPoints.push({
          date: toDateIso(d),
          dayLabel: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
          fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
          exp: 0,
          inc: 0,
          txCount: 0
        });
      }
    } else {
      const minDate = new Date(minTxIso);
      const daysSpan = Math.max(1, Math.round((now.getTime() - minDate.getTime()) / 86400000));

      if (daysSpan <= 35) {
        const count = Math.max(7, daysSpan + 1);
        cfSubtitle = 'Сравнение поступлений и списаний по дням за период активности';
        for (let i = count - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const iso = toDateIso(d);
          const dExp = allTxs.filter(t => t.type === 'expense' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
          const dInc = allTxs.filter(t => t.type === 'income' && getTxIso(t) === iso).reduce((s, t) => s + Number(t.amount), 0);
          cashflowPoints.push({
            date: iso,
            dayLabel: `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`,
            fullDate: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
            exp: dExp,
            inc: dInc,
            txCount: allTxs.filter(t => getTxIso(t) === iso).length
          });
        }
      } else if (daysSpan <= 90) {
        cfSubtitle = 'Сравнение поступлений и списаний по неделям';
        const numWeeks = Math.min(10, Math.ceil(daysSpan / 7));
        for (let w = numWeeks - 1; w >= 0; w--) {
          const wEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
          const wStart = new Date(wEnd.getFullYear(), wEnd.getMonth(), wEnd.getDate() - 6);
          const isoStart = toDateIso(wStart);
          const isoEnd = toDateIso(wEnd);
          const wExp = allTxs.filter(t => t.type === 'expense' && getTxIso(t) >= isoStart && getTxIso(t) <= isoEnd).reduce((s, t) => s + Number(t.amount), 0);
          const wInc = allTxs.filter(t => t.type === 'income' && getTxIso(t) >= isoStart && getTxIso(t) <= isoEnd).reduce((s, t) => s + Number(t.amount), 0);
          cashflowPoints.push({
            date: `${isoStart}..${isoEnd}`,
            dayLabel: `${wStart.getDate()}–${wEnd.getDate()} ${wEnd.toLocaleDateString('ru-RU', { month: 'short' })}`,
            fullDate: `Неделя: ${wStart.getDate()} ${wStart.toLocaleDateString('ru-RU', { month: 'short' })} – ${wEnd.getDate()} ${wEnd.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}`,
            exp: wExp,
            inc: wInc,
            txCount: allTxs.filter(t => getTxIso(t) >= isoStart && getTxIso(t) <= isoEnd).length
          });
        }
      } else {
        cfSubtitle = 'Сравнение поступлений и списаний по месяцам';
        const monthsDiff = (now.getFullYear() - minDate.getFullYear()) * 12 + (now.getMonth() - minDate.getMonth());
        const numMonths = Math.min(12, Math.max(3, monthsDiff + 1));
        for (let m = numMonths - 1; m >= 0; m--) {
          const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const prefix = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
          const dExp = allTxs.filter(t => t.type === 'expense' && getTxIso(t).startsWith(prefix)).reduce((s, t) => s + Number(t.amount), 0);
          const dInc = allTxs.filter(t => t.type === 'income' && getTxIso(t).startsWith(prefix)).reduce((s, t) => s + Number(t.amount), 0);
          cashflowPoints.push({
            date: prefix,
            dayLabel: target.toLocaleDateString('ru-RU', { month: 'short' }),
            fullDate: target.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
            exp: dExp,
            inc: dInc,
            txCount: allTxs.filter(t => getTxIso(t).startsWith(prefix)).length
          });
        }
      }
    }
  }

  const cfTotalInc = cashflowPoints.reduce((s, p) => s + p.inc, 0);
  const cfTotalExp = cashflowPoints.reduce((s, p) => s + p.exp, 0);
  const cfNet = cfTotalInc - cfTotalExp;
  const cfMax = Math.max(1000, ...cashflowPoints.map(p => Math.max(p.exp, p.inc)));

  const cfW = 760;
  const cfH = 210;
  const baselineY = 172;
  const plotH = 138;
  const padX = 32;
  const usableW = cfW - 2 * padX;
  const N = cashflowPoints.length;
  const slotW = usableW / (N || 1);
  const barW = Math.min(14, Math.max(4, Math.floor((slotW - 6) / 2)));

  const cfCoords = cashflowPoints.map((p, idx) => {
    const slotCenter = padX + (idx + 0.5) * slotW;
    const x = Math.round(padX + (idx / (cashflowPoints.length - 1 || 1)) * usableW);
    const yInc = Math.round(baselineY - (p.inc / cfMax) * plotH);
    const yExp = Math.round(baselineY - (p.exp / cfMax) * plotH);
    const hInc = p.inc > 0 ? Math.max(3, Math.round((p.inc / cfMax) * plotH)) : 0;
    const hExp = p.exp > 0 ? Math.max(3, Math.round((p.exp / cfMax) * plotH)) : 0;
    return {
      x,
      yInc,
      yExp,
      hInc,
      hExp,
      slotCenter,
      slotX: padX + idx * slotW,
      slotW,
      barW,
      idx,
      ...p
    };
  });

  window.__cfPoints = cfCoords;
  window.__cfMode = cashflowChartMode;

  const incPath = pointsToSmoothPath(cfCoords.map(p => ({ x: p.x, y: p.yInc, balance: p.inc })));
  const incArea = cfCoords.length > 0
    ? `${incPath} L ${cfCoords[cfCoords.length - 1].x},${baselineY} L ${cfCoords[0].x},${baselineY} Z`
    : '';

  const expPath = pointsToSmoothPath(cfCoords.map(p => ({ x: p.x, y: p.yExp, balance: p.exp })));
  const expArea = cfCoords.length > 0
    ? `${expPath} L ${cfCoords[cfCoords.length - 1].x},${baselineY} L ${cfCoords[0].x},${baselineY} Z`
    : '';

  // Filtered operations for drilldown: Top 7 largest expenses of the period
  const drilldownTxs = activeAnalyticsCat
    ? [...periodTxs].filter(t => t.category === activeAnalyticsCat).sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 7)
    : [...periodTxs].filter(t => t.type === 'expense').sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 7);

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Аналитический центр</h1>
        <p class="view-subtitle">Глубокая структура расходов, динамика денежного потока и финансовые проекции.</p>
      </div>

      <div class="analytics-period-bar">
        <button class="analytics-period-btn ${analyticsPeriod === '7d' ? 'active' : ''}" data-aperiod="7d">Неделя</button>
        <button class="analytics-period-btn ${analyticsPeriod === '30d' ? 'active' : ''}" data-aperiod="30d">30 дней</button>
        <button class="analytics-period-btn ${analyticsPeriod === 'all' ? 'active' : ''}" data-aperiod="all">Все время</button>
        <button class="analytics-period-btn ${analyticsPeriod === 'custom' ? 'active' : ''}" data-aperiod="custom" id="btn-analytics-custom-toggle" title="Выбрать произвольный период">
          ${icon('calendar', 12)}
          <span>${analyticsPeriod === 'custom' && customRange.from ? `${customRange.from.slice(5)}...` : 'Период'}</span>
        </button>
      </div>

      <!-- Custom Date Range Popover Panel in Analytics -->
      <div class="custom-range-picker-bar" id="analytics-custom-range-bar" style="display: ${customRangeOpen && analyticsPeriod === 'custom' ? 'flex' : 'none'};">
        <div class="custom-range-inputs">
          <label>C <input type="date" id="analytics-custom-range-from" value="${customRange.from || toDateIso(new Date(now.getFullYear(), now.getMonth(), 1))}"></label>
          <label>По <input type="date" id="analytics-custom-range-to" value="${customRange.to || toDateIso(now)}"></label>
        </div>
        <div class="custom-range-buttons">
          <button type="button" class="btn-primary-xs" id="btn-apply-analytics-range">Применить</button>
          <button type="button" class="btn-ghost-xs" id="btn-close-analytics-range">✕</button>
        </div>
      </div>
    </div>

    <!-- 4 Key Analytics Metrics -->
    <!-- 4 Key Analytics Metrics -->
    <div class="analytics-metrics-strip">
      <div class="analytics-metric-card" id="card-net-cashflow">
        <div class="metric-topline">
          <div class="metric-label-wrap">
            <span class="metric-label">Чистый денежный поток</span>
            <button type="button" class="metric-info-btn" data-tooltip-id="tt-net-cashflow" aria-label="Подробнее о денежном потоке">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
          </div>
          <span class="metric-icon ${pNet >= 0 ? 'inc' : 'exp'}">${icon(pNet >= 0 ? 'trendUp' : 'trendDown', 15)}</span>
        </div>
        <div class="metric-value num ${pNet >= 0 ? 'inc' : 'exp'}">${pNet >= 0 ? '+' : '−'}${money(Math.abs(pNet))}</div>
        <div class="metric-footnote">
          ${pSavingsRate > 0 ? `<span class="badge-tag jade">${pSavingsRate}% сохранено</span>` : 'Баланс периода'}
        </div>

        <div class="metric-popover" id="tt-net-cashflow">
          <div class="metric-popover-header">
            <span class="popover-title">${icon("trendUp", 14)} Чистый денежный поток</span>
            <button type="button" class="popover-close" data-close="tt-net-cashflow">✕</button>
          </div>
          <p class="popover-desc">Разница между всеми поступлениями и списаниями за выбранный период (Доходы − Расходы).</p>
          <div class="popover-breakdown">
            <div class="p-row"><span>Поступления:</span> <strong class="inc">+${money(pInc)}</strong></div>
            <div class="p-row"><span>Списания:</span> <strong class="exp">−${money(pExp)}</strong></div>
            <div class="p-row highlight"><span>Чистый итог:</span> <strong class="${pNet >= 0 ? 'inc' : 'exp'}">${pNet >= 0 ? '+' : '−'}${money(Math.abs(pNet))}</strong></div>
            ${pSavingsRate > 0 ? `<div class="p-row"><span>Норма сбережений:</span> <strong class="jade-text">${pSavingsRate}% сохранено в капитал</strong></div>` : ''}
          </div>
          <div class="popover-hint">
            Показывает, сколько свободных денег оседает в вашем капитале после всех трат периода.
          </div>
        </div>
      </div>

      <div class="analytics-metric-card" id="card-burn-rate">
        <div class="metric-topline">
          <div class="metric-label-wrap">
            <span class="metric-label">Темп трат (Burn Rate)</span>
            <button type="button" class="metric-info-btn" data-tooltip-id="tt-burn-rate" aria-label="Подробнее о темпе трат">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
          </div>
          <span class="metric-icon exp">${icon('flame', 15)}</span>
        </div>
        <div class="metric-value num exp">${money(dailyVelocity)} <span class="metric-unit">/ день</span></div>
        <div class="metric-footnote">
          <span class="badge-tag ${burnStatus === 'safe' ? 'jade' : (burnStatus === 'warn' ? 'amber' : 'coral')}">${burnText}</span>
        </div>

        <div class="metric-popover" id="tt-burn-rate">
          <div class="metric-popover-header">
            <span class="popover-title">${icon("activity", 14)} Темп трат (Burn Rate)</span>
            <button type="button" class="popover-close" data-close="tt-burn-rate">✕</button>
          </div>
          <p class="popover-desc">Среднесуточный расход за выбранный период (${daysCount} дн.). Показывает скорость выбытия денег и помогает вовремя заметить перерасход.</p>
          <div class="popover-breakdown">
            <div class="p-row"><span>Всего расходов:</span> <strong>${money(pExp)} (${daysCount} дн.)</strong></div>
            <div class="p-row"><span>Скорость списаний:</span> <strong class="exp">${money(dailyVelocity)} / день</strong></div>
            ${dailyIncomeRate > 0 ? `
              <div class="p-row"><span>Средний доход:</span> <strong class="inc">${money(dailyIncomeRate)} / день</strong></div>
              <div class="p-row highlight"><span>Доля в доходах:</span> <strong class="${burnStatus === 'safe' ? 'jade-text' : (burnStatus === 'warn' ? 'amber-text' : 'coral-text')}">${Math.round((dailyVelocity / dailyIncomeRate) * 100)}% (${burnStatus === 'safe' ? 'отличный показатель' : (burnStatus === 'warn' ? 'умеренная нагрузка' : 'перерасход')})</strong></div>
            ` : ''}
          </div>
          <div class="popover-hint">
            Показывает скорость сгорания денег в сутки. При текущем темпе ${dailyIncomeRate > 0 ? `вы сохраняете ${Math.max(0, 100 - Math.round((dailyVelocity / dailyIncomeRate) * 100))}% всех поступлений` : 'контролируйте запас капитала'}.
          </div>
        </div>
      </div>

      <div class="analytics-metric-card" id="card-month-projection">
        <div class="metric-topline">
          <div class="metric-label-wrap">
            <span class="metric-label">Остаток на конец месяца</span>
            <button type="button" class="metric-info-btn" data-tooltip-id="tt-month-projection" aria-label="Подробнее о прогнозе остатка">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
          </div>
          <span class="metric-icon inc">${icon('wallet', 15)}</span>
        </div>
        <div class="metric-value num ${projectedBalance >= 0 ? 'inc' : 'exp'}">${money(projectedBalance)}</div>
        <div class="metric-footnote">${daysRemainingInMonth > 0 ? `${daysRemainingInMonth} дн. до конца мес • траты ~${money(expectedRemainingExp)}` : 'Итог месяца зафиксирован'}</div>

        <div class="metric-popover" id="tt-month-projection">
          <div class="metric-popover-header">
            <span class="popover-title">${icon("briefcase", 14)} Остаток на конец месяца</span>
            <button type="button" class="popover-close" data-close="tt-month-projection">✕</button>
          </div>
          <p class="popover-desc">Ожидаемый баланс средств на ваших счетах к концу текущего месяца при сохранении текущей скорости трат (${money(dailyVelocity)}/день).</p>
          <div class="popover-breakdown">
            <div class="p-row"><span>Текущий баланс:</span> <strong>${money(currentBalance)}</strong></div>
            <div class="p-row"><span>Ожидаемые траты (${daysRemainingInMonth} дн.):</span> <strong class="exp">−${money(expectedRemainingExp)}</strong></div>
            <div class="p-row highlight"><span>Ожидаемый остаток:</span> <strong class="${projectedBalance >= 0 ? 'inc' : 'exp'}">${money(projectedBalance)}</strong></div>
            <div class="p-row"><span>Всего расходов за месяц:</span> <strong>~${money(projectedMonthExp)}</strong></div>
          </div>
          <div class="popover-hint">
            Консервативный расчет: намеренно не прибавляет гипотетические доходы, чтобы показать гарантированный финансовый остаток.
          </div>
        </div>
      </div>

      <div class="analytics-metric-card" id="card-financial-rank">
        <div class="metric-topline">
          <div class="metric-label-wrap">
            <span class="metric-label">Финансовый статус</span>
            <button type="button" class="metric-info-btn" data-tooltip-id="tt-financial-status" aria-label="Подробнее о статусе">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
          </div>
          <span class="metric-icon inc">${icon(userRank.badge, 18)}</span>
        </div>
        <div class="metric-value rank-text">${userRank.title}</div>
        <div class="metric-footnote">${userRank.desc}</div>

        <div class="metric-popover" id="tt-financial-status">
          <div class="metric-popover-header">
            <span class="popover-title">${icon("crown", 14)} Финансовый статус</span>
            <button type="button" class="popover-close" data-close="tt-financial-status">✕</button>
          </div>
          <p class="popover-desc">Ваш инвестиционный ранг по методологии FinKaif OS. Растет по мере накопления капитала и достижения целей.</p>
          <div class="popover-breakdown">
            <div class="p-row"><span>Текущий ранг:</span> <strong>${userRank.title}</strong></div>
            <div class="p-row"><span>Свободный капитал:</span> <strong class="inc">${money(currentBalance)}</strong></div>
            <div class="p-row"><span>Уровень капитала:</span> <strong>${userRank.desc}</strong></div>
          </div>
          <div class="popover-hint">
            Пополняйте цели и контролируйте расходы, чтобы повышать свой статус в системе.
          </div>
        </div>
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
                  cx="100" cy="100" r="${radius}"
                  fill="none"
                  stroke="${s.color}"
                  stroke-width="${activeAnalyticsCat === s.cat ? 20 : 16}"
                  stroke-dasharray="${s.sliceLen} ${Math.max(0.1, circ - s.sliceLen)}"
                  stroke-dashoffset="${-s.offset}"
                  stroke-linecap="butt"
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
              <div class="donut-cat-item ${activeAnalyticsCat === s.cat ? 'selected' : ''}" data-cat="${esc(s.cat)}" data-amt="${s.amt}" data-pct="${s.pct}">
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

      <!-- Cashflow Card (Adaptive Bars & Smooth Wave) -->
      <div class="analytics-card cashflow-card">
        <div class="card-title-row">
          <div>
            <h3 class="card-title">Денежный поток (Cashflow)</h3>
            <p class="card-desc">${cfSubtitle}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <div class="cashflow-legend-pills">
              <span class="cf-pill inc"><span class="cf-dot" style="background: #2DD4BF;"></span> Доходы</span>
              <span class="cf-pill exp"><span class="cf-dot" style="background: #F59E0B;"></span> Расходы</span>
            </div>
            <div class="cf-view-toggle">
              <button class="cf-toggle-btn ${cashflowChartMode === 'bars' ? 'active' : ''}" data-cfmode="bars" title="Столбчатая диаграмма потока">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                Столбцы
              </button>
              <button class="cf-toggle-btn ${cashflowChartMode === 'wave' ? 'active' : ''}" data-cfmode="wave" title="Плавная волна потока">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 13c3-8 7-8 10 0s7 8 10 0"/></svg>
                Волна
              </button>
            </div>
          </div>
        </div>

        <!-- KPI Header Summary Strip -->
        <div class="cf-header-stats">
          <div class="cf-stat-chip inc">
            <span class="cf-stat-label">Поступления:</span>
            <span class="cf-stat-val">+${money(cfTotalInc)}</span>
          </div>
          <div class="cf-stat-chip exp">
            <span class="cf-stat-label">Списания:</span>
            <span class="cf-stat-val">−${money(cfTotalExp)}</span>
          </div>
          <div class="cf-stat-chip ${cfNet >= 0 ? 'net-pos' : 'net-neg'}">
            <span class="cf-stat-label">Чистый итог:</span>
            <span class="cf-stat-val">${cfNet >= 0 ? '+' : '−'}${money(Math.abs(cfNet))}</span>
            <span class="cf-stat-badge ${cfNet >= 0 ? 'jade' : 'coral'}">${cfNet >= 0 ? 'Профицит' : 'Дефицит'}</span>
          </div>
          ${cfTotalInc > 0 ? `
            <div class="cf-stat-chip" style="margin-left: auto;">
              <span class="cf-stat-label">Удержание дохода:</span>
              <span class="cf-stat-val" style="color: ${cfNet >= 0 ? 'var(--accent-jade)' : 'var(--accent-coral)'};">${Math.round((cfNet / cfTotalInc) * 100)}%</span>
            </div>
          ` : ''}
        </div>

        <div class="cashflow-chart-box" id="cf-chart-wrap">
          <!-- HTML-based Zero-distortion Scale Badges on the right -->
          <div class="cf-scale-track">
            <div class="cf-scale-badge" style="top: ${((baselineY - plotH) / cfH * 100).toFixed(1)}%;">
              ${compactMoney(cfMax)}
            </div>
            <div class="cf-scale-badge" style="top: ${((baselineY - Math.round(plotH * 0.5)) / cfH * 100).toFixed(1)}%;">
              ${compactMoney(Math.round(cfMax * 0.5))}
            </div>
            <div class="cf-scale-badge zero" style="top: ${(baselineY / cfH * 100).toFixed(1)}%;">
              0 ₽
            </div>
          </div>

          <svg viewBox="0 0 ${cfW} ${cfH}" preserveAspectRatio="none" id="cf-chart-svg" style="width: 100%; height: 210px; overflow: visible;">
            <defs>
              <linearGradient id="cfIncGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="#2DD4BF" stop-opacity="0.0"/>
              </linearGradient>
              <linearGradient id="cfExpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.26"/>
                <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0"/>
              </linearGradient>
              <linearGradient id="cfBarIncGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#34D399"/>
                <stop offset="100%" stop-color="#0D9488"/>
              </linearGradient>
              <linearGradient id="cfBarExpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FBBF24"/>
                <stop offset="100%" stop-color="#D97706"/>
              </linearGradient>
            </defs>

            <!-- Guide Scale Lines -->
            <line x1="${padX}" y1="${baselineY - plotH}" x2="${cfW - padX}" y2="${baselineY - plotH}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"/>
            <line x1="${padX}" y1="${baselineY - Math.round(plotH * 0.5)}" x2="${cfW - padX}" y2="${baselineY - Math.round(plotH * 0.5)}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3 3"/>

            <!-- Baseline at y=0 -->
            <line x1="${padX}" y1="${baselineY}" x2="${cfW - padX}" y2="${baselineY}" stroke="rgba(255,255,255,0.14)"/>

            ${cashflowChartMode === 'bars' ? `
              <!-- Bars Mode -->
              <rect id="cf-slot-highlight" class="cf-slot-highlight" x="0" y="8" width="${slotW}" height="${baselineY - 8 + 2}" rx="4" fill="rgba(255,255,255,0.04)" opacity="0"/>

              ${cfCoords.map((pt, idx) => {
                const hasInc = pt.inc > 0;
                const hasExp = pt.exp > 0;
                const isBoth = hasInc && hasExp;
                const bW = pt.barW;

                const incX = isBoth ? pt.slotCenter - bW - 1 : pt.slotCenter - bW / 2;
                const expX = isBoth ? pt.slotCenter + 1 : pt.slotCenter - bW / 2;

                return `
                  ${hasInc ? `<rect class="cf-bar inc" x="${incX}" y="${baselineY - pt.hInc}" width="${bW}" height="${pt.hInc}" rx="3" fill="url(#cfBarIncGrad)" data-idx="${idx}" />` : ''}
                  ${hasExp ? `<rect class="cf-bar exp" x="${expX}" y="${baselineY - pt.hExp}" width="${bW}" height="${pt.hExp}" rx="3" fill="url(#cfBarExpGrad)" data-idx="${idx}" />` : ''}
                  ${!hasInc && !hasExp ? `<circle cx="${pt.slotCenter}" cy="${baselineY}" r="1.5" fill="rgba(255,255,255,0.12)" />` : ''}
                `;
              }).join('')}

              <rect id="cf-chart-overlay" class="cf-chart-overlay" x="0" y="0" width="${cfW}" height="${cfH}" fill="transparent" />
            ` : `
              <!-- Wave Mode (Taller, graceful 138px amplitude) -->
              ${incArea ? `<path d="${incArea}" fill="url(#cfIncGrad)" />` : ''}
              ${incPath ? `<path d="${incPath}" fill="none" stroke="#2DD4BF" stroke-width="2.5" stroke-linecap="round" />` : ''}

              ${expArea ? `<path d="${expArea}" fill="url(#cfExpGrad)" />` : ''}
              ${expPath ? `<path d="${expPath}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" />` : ''}

              <!-- Dynamic Scrubber Laser Line -->
              <line id="cf-scrubber-line" class="cf-scrubber-line" x1="0" y1="8" x2="0" y2="${baselineY}" />

              <rect id="cf-chart-overlay" class="cf-chart-overlay" x="0" y="0" width="${cfW}" height="${cfH}" fill="transparent" />
            `}
          </svg>

          <!-- HTML 100% Round Wave Peak Dots (Zero SVG oval distortion) -->
          ${cashflowChartMode === 'wave' ? cfCoords.filter(pt => pt.inc > 0 || pt.exp > 0).map(pt => {
            const leftPct = ((pt.x / cfW) * 100).toFixed(2);
            const incTopPct = ((pt.yInc / cfH) * 100).toFixed(2);
            const expTopPct = ((pt.yExp / cfH) * 100).toFixed(2);
            return `
              ${pt.inc > 0 ? `
                <div class="cf-activity-dot inc" style="left: ${leftPct}%; top: ${incTopPct}%;" data-idx="${pt.idx}">
                  <div class="cf-dot-core"></div>
                </div>
              ` : ''}
              ${pt.exp > 0 ? `
                <div class="cf-activity-dot exp" style="left: ${leftPct}%; top: ${expTopPct}%;" data-idx="${pt.idx}">
                  <div class="cf-dot-core"></div>
                </div>
              ` : ''}
            `;
          }).join('') : ''}

          <!-- HTML 100% Round Scrubber Beacons -->
          <div id="cf-html-beacon-inc" class="cf-scrubber-beacon inc">
            <div class="beacon-core"></div>
          </div>
          <div id="cf-html-beacon-exp" class="cf-scrubber-beacon exp">
            <div class="beacon-core"></div>
          </div>

          <!-- HTML-based Axis Strip (Число и месяц с идеальными пропорциями шрифта, никакого сжатия!) -->
          <div class="cf-axis-strip">
            ${cfCoords.map((pt, idx) => {
              const show = isLabelVisible(idx, N);
              if (!show) return '';
              const isLatest = (idx === N - 1);
              const leftPct = (((cashflowChartMode === 'bars' ? pt.slotCenter : pt.x) / cfW) * 100).toFixed(2);

              let dayNum = '';
              let monthStr = '';
              if (pt.date && pt.date.includes('-')) {
                const parts = pt.date.split('-');
                dayNum = String(parseInt(parts[2], 10));
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                monthStr = d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
              } else if (pt.dayLabel) {
                const tokens = pt.dayLabel.trim().split(/\s+/);
                dayNum = tokens[0];
                monthStr = (tokens[1] || '').replace('.', '');
              }

              return `
                <div class="cf-axis-item ${isLatest ? 'is-latest' : ''}" data-idx="${idx}" style="left: ${leftPct}%;">
                  <div class="cf-axis-tick"></div>
                  <div class="cf-axis-badge">
                    <span class="cf-axis-day">${dayNum}</span>
                    ${monthStr ? `<span class="cf-axis-month">${monthStr}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div id="cf-chart-tooltip" class="chart-tooltip"></div>
        </div>

        <!-- Month-over-Month & Cashflow Insight Bar -->
        <div class="mom-strip">
          <div class="mom-col">
            <div class="mom-lbl">Динамика и статус денежного потока:</div>
            <div class="mom-stat">
              ${prevMonthExp > 0 ? `
                <span class="badge-tag ${momExpDeltaPct <= 0 ? 'jade' : 'coral'}">
                  ${momExpDeltaPct <= 0 ? '−' : '+'}${Math.abs(momExpDeltaPct)}%
                  ${momExpDeltaPct <= 0 ? ' (Экономия трат)' : ' (Рост трат)'}
                </span>
                <span class="mom-note">
                  Текущий месяц: <strong>${money(curMonthExp)}</strong> vs прошлый: <strong>${money(prevMonthExp)}</strong>
                </span>
              ` : `
                <span class="badge-tag ${cfNet >= 0 ? 'jade' : 'coral'}">
                  ${cfNet >= 0 ? 'Профицит денежного потока' : 'Дефицит денежного потока'}
                </span>
                <span class="mom-note">
                  ${cfTotalInc > 0
                    ? `Удержано ${Math.max(0, Math.round((cfNet / cfTotalInc) * 100))}% всех поступлений в чистый остаток.`
                    : 'Списания за период составили ' + money(cfTotalExp) + '. Сравнение с прошлым месяцем появится в следующем периоде.'}
                </span>
              `}
            </div>
          </div>
          <div class="mom-meta-col">
            <div class="mom-mini-stat">
              <span class="mom-mini-lbl">Средний расход:</span>
              <span class="mom-mini-val num">${money(dailyVelocity)}/день</span>
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
      ${drilldownTxs.length > 0 ? drilldownTxs.map(t => renderTxCard(t, { allowSelect: false })).join('') : `
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
  const monthMap = {};
  (data.transactions || []).forEach(t => {
    const iso = getTxIso(t);
    if (iso && iso.length >= 7) {
      const ym = iso.slice(0, 7);
      if (!monthMap[ym]) {
        const [y, m] = ym.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        const label = dateObj.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        monthMap[ym] = label.charAt(0).toUpperCase() + label.slice(1);
      }
    }
  });
  const availableMonths = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));

  const filtered = data.transactions.filter(t => {
    if (txFilter === 'expense' && t.type !== 'expense') return false;
    if (txFilter === 'income' && t.type !== 'income') return false;
    if (txFilter === 'large' && Number(t.amount) < 10000) return false;
    if (txFilter === 'today' && getTxIso(t) !== toDateIso(getMskDate())) return false;
    if (txFilter === 'subs' && (t.category !== 'Подписки' && !t.is_recurring)) return false;
    if (txMonthFilter !== 'all') {
      const iso = getTxIso(t);
      if (!iso || !iso.startsWith(txMonthFilter)) return false;
    }
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (t.category || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || String(t.amount).includes(q);
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
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button class="btn-secondary" id="btn-import-bank" title="Импортировать выписку банка (Т-Банк, Сбер, Альфа, ВТБ...)">
          ${icon('upload', 14)}
          <span>Импорт выписки</span>
        </button>
        <button class="btn-secondary" id="btn-export-csv" title="Выгрузить операции в формате CSV (Excel)">
          ${icon('download', 14)}
          <span>Экспорт CSV</span>
        </button>
        <button class="btn-primary" id="btn-add-tx-view">
          ${icon('plus', 14)}
          <span>Новая операция</span>
        </button>
      </div>
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

    <!-- Month Selection Strip -->
    ${availableMonths.length > 0 ? `
      <div class="tx-month-strip">
        <button class="month-chip ${txMonthFilter === 'all' ? 'active' : ''}" data-month="all">Все месяцы</button>
        ${availableMonths.map(ym => `
          <button class="month-chip ${txMonthFilter === ym ? 'active' : ''}" data-month="${ym}">
            ${esc(monthMap[ym])}
          </button>
        `).join('')}
      </div>
    ` : ''}

    <!-- Search & Filters -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="filter-tab ${txFilter === 'all' ? 'active' : ''}" data-filter="all">Все записи</button>
        <button class="filter-tab ${txFilter === 'expense' ? 'active' : ''}" data-filter="expense"><span class="status-dot coral"></span> Расходы</button>
        <button class="filter-tab ${txFilter === 'income' ? 'active' : ''}" data-filter="income"><span class="status-dot jade"></span> Доходы</button>
        <button class="filter-tab ${txFilter === 'large' ? 'active' : ''}" data-filter="large">${icon("sparkle", 12)} Крупные (>10к)</button>
        <button class="filter-tab ${txFilter === 'today' ? 'active' : ''}" data-filter="today">${icon("calendar", 12)} Сегодня</button>
      </div>

      <div class="search-box">
        ${icon('search', 14)}
        <input id="tx-search-input" placeholder="Поиск по категории, описанию или сумме..." value="${esc(txSearch)}">
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
              ${dayTxs.map(t => renderTxCard(t, { allowSelect: true })).join('')}
            </div>
          </div>
        `;
      }).join('') : `
        <div style="text-align: center; padding: 50px 20px; background: var(--bg-surface); border-radius: var(--r-lg); border: 1px dashed var(--border-medium);">
          <div style="display: flex; justify-content: center; margin-bottom: 12px;">${icon("creditCard", 36)}</div>
          <div style="color: #FFFFFF; font-weight: 700; font-size: 16px; margin-bottom: 6px;">Операции пока не добавлены</div>
          <p style="color: var(--text-secondary); font-size: 13px; max-width: 440px; margin: 0 auto 18px;">Вы можете быстро загрузить выписку из банка файлом (.CSV, .TXT, .TSV, .JSON) или внести операцию вручную.</p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn-primary" id="btn-empty-import-bank">
              ${icon('upload', 14)}
              <span>Импортировать выписку банка</span>
            </button>
            <button type="button" class="btn-secondary" id="btn-first-op">
              ${icon('plus', 14)}
              <span>Добавить вручную</span>
            </button>
          </div>
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

function renderTxCard(t, opts = {}) {
  const allowSelect = opts.allowSelect !== undefined ? opts.allowSelect : (tab === 'transactions');
  const isInc = t.type === 'income';
  const catIcon = getCategoryIcon(t.category);
  const isSelected = allowSelect && selectedTxIds.has(t.id);

  return `
    <div class="tx-card tx-row-clickable ${isSelected ? 'selected' : ''} ${allowSelect ? 'select-mode' : ''}" data-id="${t.id}" title="Нажмите для редактирования операции">
      ${allowSelect ? `
        <div class="tx-checkbox-wrap ${isSelected ? 'checked' : ''}" data-id="${t.id}" title="${isSelected ? 'Снять выбор' : 'Выбрать операцию'}">
          <span class="tx-custom-checkbox ${isSelected ? 'checked' : ''}">
            ${isSelected ? icon('check', 11) : ''}
          </span>
        </div>
      ` : ''}
      <div class="tx-left">
        <div class="tx-icon-box ${isInc ? 'inc' : 'exp'}">
          ${catIcon}
        </div>
        <div class="tx-meta">
          <div class="tx-category">${esc(t.category)} <span class="tx-time-chip" style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-left: 6px;">${formatTxTime(t)}</span></div>
          <div class="tx-desc">${t.description ? esc(t.description) : 'Без описания'}</div>
        </div>
      </div>

      <div class="tx-right">
        <div class="tx-amount num ${isInc ? 'inc' : 'exp'}">
          ${isInc ? '+' : '−'}${money(t.amount)}
        </div>
        <div class="tx-actions">
          <button class="tx-edit-btn" data-id="${t.id}" title="Редактировать запись">
            ${icon('edit', 13)}
          </button>
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
        <div class="progress-bar-fill ${overallPct > 90 ? 'danger' : ''}" style="width: ${Math.max(0, Math.min(100, overallPct))}%; --target-width: ${Math.max(0, Math.min(100, overallPct))}%;"></div>
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
        <span class="budget-quick-lbl">Быстрый выбор категории:</span>
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

      <form id="budget-form" class="budget-form-grid">
        <input class="form-input" id="budget-cat" list="budget-categories-datalist" placeholder="Категория (выберите или введите)" required>
        <div class="number-stepper-wrap">
          <input class="form-input num" id="budget-limit" type="number" min="1" step="any" placeholder="Сумма лимита (₽)" required>
          <div class="input-spin-steppers">
            <button type="button" class="spin-step-btn" data-target="budget-limit" data-step="1000" title="Увеличить на 1 000 ₽" aria-label="Увеличить">
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="spin-step-btn" data-target="budget-limit" data-step="-1000" title="Уменьшить на 1 000 ₽" aria-label="Уменьшить">
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
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
        const dailyAllowance = Math.max(0, Math.round(rem / Math.max(1, daysLeft)));
        const elapsedDays = Math.max(1, now.getDate());
        const plannedDaily = Math.round(lim / daysInMonth);
        const actualDaily = Math.round(spent / elapsedDays);
        const expectedSpendSoFar = Math.round(lim * (elapsedDays / daysInMonth));
        const paceDelta = spent - expectedSpendSoFar;

        return `
          <div class="budget-card ${isExceeded ? 'budget-card-exceeded' : ''}">
            <div class="budget-head">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="budget-cat-icon">${catIcon}</div>
                <div>
                  <div class="budget-cat-title">${esc(b.category)}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Месячный лимит: <strong class="num" style="color: #FFFFFF;">${money(lim)}</strong></div>
                </div>
              </div>
              <div class="budget-card-actions">
                <button type="button" class="budget-step-inline-btn" data-category="${esc(b.category)}" data-step="-1000" title="Уменьшить лимит на 1 000 ₽">−1к</button>
                <button type="button" class="budget-step-inline-btn" data-category="${esc(b.category)}" data-step="1000" title="Увеличить лимит на 1 000 ₽">+1к</button>
                <button class="budget-delete-btn" data-id="${b.id}" title="Удалить лимит">
                  ${icon('trash', 12)}
                </button>
              </div>
            </div>

            <div class="progress-bar-track" style="margin: 14px 0 10px; position: relative;">
              <div class="progress-bar-fill ${isExceeded ? 'danger' : (pct >= 75 ? 'warning' : 'jade')}" style="width: ${Math.max(0, Math.min(100, pct))}%; --target-width: ${Math.max(0, Math.min(100, pct))}%;"></div>
              <div class="budget-day-marker" style="left: ${((elapsedDays / daysInMonth) * 100).toFixed(1)}%;" title="Сегодня ${elapsedDays}-й день из ${daysInMonth}"></div>
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
                  <span class="status-dot coral"></span> Превышение лимита на ${money(Math.abs(rem))}!
                </span>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                    <span class="badge-tag ${actualDaily <= plannedDaily ? 'jade' : 'amber'}">
                      ${actualDaily <= plannedDaily ? `<span class=\"status-dot jade\"></span> Темп в норме (−${money(Math.abs(paceDelta))} от графика)` : `<span class=\"status-dot amber\"></span> Опережение темпа (+${money(paceDelta)} от графика)`}
                    </span>
                    <span style="color: var(--text-muted); font-size: 11px;">план: ${money(plannedDaily)}/дн.</span>
                  </div>
                  <span class="budget-pace-text" style="margin-top: 2px;">
                    Доступно: <strong class="num" style="color: var(--accent-jade);">${money(dailyAllowance)}</strong> в день (${daysLeft} дн. до конца месяца)
                  </span>
                </div>
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
        <div class="progress-bar-fill" style="width: ${Math.max(0, Math.min(100, overallPct))}%; --target-width: ${Math.max(0, Math.min(100, overallPct))}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px;">
        <span style="color: var(--text-muted);">Накоплено: <strong class="num" style="color: #FFFFFF;">${money(totalSaved)}</strong></span>
        <span style="color: var(--text-muted);">Целевой объем: <strong class="num" style="color: #FFFFFF;">${money(totalTarget)}</strong></span>
      </div>
    </div>

    <!-- Add Goal Form -->
    <div class="create-card">
      <h3 style="font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 10px;">Создать новую цель</h3>
      
      <!-- Popular Goal Suggestion Chips -->
      <div class="budget-quick-chips" style="margin-bottom: 12px;">
        <span class="budget-quick-lbl">Популярные цели:</span>
        <div class="budget-chips-stream">
          <button type="button" class="goal-preset-chip" data-name="Подушка безопасности" data-target="300000">${icon("shield", 13)} <span>Подушка (300к)</span></button>
          <button type="button" class="goal-preset-chip" data-name="Отпуск мечты" data-target="150000">${icon("plane", 13)} <span>Отпуск (150к)</span></button>
          <button type="button" class="goal-preset-chip" data-name="Новый ноутбук" data-target="200000">${icon("laptop", 13)} <span>Ноутбук (200к)</span></button>
          <button type="button" class="goal-preset-chip" data-name="Автомобиль" data-target="1500000">${icon("car", 13)} <span>Авто (1.5м)</span></button>
        </div>
      </div>

      <form id="goal-form" class="goal-form-grid">
        <input class="form-input" id="goal-name" placeholder="Название (напр. Подушка безопасности)" required>
        <div class="number-stepper-wrap">
          <input class="form-input num" id="goal-target" type="number" min="1" step="any" placeholder="Целевая сумма (₽)" required>
          <div class="input-spin-steppers">
            <button type="button" class="spin-step-btn" data-target="goal-target" data-step="5000" title="Увеличить на 5 000 ₽" aria-label="Увеличить">
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="spin-step-btn" data-target="goal-target" data-step="-5000" title="Уменьшить на 5 000 ₽" aria-label="Уменьшить">
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="number-stepper-wrap">
          <input class="form-input num" id="goal-saved" type="number" min="0" step="any" placeholder="Уже есть (₽)">
          <div class="input-spin-steppers">
            <button type="button" class="spin-step-btn" data-target="goal-saved" data-step="1000" title="Увеличить на 1 000 ₽" aria-label="Увеличить">
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="spin-step-btn" data-target="goal-saved" data-step="-1000" title="Уменьшить на 1 000 ₽" aria-label="Уменьшить">
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
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
        const isCompleted = pct >= 100;
        const rec6mo = rem > 0 ? Math.round(rem / 6) : 0;
        const rec12mo = rem > 0 ? Math.round(rem / 12) : 0;

        return `
          <div class="goal-card ${isCompleted ? 'goal-card-completed' : ''}">
            <div class="goal-head">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="goal-title">${esc(g.name)}</span>
                  ${isCompleted ? `<span class="goal-completed-badge">${icon("checkCircle", 12)} Достигнута!</span>` : ''}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                  <strong class="num" style="color: ${isCompleted ? 'var(--accent-emerald)' : 'var(--accent-jade)'};">${pct}%</strong> от цели ${rem > 0 ? `• осталось <span class="num">${money(rem)}</span>` : ''}
                </div>
              </div>
              <button class="goal-delete-btn" data-id="${g.id}" title="Удалить цель">
                ${icon('trash', 12)}
              </button>
            </div>

            <div class="progress-bar-track" style="margin: 16px 0 12px;">
              <div class="progress-bar-fill ${isCompleted ? 'completed' : 'jade'}" style="width: ${Math.max(0, Math.min(100, pct))}%; --target-width: ${Math.max(0, Math.min(100, pct))}%;"></div>
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

            ${rem > 0 ? `
              <div class="goal-plan-pill">
                <span><span class="status-dot jade"></span> Темп: ~<strong>${money(rec6mo)}</strong>/мес (6 мес) • ~<strong>${money(rec12mo)}</strong>/мес (1 год)</span>
              </div>
            ` : ''}

            <!-- 1-Click Instant Deposit Chips -->
            <div class="goal-instant-chips">
              <span class="goal-instant-lbl">Быстро +:</span>
              <button type="button" class="goal-instant-chip" data-id="${g.id}" data-amount="1000" title="Пополнить цель на 1 000 ₽">+1 000 ₽</button>
              <button type="button" class="goal-instant-chip" data-id="${g.id}" data-amount="5000" title="Пополнить цель на 5 000 ₽">+5 000 ₽</button>
              <button type="button" class="goal-instant-chip" data-id="${g.id}" data-amount="10000" title="Пополнить цель на 10 000 ₽">+10 000 ₽</button>
            </div>

            <!-- Custom Add to Goal -->
            <div class="goal-add-strip">
              <div class="number-stepper-wrap" style="flex: 1;">
                <input class="form-input num goal-topup-input" data-id="${g.id}" type="number" min="1" step="any" placeholder="Произвольная сумма...">
                <div class="input-spin-steppers">
                  <button type="button" class="spin-step-btn" data-step="500" title="Увеличить на 500 ₽" aria-label="Увеличить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                  <button type="button" class="spin-step-btn" data-step="-500" title="Уменьшить на 500 ₽" aria-label="Уменьшить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
              <button class="btn-primary goal-topup-btn" data-id="${g.id}" style="padding: 0 14px; height: 36px; font-size: 12px;">
                + Пополнить
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
  const finScore = calculateFinScore();
  const thinkingPhases = [
    'Считываю структуру транзакций и баланс...',
    'Рассчитываю финансовую скорость (Burn Rate)...',
    'Моделирую сценарий сложного процента...',
    'Синтезирую персональную стратегию...'
  ];

  // Wealth simulator calculation
  const months = simState.years * 12;
  const rMonthly = (simState.rate / 100) / 12;
  const fvPrincipal = simState.initial * Math.pow(1 + rMonthly, months);
  const fvAnnuity = simState.monthly * ((Math.pow(1 + rMonthly, months) - 1) / rMonthly);
  const simTotal = Math.round(fvPrincipal + fvAnnuity);
  const simContributed = Math.round(simState.initial + simState.monthly * months);
  const simProfit = Math.max(0, simTotal - simContributed);

  return `
    <div class="view-header assistant-view-header">
      <div>
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 8px;">
          ${renderAssistantOrb(isAiThinking ? 'thinking' : 'idle', 42)}
          <div class="assistant-tag-pill" style="margin-bottom: 0;">
            <span class="pulse-dot"></span>
            <span>FinKaif Brain 3.0 • Neural Financial Intelligence</span>
          </div>
        </div>
        <h1 class="view-title">ИИ-Ментор FinKaif</h1>
        <p class="view-subtitle">Персональный финансовый интеллект: сценарии FIRE, сложный процент, аудит утечек и защита капитала.</p>
      </div>

      <!-- FinScore Widget Card -->
      <div class="assistant-finscore-widget">
        <div class="finscore-circle-wrap">
          <svg class="finscore-svg" viewBox="0 0 36 36">
            <path class="finscore-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="finscore-fill ${finScore.badgeClass}" stroke-dasharray="${finScore.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <span class="finscore-num">${finScore.score}</span>
        </div>
        <div class="finscore-text-block">
          <div class="finscore-title-row">
            <span class="finscore-lbl">Индекс FinScore</span>
            <span class="finscore-badge ${finScore.badgeClass}">${finScore.label}</span>
          </div>
          <div class="finscore-sub">Подушка: ${finScore.runway} мес • Сбережения: ${finScore.savingsRate}%</div>
        </div>
      </div>
    </div>

    <!-- Assistant Quick Toolbar Strip -->
    <div class="assistant-toolbar-strip">
      <div class="assistant-mode-pills">
        <button type="button" class="assistant-mode-pill" data-prompt="Полная экспресс-диагностика FinScore">
          <span class="pill-icon-badge">${icon('pulse', 13)}</span> <span>Аудит FinScore</span>
        </button>
        <button type="button" class="assistant-mode-pill" data-prompt="Когда я смогу выйти на FIRE (пассивный доход)?">
          <span class="pill-icon-badge">${icon('flame', 13)}</span> <span>FIRE & Свобода</span>
        </button>
        <button type="button" class="assistant-mode-pill" data-prompt="Создай цель на отпуск 150000 рублей">
          <span class="pill-icon-badge">${icon('target', 13)}</span> <span>Создать цель</span>
        </button>
        <button type="button" class="assistant-mode-pill" data-prompt="Поставь бюджет на рестораны 25000">
          <span class="pill-icon-badge">${icon('budgets', 13)}</span> <span>Лимит бюджета</span>
        </button>
        <button type="button" class="assistant-mode-pill" data-prompt="Где я теряю больше всего денег и как оптимизировать?">
          <span class="pill-icon-badge">${icon('search', 13)}</span> <span>Детектив утечек</span>
        </button>
        <button type="button" class="assistant-mode-pill" data-prompt="Прогноз капитала через 5 лет со сложным процентом">
          <span class="pill-icon-badge">${icon('trendUp', 13)}</span> <span>Прогноз 5 лет</span>
        </button>
      </div>

      <div class="assistant-tool-actions">
        <button class="btn-toggle-sim ${simState.open ? 'active' : ''}" id="btn-toggle-sim">
          ${icon('calculator', 14)}
          <span>${simState.open ? 'Скрыть симулятор' : 'Симулятор капитала'}</span>
        </button>
        ${data.chat.length > 0 ? `
          <button class="btn-clear-chat" id="btn-clear-chat" title="Очистить диалог">
            ${icon('trash', 14)}
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Interactive Wealth Simulator Drawer Card -->
    ${simState.open ? `
      <div class="wealth-sim-card" id="wealth-sim-card">
        <div class="wealth-sim-head">
          <div class="wealth-sim-title-group">
            <span class="wealth-sim-icon">${icon("sparkle", 16)}</span>
            <div>
              <h3 class="wealth-sim-title">Интерактивный симулятор сложного процента</h3>
              <p class="wealth-sim-desc">Оцените силу непрерывного инвестиционного потока и сложного процента во времени.</p>
            </div>
          </div>
          <div class="wealth-sim-total-badge">
            <span class="sim-badge-lbl">Ожидаемый капитал:</span>
            <span class="sim-badge-val num">${money(simTotal)}</span>
          </div>
        </div>

        <div class="wealth-sim-grid">
          <!-- Controls -->
          <div class="wealth-sim-controls">
            <div class="sim-control-group">
              <div class="sim-control-head">
                <span class="sim-control-label">Стартовый капитал</span>
                <span class="sim-control-val num" id="lbl-sim-initial">${money(simState.initial)}</span>
              </div>
              <input type="range" class="sim-slider" id="sim-input-initial" min="0" max="1000000" step="25000" value="${simState.initial}">
            </div>

            <div class="sim-control-group">
              <div class="sim-control-head">
                <span class="sim-control-label">Ежемесячные инвестиции</span>
                <span class="sim-control-val num" id="lbl-sim-monthly">${money(simState.monthly)}</span>
              </div>
              <input type="range" class="sim-slider" id="sim-input-monthly" min="5000" max="150000" step="5000" value="${simState.monthly}">
            </div>

            <div class="sim-control-row">
              <div class="sim-control-group" style="flex: 1;">
                <div class="sim-control-head">
                  <span class="sim-control-label">Горизонт (лет)</span>
                  <span class="sim-control-val num" id="lbl-sim-years">${simState.years} ${simState.years === 1 ? 'год' : (simState.years < 5 ? 'года' : 'лет')}</span>
                </div>
                <div class="sim-chips-stream">
                  ${[1, 3, 5, 10].map(y => `
                    <button class="sim-chip ${simState.years === y ? 'active' : ''}" data-sim-years="${y}">${y} ${y === 1 ? 'год' : (y < 5 ? 'года' : 'лет')}</button>
                  `).join('')}
                </div>
              </div>

              <div class="sim-control-group" style="flex: 1;">
                <div class="sim-control-head">
                  <span class="sim-control-label">Доходность (% годовых)</span>
                  <span class="sim-control-val num" id="lbl-sim-rate">${simState.rate}%</span>
                </div>
                <div class="sim-chips-stream">
                  ${[8, 12, 16, 20].map(r => `
                    <button class="sim-chip ${simState.rate === r ? 'active' : ''}" data-sim-rate="${r}">${r}%</button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Live Breakdown Box -->
          <div class="wealth-sim-breakdown">
            <div class="sim-stat-row">
              <span class="sim-stat-lbl">Личные вложения:</span>
              <span class="sim-stat-val num" id="lbl-sim-contrib">${money(simContributed)}</span>
            </div>
            <div class="sim-stat-row highlight">
              <span class="sim-stat-lbl">Чистые проценты:</span>
              <span class="sim-stat-val num profit" id="lbl-sim-profit">+${money(simProfit)}</span>
            </div>
            <div class="sim-progress-bar">
              <div class="sim-progress-invested" style="width: ${Math.round((simContributed / (simTotal || 1)) * 100)}%;"></div>
              <div class="sim-progress-profit" style="width: ${Math.round((simProfit / (simTotal || 1)) * 100)}%;"></div>
            </div>
            <div class="sim-progress-legend">
              <span><span class="legend-dot invested"></span> Вложено (${Math.round((simContributed / (simTotal || 1)) * 100)}%)</span>
              <span><span class="legend-dot profit"></span> Доход от % (${Math.round((simProfit / (simTotal || 1)) * 100)}%)</span>
            </div>
            <button class="btn-ask-scenario" id="btn-ask-scenario" data-prompt="Рассчитай подробно инвест-план: стартовый капитал ${simState.initial} руб, пополнение ${simState.monthly} руб в месяц на ${simState.years} лет под ${simState.rate}% годовых">
              <span>${icon("sparkle", 13)}</span> <span>Спросить ассистента об этом плане</span>
            </button>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="assistant-layout">
      <!-- Quick Prompt Suggestions Sidebar -->
      <div class="assistant-sidebar">
        <div class="assistant-sidebar-title">СТРАТЕГИИ И ДЕЙСТВИЯ</div>
        <div class="assistant-suggestions">
          ${[
            { theme: 'fire', iconName: 'flame', title: 'FIRE & Свобода', sub: 'Срок до пассивного дохода', prompt: 'Когда я смогу выйти на FIRE (пассивный доход)?' },
            { theme: 'goal', iconName: 'target', title: 'Создать цель', sub: '«Отпуск 150к», «Авто 500к»', prompt: 'Создай цель на отпуск 150000 рублей' },
            { theme: 'budget', iconName: 'budgets', title: 'Поставить бюджет', sub: '«Кафе 25к», «Продукты 40к»', prompt: 'Поставь бюджет на рестораны 25000' },
            { theme: 'leaks', iconName: 'search', title: 'Детектив утечек', sub: 'Поиск скрытых трат', prompt: 'Где я теряю больше всего денег и как оптимизировать?' },
            { theme: 'runway', iconName: 'shield', title: 'Запас прочности', sub: 'Стресс-тест подушки безопасности', prompt: 'На сколько месяцев мне хватит подушки безопасности?' },
            { theme: 'growth', iconName: 'trendUp', title: 'Сложный процент', sub: 'Рост капитала за 1, 3, 5 лет', prompt: 'Прогноз капитала через 5 лет со сложным процентом' },
            { theme: 'ritual', iconName: 'scale', title: 'Ритуал 50/30/20', sub: 'Сначала заплати себе', prompt: 'Как распределить доход по правилу 50/30/20?' },
            { theme: 'finscore', iconName: 'pulse', title: 'Аудит FinScore', sub: 'Оценка финансового здоровья', prompt: 'Полная экспресс-диагностика FinScore' }
          ].map(p => `
            <button type="button" class="suggestion-chip" data-prompt="${esc(p.prompt)}">
              <div class="chip-icon-box chip-theme-${p.theme}">
                ${icon(p.iconName, 17)}
              </div>
              <div class="chip-content">
                <div class="chip-title">${p.title}</div>
                <div class="chip-sub">${p.sub}</div>
              </div>
              <div class="chip-arrow">
                ${icon('chevronRight', 14)}
              </div>
            </button>
          `).join('')}
        </div>

        <div class="assistant-note-card">
          <div style="font-weight: 700; color: #FFFFFF; font-size: 12px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--accent-jade); display: flex;">${icon('shield', 13)}</span> <span>Защита данных</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); line-height: 1.45;">FinKaif оперирует обезличенными суммами категорий без передачи паспортных или банковских данных.</div>
        </div>
      </div>

      <!-- Chat Stream Panel -->
      <div class="assistant-chat-panel">
        <div class="chat-stream" id="chat-stream-box">
          ${data.chat.length > 0 ? data.chat.map(m => `
            <div class="chat-bubble ${m.role}">
              ${m.role === 'assistant' ? `
                <div class="chat-author">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    ${icon('assistant', 14)}
                    <span style="font-weight: 700;">FinKaif Mentor 3.0</span>
                    <span class="assistant-pill-mini">AI</span>
                  </div>
                  <button type="button" class="chat-copy-btn" data-text="${esc(m.content)}" title="Скопировать ответ">
                    ${icon('copy', 13)}
                  </button>
                </div>
              ` : ''}
              <div class="chat-body">${m.role === 'assistant' ? formatAssistantMessage(m.content) : formatMarkdown(m.content)}</div>
            </div>
          `).join('') : `
            <div class="chat-empty-state">
              <div class="chat-empty-icon-orb">
                <div class="orb-core"></div>
                <div class="orb-ring-1"></div>
                <div class="orb-ring-2"></div>
              </div>
              <h3 style="font-size: 18px; font-weight: 800; color: #FFFFFF; margin-bottom: 6px;">FinKaif Brain 3.0 готов к работе</h3>
              <p style="font-size: 13px; color: var(--text-secondary); max-width: 460px; margin: 0 auto 16px auto; line-height: 1.5;">
                Персональный финансовый интеллект: сценарии FIRE, сложный процент, аудит утечек и мгновенные действия на сайте.
              </p>
              <div class="chat-empty-quick-prompts">
                <button type="button" class="empty-prompt-card suggestion-chip" data-prompt="Создай цель на отпуск 150000 рублей">
                  <div class="chip-icon-box chip-theme-goal">${icon('target', 16)}</div>
                  <div class="empty-prompt-text">
                    <span class="empty-prompt-title">Создать цель</span>
                    <span class="empty-prompt-sub">«Отпуск 150 000 ₽»</span>
                  </div>
                  <div class="chip-arrow">${icon('chevronRight', 12)}</div>
                </button>
                <button type="button" class="empty-prompt-card suggestion-chip" data-prompt="Поставь бюджет на рестораны 25000">
                  <div class="chip-icon-box chip-theme-budget">${icon('budgets', 16)}</div>
                  <div class="empty-prompt-text">
                    <span class="empty-prompt-title">Поставить бюджет</span>
                    <span class="empty-prompt-sub">«Рестораны 25 000 ₽»</span>
                  </div>
                  <div class="chip-arrow">${icon('chevronRight', 12)}</div>
                </button>
                <button type="button" class="empty-prompt-card suggestion-chip" data-prompt="Когда я смогу выйти на FIRE (пассивный доход)?">
                  <div class="chip-icon-box chip-theme-fire">${icon('flame', 16)}</div>
                  <div class="empty-prompt-text">
                    <span class="empty-prompt-title">FIRE & Свобода</span>
                    <span class="empty-prompt-sub">Срок до пассивного дохода</span>
                  </div>
                  <div class="chip-arrow">${icon('chevronRight', 12)}</div>
                </button>
                <button type="button" class="empty-prompt-card suggestion-chip" data-prompt="Где я теряю больше всего денег и как оптимизировать?">
                  <div class="chip-icon-box chip-theme-leaks">${icon('search', 16)}</div>
                  <div class="empty-prompt-text">
                    <span class="empty-prompt-title">Детектив утечек</span>
                    <span class="empty-prompt-sub">Поиск скрытых трат</span>
                  </div>
                  <div class="chip-arrow">${icon('chevronRight', 12)}</div>
                </button>
              </div>
            </div>
          `}

          <!-- Holographic Neural Thinking Indicator -->
          ${isAiThinking ? `
            <div class="chat-bubble assistant thinking" id="assistant-thinking-bubble">
              <div class="thinking-header">
                <div class="thinking-neural-orb">
                  <div class="orb-core"></div>
                  <div class="orb-ring-1"></div>
                  <div class="orb-ring-2"></div>
                </div>
                <div class="thinking-label">
                  <span class="thinking-title">FinKaif Brain 3.0</span>
                  <span class="thinking-phase-text" id="thinking-phase-text">${thinkingPhases[aiThinkingPhase % thinkingPhases.length]}</span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Prominent Elevated Chat Command Capsule -->
        <div class="chat-input-container">
          <!-- 1-Tap Quick Action Chips Stream right above input -->
          <div class="chat-quick-strip">
            <button type="button" class="chat-quick-chip" data-prompt="Где я могу сэкономить? Найди скрытые утечки">
              <span>${icon("sparkle", 12)}</span> <span>Где сэкономить?</span>
            </button>
            <button type="button" class="chat-quick-chip" data-prompt="Какой прогноз расходов до конца месяца?">
              <span>${icon("trendUp", 12)}</span> <span>Прогноз на месяц</span>
            </button>
            <button type="button" class="chat-quick-chip" data-prompt="Сколько мне отложить в цели в этом месяце?">
              <span>${icon("target", 12)}</span> <span>Сколько в цели?</span>
            </button>
            <button type="button" class="chat-quick-chip" data-prompt="Оцени мой темп трат (Burn Rate)">
              <span>${icon("activity", 12)}</span> <span>Burn Rate</span>
            </button>
            <button type="button" class="chat-quick-chip" data-prompt="На сколько месяцев мне хватит подушки безопасности?">
              <span>${icon("shield", 12)}</span> <span>Подушка</span>
            </button>
          </div>

          <form class="chat-input-bar" id="assistant-form">
            <button type="button" class="btn-voice-assistant" id="btn-voice-assistant" title="Голосовой ввод: нажмите и говорите" aria-label="Голосовой ввод">
              ${icon('mic', 16)}
            </button>
            <div class="input-field-wrapper">
              <input id="assistant-input" placeholder="Спросите совет или командуйте: «Создай цель на отпуск 150к», «Поставь бюджет на кафе 20к»..." required autocomplete="off">
            </div>
            <button type="submit" class="chat-send-btn" id="chat-send-btn" title="Отправить сообщение (Enter)">
              ${icon('send', 15)}
            </button>
          </form>
          <div class="chat-input-meta">
            <span class="input-meta-hint">
              <span class="meta-dot"></span>
              FinKaif Brain 3.0 • Голосовое управление и действия на сайте
            </span>
            <span class="input-meta-kbd"><kbd>Enter ↵</kbd></span>
          </div>
        </div>
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
        <div class="cat-chips-row" style="flex-wrap: wrap;">
          <span class="cat-chip selected" data-cat="Продукты" data-type="expense">${icon("cart", 13)} Продукты</span>
          <span class="cat-chip" data-cat="Рестораны" data-type="expense">${icon("utensils", 13)} Рестораны</span>
          <span class="cat-chip" data-cat="Кафе" data-type="expense">${icon("coffee", 13)} Кафе</span>
          <span class="cat-chip" data-cat="Транспорт" data-type="expense">${icon("car", 13)} Транспорт</span>
          <span class="cat-chip" data-cat="Хобби" data-type="expense">${icon("compass", 13)} Хобби</span>
          <span class="cat-chip" data-cat="Подписки" data-type="expense">${icon("layers", 13)} Подписки</span>
          <span class="cat-chip" data-cat="Здоровье" data-type="expense">${icon("heart", 13)} Здоровье</span>
          <span class="cat-chip" data-cat="Зарплата" data-type="income">${icon("banknote", 13)} Зарплата</span>
          <span class="cat-chip" data-cat="Дивиденды" data-type="income">${icon("trendUp", 13)} Дивиденды</span>
          ${userCategories.map(c => `<span class="cat-chip custom" data-cat="${esc(c)}" data-type="expense">${esc(c)}</span>`).join('')}
          <button type="button" class="cat-chip-add-btn" id="btn-add-custom-cat" title="Создать свою категорию">+ Своя категория</button>
        </div>

        <datalist id="tx-categories-datalist">
          ${allCats.map(c => `<option value="${esc(c)}">`).join('')}
        </datalist>

        <form id="tx-modal-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <div class="modal-type-segmented" id="modal-type-segmented">
              <button type="button" class="segmented-type-btn active" data-type="expense" id="seg-btn-expense">
                <span class="status-dot coral"></span>
                <span>Расход</span>
              </button>
              <button type="button" class="segmented-type-btn" data-type="income" id="seg-btn-income">
                <span class="status-dot jade"></span>
                <span>Поступление</span>
              </button>
            </div>
            <select class="form-select" id="form-type" style="display: none;">
              <option value="expense" selected>Расход</option>
              <option value="income">Поступление</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label">Категория</label>
            <input class="form-input" id="form-category" list="tx-categories-datalist" value="Продукты" placeholder="Напр. Кафе" required>
          </div>

          <!-- Swiss Hero Amount Row -->
          <div class="form-group tx-modal-hero-group">
            <label class="form-label">Сумма операции</label>
            <div class="tx-modal-amount-box">
              <span class="tx-modal-curr-symbol">${currencySymbols[profile.currency] || '₽'}</span>
              <input class="tx-modal-hero-input num" id="form-amount" type="number" min="0.01" step="any" placeholder="0" required inputmode="decimal">
            </div>
            <div class="tx-modal-quick-nudges">
              <button type="button" class="tx-nudge-btn" data-nudge="100">+100</button>
              <button type="button" class="tx-nudge-btn" data-nudge="500">+500</button>
              <button type="button" class="tx-nudge-btn" data-nudge="1000">+1 000</button>
              <button type="button" class="tx-nudge-btn" data-nudge="5000">+5 000</button>
            </div>
            <div id="tx-rub-equivalent" style="font-size: 11px; color: var(--accent-jade); margin-top: 4px; display: none;"></div>
          </div>

          <!-- Date & Time Row -->
          <div class="tx-modal-datetime-grid">
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input class="form-input" id="form-date" type="date" value="${toDateIso(getMskDate())}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Время</label>
              <input class="form-input" id="form-time" type="time" value="${String(getMskDate().getHours()).padStart(2, '0')}:${String(getMskDate().getMinutes()).padStart(2, '0')}" required>
            </div>
          </div>

          <!-- Live Budget Control Indicator -->
          <div id="tx-budget-warning" class="tx-budget-banner" style="display: none;"></div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label" style="margin-bottom: 0;">Описание / Назначение</label>
              <span style="font-size: 11px; color: var(--text-muted);">уточните для ментора</span>
            </div>
            <input class="form-input" id="form-desc" placeholder="Например: Супермаркет, возврат долга, подарок...">
            <div class="desc-quick-tags" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              <button type="button" class="desc-tag-pill" data-text="Подарок">${icon("gift", 12)} Подарок</button>
              <button type="button" class="desc-tag-pill" data-text="Возврат долга">${icon("wallet", 12)} Возврат долга</button>
              <button type="button" class="desc-tag-pill" data-text="На отпуск">${icon("plane", 12)} На отпуск</button>
              <button type="button" class="desc-tag-pill" data-text="Премия">${icon("sparkle", 12)} Премия</button>
            </div>
          </div>

          <button type="submit" class="btn-submit" id="tx-modal-submit-btn">
            Сохранить операцию
          </button>
          <div id="tx-modal-delete-wrap" style="display: none; margin-top: 14px; text-align: center;">
            <button type="button" class="btn-ghost-danger" id="btn-modal-delete-tx">
              ${icon('trash', 14)}
              <span>Удалить эту операцию</span>
            </button>
          </div>
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

  // Swiss minimalist icons system

  return `
    <div id="profile-modal" class="modal-backdrop" style="display: ${profileModalOpen ? 'flex' : 'none'};">
      <div class="modal-card profile-dialog">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${icon("settings", 18)}</span>
            <h3 class="modal-title">Профиль и персонализация</h3>
          </div>
          <button class="btn-icon" id="btn-close-profile">${icon('close', 16)}</button>
        </div>

        <!-- Identity Banner -->
        <div class="profile-identity-banner">
          <div class="profile-big-avatar" id="profile-avatar-preview">
            ${getAvatarHtml(profile.avatar, userInitial, 70)}
          </div>
          <div class="profile-identity-info">
            <div class="profile-name-title">${esc(userName)}</div>
            <div class="profile-email-sub">${esc(me?.email || 'investor@finkaif.ru')}</div>
            <div class="profile-rank-badge">
              <span>${icon(rank.badge, 14)}</span>
              <span>${rank.title}</span>
            </div>
          </div>
        </div>

        <form id="profile-form">
          <!-- Photo Upload & Current Avatar Card -->
          <div class="form-group" style="margin-bottom: 20px;">
            <div class="avatar-section-title">
              <label class="form-label" style="margin-bottom: 0;">Фото профиля</label>
              <span style="font-size: 11px; color: var(--accent-jade); font-weight: 600;">FinKaif 8.60</span>
            </div>

            <label class="avatar-upload-zone" for="input-avatar-upload" title="Нажмите для выбора фото с устройства">
              <div class="avatar-upload-icon">
                ${icon('camera', 22)}
              </div>
              <div>
                <div class="avatar-upload-title">Загрузить фото</div>
                <div class="avatar-upload-sub">PNG, JPG, WebP до 5 МБ (автоматическая оптимизация)</div>
              </div>
              <input type="file" id="input-avatar-upload" accept="image/*" style="display: none;">
            </label>

            ${(profile.avatar && (profile.avatar.startsWith('data:image/') || profile.avatar.startsWith('http'))) ? `
              <div class="avatar-actions-bar">
                <button type="button" class="btn-avatar-reset" id="btn-avatar-reset-default">
                  ${icon('trash', 12)}
                  <span>Вернуть стандартную аватарку</span>
                </button>
              </div>
            ` : ''}
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

            <!-- CBR Exchange Rates Live Banner -->
            <div class="currency-rates-banner">
              <div class="cbr-badge">
                ${icon('sparkle', 12)}
                <span>Курсы ЦБ РФ</span>
              </div>
              <div class="cbr-rates-list" id="cbr-rates-list-el">
                <span>1 $ = ${(currentRates.quotes.USD || 92.5).toFixed(2)} ₽</span>
                <span>1 € = ${(currentRates.quotes.EUR || 101.2).toFixed(2)} ₽</span>
                <span>1 ₸ = ${(currentRates.quotes.KZT || 0.19).toFixed(2)} ₽</span>
              </div>
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
            <div class="password-input-wrap">
              <input class="form-input" id="auth-password" type="password" placeholder="Минимум 6 символов" minlength="6" required>
              <button type="button" class="btn-toggle-pw" id="btn-toggle-password" title="Показать/скрыть пароль" aria-label="Показать или скрыть пароль">
                ${icon('eye', 14)}
              </button>
            </div>
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
function renderMobileBottomBar() {
  const moreTabs = ['budgets', 'goals', 'assistant'];
  const isMoreActive = moreTabs.includes(tab);

  return `
    <nav class="mobile-bottom-bar" role="navigation" aria-label="Мобильная навигация">
      <button class="mobile-nav-btn ${tab === 'home' ? 'active' : ''}" data-tab="home">
        <span class="mobile-nav-icon">${icon('overview', 20)}</span>
        <span class="mobile-nav-label">Обзор</span>
      </button>

      <button class="mobile-nav-btn ${tab === 'analytics' ? 'active' : ''}" data-tab="analytics">
        <span class="mobile-nav-icon">${icon('analytics', 20)}</span>
        <span class="mobile-nav-label">Аналитика</span>
      </button>

      <div class="mobile-fab-wrap">
        <button class="mobile-fab-btn" id="mobile-fab-add" title="Быстрая запись операции">
          ${icon('plus', 22)}
        </button>
      </div>

      <button class="mobile-nav-btn ${tab === 'transactions' ? 'active' : ''}" data-tab="transactions">
        <span class="mobile-nav-icon">${icon('transactions', 20)}</span>
        <span class="mobile-nav-label">Операции</span>
      </button>

      <button class="mobile-nav-btn ${isMoreActive ? 'active' : ''}" id="mobile-more-btn">
        <span class="mobile-nav-icon">
          ${tab === 'budgets' ? icon('budgets', 20) : tab === 'goals' ? icon('goals', 20) : tab === 'assistant' ? icon('assistant', 20) : icon('settings', 20)}
        </span>
        <span class="mobile-nav-label">${tab === 'budgets' ? 'Бюджеты' : tab === 'goals' ? 'Цели' : tab === 'assistant' ? 'ИИ' : 'Ещё'}</span>
      </button>
    </nav>

    <!-- Mobile More Drawer Sheet -->
    <div id="mobile-more-sheet" class="mobile-sheet-backdrop" style="display: none;">
      <div class="mobile-sheet-card">
        <div class="mobile-sheet-handle"></div>
        <div class="mobile-sheet-header">
          <span class="mobile-sheet-title">Разделы и сервисы</span>
          <button class="btn-icon" id="btn-close-mobile-sheet">${icon('close', 16)}</button>
        </div>
        <div class="mobile-sheet-grid">
          <button class="mobile-sheet-item ${tab === 'budgets' ? 'active' : ''}" data-tab="budgets">
            <div class="mobile-sheet-item-icon">${icon('budgets', 20)}</div>
            <div class="mobile-sheet-item-info">
              <span class="mobile-sheet-item-name">Лимиты бюджета</span>
              <span class="mobile-sheet-item-sub">Контроль месячных расходов</span>
            </div>
          </button>
          <button class="mobile-sheet-item ${tab === 'goals' ? 'active' : ''}" data-tab="goals">
            <div class="mobile-sheet-item-icon">${icon('goals', 20)}</div>
            <div class="mobile-sheet-item-info">
              <span class="mobile-sheet-item-name">Финансовые цели</span>
              <span class="mobile-sheet-item-sub">Копилки и резервный капитал</span>
            </div>
          </button>
          <button class="mobile-sheet-item ${tab === 'assistant' ? 'active' : ''}" data-tab="assistant">
            <div class="mobile-sheet-item-icon">${icon('assistant', 20)}</div>
            <div class="mobile-sheet-item-info">
              <span class="mobile-sheet-item-name">ИИ-Ментор FinKaif</span>
              <span class="mobile-sheet-item-sub">Советы по распределению средств</span>
            </div>
          </button>
          <button class="mobile-sheet-item" id="mobile-sheet-profile-btn">
            <div class="mobile-sheet-item-icon">${icon("settings", 18)}</div>
            <div class="mobile-sheet-item-info">
              <span class="mobile-sheet-item-name">Профиль и настройки</span>
              <span class="mobile-sheet-item-sub">Аватар, валюта, аккаунт</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderPaydayModal() {
  if (!paydaySplitData) return '';
  const amt = Number(paydaySplitData.amount) || 0;
  const savings = Math.round(amt * 0.20);
  const needs = Math.round(amt * 0.50);
  const wants = Math.round(amt * 0.30);
  const primaryGoal = (data.goals || [])[0] || null;

  return `
    <div id="payday-modal" class="modal-backdrop" style="display: flex;">
      <div class="modal-card payday-card">
        <div class="payday-header">
          <div class="payday-confetti-star">${icon("sparkles", 32)}</div>
          <h3 class="payday-title">Отличное поступление!</h3>
          <div class="payday-amt-badge num">+${new Intl.NumberFormat('ru-RU').format(amt)} ₽</div>
          <p class="payday-subtitle">Время защитить доход по формуле <strong>50 / 30 / 20</strong> — «Сначала заплати себе».</p>
        </div>

        <div class="payday-split-grid">
          <div class="payday-split-item box-savings">
            <div class="payday-split-icon">${icon("shield", 20)}</div>
            <div class="payday-split-content">
              <div class="payday-split-label">20% — Сбережения и цели</div>
              <div class="payday-split-val num">+${new Intl.NumberFormat('ru-RU').format(savings)} ₽</div>
              <div class="payday-split-hint">Резервная подушка и инвестиции</div>
            </div>
          </div>

          <div class="payday-split-item box-needs">
            <div class="payday-split-icon">${icon("home", 20)}</div>
            <div class="payday-split-content">
              <div class="payday-split-label">50% — Базовые расходы</div>
              <div class="payday-split-val num">+${new Intl.NumberFormat('ru-RU').format(needs)} ₽</div>
              <div class="payday-split-hint">Жильё, продукты, счета, обязательства</div>
            </div>
          </div>

          <div class="payday-split-item box-wants">
            <div class="payday-split-icon">${icon("sparkle", 20)}</div>
            <div class="payday-split-content">
              <div class="payday-split-label">30% — Свободный кайф</div>
              <div class="payday-split-val num">+${new Intl.NumberFormat('ru-RU').format(wants)} ₽</div>
              <div class="payday-split-hint">Рестораны, покупки и радости жизни</div>
            </div>
          </div>
        </div>

        <div class="payday-actions-footer">
          ${primaryGoal ? `
            <button class="btn-primary" id="btn-payday-split-goal" data-goal-id="${primaryGoal.id}" data-split-amt="${savings}">
              ${icon('sparkle', 16)}
              <span>Отложить 20% (+${new Intl.NumberFormat('ru-RU').format(savings)} ₽) в «${esc(primaryGoal.name)}»</span>
            </button>
          ` : `
            <button class="btn-primary" id="btn-payday-create-goal">
              ${icon('sparkle', 16)}
              <span>Создать цель для 20% сбережений</span>
            </button>
          `}
          <button type="button" class="btn-ghost" id="btn-close-payday">
            Спасибо, распределю самостоятельно
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderFinScoreModal() {
  const fs = calculateFinScore();
  const tips = [];
  if (fs.sCushion < 20) tips.push('Пополните цель накоплений, чтобы увеличить подушку безопасности до 3–6 месяцев.');
  if (fs.sBudgets < 20) tips.push('Установите лимиты бюджета на основные категории (Продукты, Кафе) для контроля трат.');
  if (fs.sSavings < 15) tips.push('Направляйте хотя бы 15–20% от каждого дохода в сбережения.');
  if (fs.bal < 0) tips.push('Расходы превысили доходы — сократите необязательные траты до восстановления баланса.');
  if (tips.length === 0) tips.push('Ваши показатели на высоте! Капитал защищен, баланс положителен, дисциплина в норме.');

  return `
    <div id="finscore-modal" class="modal-backdrop" style="display: ${finscoreModalOpen ? 'flex' : 'none'};">
      <div class="modal-card finscore-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="modal-header-icon-badge" style="background: rgba(45, 212, 191, 0.12); color: #2DD4BF;">
              ${icon('pulse', 18)}
            </div>
            <div>
              <h3 class="modal-title">Индекс финансового здоровья FinScore</h3>
              <p class="modal-subtitle">Объективная оценка надежности ваших личных финансов от 0 до 100</p>
            </div>
          </div>
          <button type="button" class="btn-icon" id="btn-close-finscore-modal">${icon('close', 16)}</button>
        </div>

        <div class="finscore-modal-body">
          <!-- Main Score Gauge -->
          <div class="finscore-hero-display">
            <div class="finscore-big-dial">
              <span class="finscore-big-num ${fs.badgeClass}">${fs.score}</span>
              <span class="finscore-big-max">/ 100</span>
            </div>
            <div class="finscore-hero-status">
              <span class="finscore-badge ${fs.badgeClass}" style="font-size: 13px; padding: 4px 12px;">${fs.label} уровень</span>
              <p class="finscore-desc">
                ${fs.score >= 80 ? 'Ваши финансы в превосходной форме: высокий запас прочности и отличная дисциплина.' : (fs.score >= 60 ? 'Хорошая устойчивость, но есть точки роста в накоплениях или контроле бюджета.' : 'Требуется внимание: подушка безопасности недостаточна или расходы превышают поступления.')}
              </p>
            </div>
          </div>

          <!-- Factor Breakdown Grid -->
          <div class="finscore-breakdown-list">
            <div class="finscore-factor-row">
              <div class="finscore-factor-head">
                <span class="factor-name">${icon("shield", 13)} Подушка безопасности (Runway)</span>
                <span class="factor-pts num">${fs.sCushion} / 25 б.</span>
              </div>
              <div class="finscore-progress-bar">
                <div class="finscore-progress-fill" style="width: ${(fs.sCushion / 25) * 100}%; background: #2DD4BF;"></div>
              </div>
              <div class="factor-subtext">Текущего капитала хватит на <strong>${fs.runway} мес.</strong> автономной жизни (цель: от 3–6 мес.).</div>
            </div>

            <div class="finscore-factor-row">
              <div class="finscore-factor-head">
                <span class="factor-name">${icon("trendUp", 13)} Норма сбережений (Savings Rate)</span>
                <span class="factor-pts num">${fs.sSavings} / 25 б.</span>
              </div>
              <div class="finscore-progress-bar">
                <div class="finscore-progress-fill" style="width: ${(fs.sSavings / 25) * 100}%; background: #34D399;"></div>
              </div>
              <div class="factor-subtext">Вы сохраняете <strong>${fs.savingsRate}%</strong> от совокупного дохода (рекомендуемый ориентир: от 20%).</div>
            </div>

            <div class="finscore-factor-row">
              <div class="finscore-factor-head">
                <span class="factor-name">${icon("chart", 13)} Контроль лимитов бюджета</span>
                <span class="factor-pts num">${fs.sBudgets} / 25 б.</span>
              </div>
              <div class="finscore-progress-bar">
                <div class="finscore-progress-fill" style="width: ${(fs.sBudgets / 25) * 100}%; background: #60A5FA;"></div>
              </div>
              <div class="factor-subtext">${data.budgets.length > 0 ? `Установлено <strong>${data.budgets.length} лимитов</strong> на расходы.` : 'Лимиты еще не настроены. Добавьте лимиты во вкладке «Бюджет».'}</div>
            </div>

            <div class="finscore-factor-row">
              <div class="finscore-factor-head">
                <span class="factor-name">${icon("gem", 13)} Профицит и чистота капитала</span>
                <span class="factor-pts num">${fs.sCapital} / 25 б.</span>
              </div>
              <div class="finscore-progress-bar">
                <div class="finscore-progress-fill" style="width: ${(fs.sCapital / 25) * 100}%; background: ${fs.bal >= 0 ? '#10B981' : '#F43F5E'};"></div>
              </div>
              <div class="factor-subtext">${fs.bal >= 0 ? 'Чистый баланс положителен, нет кассовых разрывов.' : 'Внимание: расходы превысили доходы (дефицит капитала).'}</div>
            </div>
          </div>

          <!-- Recommendations Box -->
          <div class="finscore-tips-box">
            <div class="finscore-tips-title">${icon("sparkle", 14)} Персональный совет ментора:</div>
            <ul class="finscore-tips-list">
              ${tips.map(t => `<li>${esc(t)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBulkDock() {
  if (tab !== 'transactions' || selectedTxIds.size === 0) return '';
  const filtered = (data.transactions || []).filter(t => selectedTxIds.has(t.id));
  const bulkSum = filtered.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  return `
    <div class="tx-bulk-dock" id="tx-bulk-dock">
      <div class="tx-bulk-info">
        <span class="tx-bulk-badge">Выбрано: <strong>${selectedTxIds.size}</strong></span>
        <span class="tx-bulk-dot">•</span>
        <span class="tx-bulk-sum ${bulkSum >= 0 ? 'inc' : 'exp'}">
          Сумма: ${bulkSum >= 0 ? '+' : '−'}${money(Math.abs(bulkSum))}
        </span>
      </div>
      <div class="tx-bulk-actions">
        <button type="button" class="btn-bulk-sec" id="btn-bulk-select-all">Все (${(data.transactions || []).length})</button>
        <button type="button" class="btn-bulk-sec" id="btn-bulk-deselect">Снять</button>
        <button type="button" class="btn-bulk-delete" id="btn-bulk-delete">
          ${icon('trash', 14)}
          <span>Удалить (${selectedTxIds.size})</span>
        </button>
      </div>
    </div>
  `;
}

function getViewHtmlForTab(targetTab) {
  if (targetTab === 'home') return renderHomeView();
  if (targetTab === 'analytics') return renderAnalyticsView();
  if (targetTab === 'transactions') return renderTransactionsView();
  if (targetTab === 'budgets') return renderBudgetsView();
  if (targetTab === 'goals') return renderGoalsView();
  if (targetTab === 'assistant') return renderAssistantView();
  return renderHomeView();
}

function updateMastheadDynamicData() {
  const inc = data.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const exp = data.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = inc - exp;

  const rawUser = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';
  const userName = profile.display_name ? profile.display_name : rawUser;
  const userInitial = rawUser.charAt(0).toUpperCase();

  const nameEl = document.querySelector('.user-name-text') || document.querySelector('.user-name');
  if (nameEl) nameEl.innerText = userName;

  const avatarEl = document.querySelector('.user-avatar');
  if (avatarEl) avatarEl.innerHTML = getAvatarHtml(profile.avatar, userInitial, 36);

  const balEl = document.getElementById('masthead-balance-figure');
  if (balEl) {
    balEl.textContent = money(balance);
  }

  const privBtn = document.getElementById('btn-toggle-privacy');
  if (privBtn) {
    privBtn.classList.toggle('active', !!privacyMode);
    privBtn.innerHTML = privacyMode ? icon('eyeOff', 14) : icon('eye', 14);
    privBtn.title = privacyMode ? 'Показать баланс' : 'Скрыть баланс';
  }

  const mastPill = document.getElementById('masthead-balance-pill');
  if (mastPill) {
    mastPill.title = privacyMode ? 'Показать баланс (горячая клавиша P)' : 'Скрыть баланс (горячая клавиша P)';
  }

  const deltaEl = document.querySelector('.masthead .balance-delta');
  if (deltaEl) {
    deltaEl.style.display = privacyMode ? 'none' : '';
  }
}

function switchTab(newTab, options = {}) {
  if (!me) {
    tab = newTab;
    renderApp();
    return;
  }
  const appContainer = document.querySelector('.app-container');
  const viewContainer = document.querySelector('.view-container');
  if (!appContainer || !viewContainer) {
    tab = newTab;
    window.location.hash = tab;
    renderApp();
    return;
  }

  if (tab !== newTab && newTab !== 'transactions') {
    selectedTxIds.clear();
  }
  tab = newTab;
  window.location.hash = tab;

  // 1. Update navigation active state without re-rendering masthead
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });

  // 2. Smoothly reposition magnetic spring glider
  if (typeof initNavGlider === 'function') {
    initNavGlider();
  }

  // 3. Update mobile bottom bar active state
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });

  // 4. Update bulk dock
  const existingDock = document.getElementById('tx-bulk-dock');
  if (tab !== 'transactions' || selectedTxIds.size === 0) {
    if (existingDock) existingDock.remove();
  } else {
    if (!existingDock) {
      const dWrap = document.createElement('div');
      dWrap.innerHTML = renderBulkDock();
      if (dWrap.firstElementChild) appContainer.appendChild(dWrap.firstElementChild);
    } else {
      existingDock.outerHTML = renderBulkDock();
    }
  }

  // 5. Swap view content smoothly with View Transitions API or direct swap
  const nextHtml = getViewHtmlForTab(tab);

  const performSwap = () => {
    viewContainer.innerHTML = nextHtml;
    viewContainer.classList.remove('view-enter-active');
    void viewContainer.offsetWidth; // Force micro reflow
    viewContainer.classList.add('view-enter-active');
    bindInteractiveEvents();
    if (!options.keepScroll) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  if (document.startViewTransition) {
    document.startViewTransition(performSwap);
  } else {
    performSwap();
  }
}
window.switchTab = switchTab;

function renderApp() {
  window.renderApp = renderApp;
  window.openPaydayModal = (amt = 1000000) => {
    paydaySplitData = { amount: amt };
    renderApp();
  };
  const container = document.getElementById('app');
  if (!container) return;

  if (!me) {
    container.innerHTML = renderAuthScreen();
    bindAuthEvents();
    return;
  }

  const appContainer = container.querySelector('.app-container');
  const viewContainer = container.querySelector('.view-container');

  // If App Shell is already in DOM, perform smooth in-place update without nuking DOM
  if (appContainer && viewContainer) {
    updateMastheadDynamicData();
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    if (typeof initNavGlider === 'function') initNavGlider();
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    const existingDock = document.getElementById('tx-bulk-dock');
    if (tab !== 'transactions' || selectedTxIds.size === 0) {
      if (existingDock) existingDock.remove();
    } else {
      if (existingDock) existingDock.outerHTML = renderBulkDock();
      else {
        const dWrap = document.createElement('div');
        dWrap.innerHTML = renderBulkDock();
        if (dWrap.firstElementChild) appContainer.appendChild(dWrap.firstElementChild);
      }
    }

    viewContainer.innerHTML = getViewHtmlForTab(tab);

    // Update dynamic modals if present
    const pModal = document.getElementById('profile-modal');
    if (pModal) pModal.outerHTML = renderProfileModal();
    const payModal = document.getElementById('payday-modal');
    if (payModal) payModal.outerHTML = renderPaydayModal();
    const fsModal = document.getElementById('finscore-modal');
    if (fsModal) fsModal.outerHTML = renderFinScoreModal();

    bindInteractiveEvents();
    return;
  }

  // Initial Full Mount
  let viewHtml = getViewHtmlForTab(tab);

  container.innerHTML = `
    <div class="app-container">
      ${renderMasthead()}
      <main>
        <div class="view-container">
          ${viewHtml}
        </div>
      </main>
      ${renderMobileBottomBar()}
      ${renderBulkDock()}
      ${renderModal()}
      ${renderProfileModal()}
      ${renderPaydayModal()}
      ${renderSubscriptionModal()}
      ${renderImportBankModal()}
      ${renderFinScoreModal()}
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

  const btnTogglePw = document.getElementById('btn-toggle-password');
  if (btnTogglePw) {
    btnTogglePw.onclick = () => {
      const pwInput = document.getElementById('auth-password');
      if (pwInput) {
        const isPw = pwInput.type === 'password';
        pwInput.type = isPw ? 'text' : 'password';
        btnTogglePw.innerHTML = isPw ? icon('eyeOff', 14) : icon('eye', 14);
      }
    };
  }

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

        // Fetch authoritative profile settings from cloud database
        try {
          const prof = await api('profile');
          if (prof) {
            profile.display_name = prof.display_name || '';
            profile.avatar = prof.avatar || 'default';
            if (prof.currency) profile.currency = prof.currency;
            try {
              localStorage.setItem('finkaif_name', profile.display_name);
              localStorage.setItem('finkaif_avatar', profile.avatar);
              localStorage.setItem('finkaif_currency', profile.currency);
            } catch (_) {}
          }
        } catch { }

        await refreshAllData();
        renderApp();
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
      }
    };
  }
}

function bindInteractiveEvents() {
  initSpotlightCards();

  // Kinetic Number Tickers on Home View
  if (tab === 'home' && !privacyMode) {
    const cur = profile.currency || 'RUB';
    const sym = (cur === 'USD' || cur === 'EUR') ? '' : ` ${currencySymbols[cur] || '₽'}`;
    const curPrefix = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';

    const heroBalEl = document.getElementById('hero-balance-val');
    if (heroBalEl) {
      const incTot = data.transactions.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
      const expTot = data.transactions.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
      const savedInGoals = (data.goals || []).reduce((s, g) => s + Number(g.saved_amount || 0), 0);
      const balInRub = incTot - expTot - savedInGoals;
      const balConv = convertFromRub(balInRub);
      animateNumber(heroBalEl, balConv, 650, curPrefix, sym);
    }
    const mastBalEl = document.getElementById('masthead-balance-figure');
    if (mastBalEl) {
      const incTot = data.transactions.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
      const expTot = data.transactions.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
      const balInRub = incTot - expTot;
      const balConv = convertFromRub(balInRub);
      animateNumber(mastBalEl, balConv, 650, curPrefix, sym);
    }
    const statIncEl = document.getElementById('stat-amount-inc');
    if (statIncEl) {
      let pInc = 0;
      if (period === '7d') {
        const mskNow = getMskDate();
        const dow = mskNow.getDay();
        const dayFromMonday = dow === 0 ? 6 : dow - 1;
        const monday = new Date(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate() - dayFromMonday);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        const monIso = toDateIso(monday);
        const sunIso = toDateIso(sunday);
        pInc = data.transactions.filter(x => {
          const iso = getTxIso(x);
          return x.type === 'income' && iso >= monIso && iso <= sunIso;
        }).reduce((s, x) => s + Number(x.amount), 0);
      } else {
        const now = getMskDate();
        let days = period === '30d' ? 30 : 365;
        const cut = new Date(now.getTime() - days * 86400000);
        pInc = data.transactions.filter(x => x.type === 'income' && new Date(getTxIso(x)) >= cut).reduce((s, x) => s + Number(x.amount), 0);
      }
      const pIncConv = convertFromRub(pInc);
      animateNumber(statIncEl, pIncConv, 650, `+${curPrefix}`, sym);
    }
    const statExpEl = document.getElementById('stat-amount-exp');
    if (statExpEl) {
      let pExp = 0;
      if (period === '7d') {
        const mskNow = getMskDate();
        const dow = mskNow.getDay();
        const dayFromMonday = dow === 0 ? 6 : dow - 1;
        const monday = new Date(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate() - dayFromMonday);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        const monIso = toDateIso(monday);
        const sunIso = toDateIso(sunday);
        pExp = data.transactions.filter(x => {
          const iso = getTxIso(x);
          return x.type === 'expense' && iso >= monIso && iso <= sunIso;
        }).reduce((s, x) => s + Number(x.amount), 0);
      } else {
        const now = getMskDate();
        let days = period === '30d' ? 30 : 365;
        const cut = new Date(now.getTime() - days * 86400000);
        pExp = data.transactions.filter(x => x.type === 'expense' && new Date(getTxIso(x)) >= cut).reduce((s, x) => s + Number(x.amount), 0);
      }
      const pExpConv = convertFromRub(pExp);
      animateNumber(statExpEl, pExpConv, 650, `−${curPrefix}`, sym);
    }
  }

  // Navigation Tabs (Zero-Blink Smooth Switching)
  $$('.nav-item').forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-tab');
      if (target) switchTab(target);
    };
  });

  // Magnetic Navigation Glider
  initNavGlider();

  $$('[data-tab]').forEach(el => {
    if (!el.classList.contains('nav-item')) {
      el.onclick = () => {
        const target = el.getAttribute('data-tab');
        if (el.getAttribute('data-cat')) {
          activeAnalyticsCat = el.getAttribute('data-cat');
        }
        if (target) switchTab(target);
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

  // Custom Photo Upload & Reset Handlers
  const rawUser = me ? (me.email ? me.email.split('@')[0] : 'Пользователь') : 'Гость';
  const userInitial = rawUser.charAt(0).toUpperCase();

  const updateModalAvatarPreview = () => {
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) {
      preview.innerHTML = getAvatarHtml(profile.avatar, userInitial, 70);
    }
    const mastAv = document.querySelector('.user-avatar');
    if (mastAv) {
      mastAv.innerHTML = getAvatarHtml(profile.avatar, userInitial, 36);
    }
  };

  const inputUpload = document.getElementById('input-avatar-upload');
  if (inputUpload) {
    inputUpload.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите файл изображения (PNG, JPG, WebP).', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let w = img.width;
          let h = img.height;
          const minDim = Math.min(w, h);
          const sx = (w - minDim) / 2;
          const sy = (h - minDim) / 2;

          canvas.width = MAX_SIZE;
          canvas.height = MAX_SIZE;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, MAX_SIZE, MAX_SIZE);

          profile.avatar = canvas.toDataURL('image/jpeg', 0.85);
          try {
            localStorage.setItem('finkaif_avatar', profile.avatar);
          } catch (_) {}
          updateModalAvatarPreview();
          updateMastheadDynamicData();
          renderApp();
          const pm = document.getElementById('profile-modal');
          if (pm) pm.style.display = 'flex';

          // Instantly sync to cloud database (PostgreSQL)
          try {
            await api('profile', {
              method: 'POST',
              body: JSON.stringify({
                display_name: profile.display_name,
                avatar: profile.avatar,
                currency: profile.currency
              })
            });
            showToast('Фото профиля сохранено в облаке', 'success');
          } catch (err) {
            console.warn('Avatar auto-sync notice:', err.message);
          }
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  const btnResetAv = document.getElementById('btn-avatar-reset-default');
  if (btnResetAv) {
    btnResetAv.onclick = async () => {
      profile.avatar = 'default';
      try {
        localStorage.setItem('finkaif_avatar', 'default');
      } catch (_) {}
      updateModalAvatarPreview();
      updateMastheadDynamicData();
      try {
        await api('profile', {
          method: 'POST',
          body: JSON.stringify({
            display_name: profile.display_name,
            avatar: 'default',
            currency: profile.currency
          })
        });
        showToast('Стандартный аватар восстановлен и синхронизирован', 'success');
      } catch (err) {
        console.warn('Avatar reset notice:', err.message);
      }
      renderApp();
      const pm = document.getElementById('profile-modal');
      if (pm) pm.style.display = 'flex';
    };
  }

  // Currency Selection with Live Instant Conversion and Cloud Sync
  $$('.currency-pill-btn').forEach(btn => {
    btn.onclick = async () => {
      const cur = btn.getAttribute('data-currency');
      profile.currency = cur;
      try {
        localStorage.setItem('finkaif_currency', profile.currency);
      } catch (_) {}
      api('profile', {
        method: 'POST',
        body: JSON.stringify({
          display_name: profile.display_name,
          avatar: profile.avatar,
          currency: profile.currency
        })
      }).catch(() => {});
      renderApp();
      const pm = document.getElementById('profile-modal');
      if (pm) pm.style.display = 'flex';
    };
  });

  // Profile Form Save
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async e => {
      e.preventDefault();
      const inputName = document.getElementById('profile-input-name');
      profile.display_name = inputName ? inputName.value.trim() : '';

      try {
        const savedProf = await api('profile', {
          method: 'POST',
          body: JSON.stringify({
            display_name: profile.display_name,
            avatar: profile.avatar,
            currency: profile.currency
          })
        });
        if (savedProf) {
          profile.display_name = savedProf.display_name || profile.display_name;
          profile.avatar = savedProf.avatar || profile.avatar;
          profile.currency = savedProf.currency || profile.currency;
        }

        try {
          localStorage.setItem('finkaif_name', profile.display_name);
          localStorage.setItem('finkaif_avatar', profile.avatar);
          localStorage.setItem('finkaif_currency', profile.currency);
        } catch (_) {}
        updateMastheadDynamicData();
        showToast('Профиль сохранён и синхронизирован со всеми устройствами', 'success');
      } catch (err) {
        showToast('Ошибка сохранения профиля: ' + err.message, 'error');
      }

      profileModalOpen = false;
      renderApp();
    };
  }

  // Profile Logout
  const btnProfileLogout = document.getElementById('btn-profile-logout');
  if (btnProfileLogout) {
    btnProfileLogout.onclick = async () => {
      const confirmed = await showConfirmDialog({
        title: 'Выход из аккаунта',
        message: 'Вы действительно хотите завершить текущую сессию в FinKaif OS?',
        confirmText: 'Выйти',
        cancelText: 'Отмена',
        danger: true,
        icon: 'logout'
      });
      if (confirmed) {
        await api('auth/logout', { method: 'POST' }).catch(() => {});
        try {
          localStorage.removeItem('finkaif_token');
          localStorage.removeItem('finkaif_name');
          localStorage.removeItem('finkaif_avatar');
          localStorage.removeItem('finkaif_currency');
        } catch (_) {}
        me = null;
        profile = {
          display_name: '',
          avatar: 'default',
          currency: 'RUB'
        };
        profileModalOpen = false;
        renderApp();
      }
    };
  }

  // Period Tabs on Home View
  $$('.period-tab[data-period]').forEach(btn => {
    btn.onclick = () => {
      period = btn.getAttribute('data-period');
      customRangeOpen = false;
      renderApp();
    };
  });

  const btnToggleHomeCustom = document.getElementById('btn-toggle-custom-period');
  if (btnToggleHomeCustom) {
    btnToggleHomeCustom.onclick = () => {
      customRangeOpen = !customRangeOpen;
      const bar = document.getElementById('home-custom-range-bar');
      if (bar) bar.style.display = customRangeOpen ? 'flex' : 'none';
    };
  }

  const btnApplyHomeRange = document.getElementById('btn-apply-home-range');
  if (btnApplyHomeRange) {
    btnApplyHomeRange.onclick = () => {
      const f = document.getElementById('custom-range-from')?.value;
      const t = document.getElementById('custom-range-to')?.value;
      if (f && t) {
        customRange = { from: f, to: t };
        period = 'custom';
        customRangeOpen = false;
        renderApp();
      }
    };
  }

  const btnCloseHomeRange = document.getElementById('btn-close-home-range');
  if (btnCloseHomeRange) {
    btnCloseHomeRange.onclick = () => {
      customRangeOpen = false;
      const bar = document.getElementById('home-custom-range-bar');
      if (bar) bar.style.display = 'none';
    };
  }

  // Analytics Period Buttons
  $$('.analytics-period-btn[data-aperiod]').forEach(btn => {
    btn.onclick = () => {
      analyticsPeriod = btn.getAttribute('data-aperiod');
      if (analyticsPeriod !== 'custom') customRangeOpen = false;
      renderApp();
    };
  });

  const btnAnalyticsCustom = document.getElementById('btn-analytics-custom-toggle');
  if (btnAnalyticsCustom) {
    btnAnalyticsCustom.onclick = () => {
      customRangeOpen = !customRangeOpen;
      analyticsPeriod = 'custom';
      const bar = document.getElementById('analytics-custom-range-bar');
      if (bar) bar.style.display = customRangeOpen ? 'flex' : 'none';
    };
  }

  const btnApplyAnalyticsRange = document.getElementById('btn-apply-analytics-range');
  if (btnApplyAnalyticsRange) {
    btnApplyAnalyticsRange.onclick = () => {
      const f = document.getElementById('analytics-custom-range-from')?.value;
      const t = document.getElementById('analytics-custom-range-to')?.value;
      if (f && t) {
        customRange = { from: f, to: t };
        analyticsPeriod = 'custom';
        customRangeOpen = false;
        renderApp();
      }
    };
  }

  const btnCloseAnalyticsRange = document.getElementById('btn-close-analytics-range');
  if (btnCloseAnalyticsRange) {
    btnCloseAnalyticsRange.onclick = () => {
      customRangeOpen = false;
      const bar = document.getElementById('analytics-custom-range-bar');
      if (bar) bar.style.display = 'none';
    };
  }

  // FinScore Modal Triggers
  $$('.assistant-finscore-widget, .hero-balance-badge, .finscore-badge').forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = (e) => {
      e.stopPropagation();
      finscoreModalOpen = true;
      const m = document.getElementById('finscore-modal');
      if (m) m.style.display = 'flex';
      else renderApp();
    };
  });

  const btnCloseFinscore = document.getElementById('btn-close-finscore-modal');
  if (btnCloseFinscore) {
    btnCloseFinscore.onclick = () => {
      finscoreModalOpen = false;
      const m = document.getElementById('finscore-modal');
      if (m) m.style.display = 'none';
    };
  }

  const finscoreModal = document.getElementById('finscore-modal');
  if (finscoreModal) {
    finscoreModal.onclick = (e) => {
      if (e.target === finscoreModal) {
        finscoreModalOpen = false;
        finscoreModal.style.display = 'none';
      }
    };
  }

  // Custom Category Add in Modal (Using In-App Custom Prompt)
  const btnAddCustomCat = document.getElementById('btn-add-custom-cat');
  if (btnAddCustomCat) {
    btnAddCustomCat.onclick = async () => {
      const name = await showPromptDialog({
        title: 'Новая категория',
        message: 'Введите название для персональной категории расходов или доходов:',
        placeholder: 'Например: Питомцы, Игры, Обучение',
        confirmText: 'Создать',
        cancelText: 'Отмена',
        icon: 'sparkle'
      });
      if (name && name.trim()) {
        const formatted = addCustomCategory(name.trim());
        const catInput = document.getElementById('form-category');
        if (catInput) catInput.value = formatted;
        renderApp();
        const modal = document.getElementById('tx-modal');
        if (modal) modal.style.display = 'flex';
        showToast(`Категория «${formatted}» добавлена!`, 'success');
      }
    };
  }

  // Description Tag Pills in Modal
  $$('.desc-tag-pill').forEach(pill => {
    pill.onclick = () => {
      const tagText = pill.getAttribute('data-text');
      const descInput = document.getElementById('form-desc');
      if (descInput && tagText) {
        descInput.value = descInput.value ? `${descInput.value}, ${tagText}` : tagText;
        descInput.focus();
      }
    };
  });

  // Source Switcher in Bank Import Modal
  $$('.import-source-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.import-source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const imode = btn.getAttribute('data-imode');
      const presetsBar = document.querySelector('.import-presets-bar');
      const dropTitle = document.getElementById('drop-zone-title');
      if (imode === 'archive') {
        if (presetsBar) presetsBar.style.display = 'none';
        if (dropTitle) dropTitle.innerText = 'Перетащите Excel, TXT или файл из другой программы сюда';
      } else {
        if (presetsBar) presetsBar.style.display = 'flex';
        if (dropTitle) dropTitle.innerText = 'Перетащите файл банковской выписки сюда';
      }
    };
  });

  // Analytics Donut Segment & Legend In-Place Hover Interactions
  const updateDonutCenter = (cat, amt, pct) => {
    const center = document.getElementById('donut-center-info');
    if (!center) return;
    if (cat) {
      const catIcon = getCategoryIcon(cat, 'expense', 20);
      center.innerHTML = `
        <div class="donut-center-icon">${catIcon}</div>
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

  const highlightCategory = (cat, amt, pct) => {
    updateDonutCenter(cat, amt, pct);
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

    seg.onmouseenter = () => highlightCategory(cat, amt, pct);
    seg.onmouseleave = () => {
      if (activeAnalyticsCat) {
        const actSeg = document.querySelector(`.donut-segment[data-cat="${activeAnalyticsCat}"]`);
        if (actSeg) {
          highlightCategory(
            activeAnalyticsCat,
            actSeg.getAttribute('data-amt'),
            actSeg.getAttribute('data-pct')
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

    item.onmouseenter = () => highlightCategory(cat, amt, pct);
    item.onmouseleave = () => {
      if (activeAnalyticsCat) {
        const actSeg = document.querySelector(`.donut-segment[data-cat="${activeAnalyticsCat}"]`);
        if (actSeg) {
          highlightCategory(
            activeAnalyticsCat,
            actSeg.getAttribute('data-amt'),
            actSeg.getAttribute('data-pct')
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
  const homeDayBreakdown = document.getElementById('home-day-breakdown');
  const heroBalVal = document.getElementById('hero-balance-val');
  const heroBalLbl = document.getElementById('hero-balance-lbl');

  if (homeWrap && homeTooltip && window.__homePoints && window.__homePoints.length > 0) {
    const pts = window.__homePoints;
    const dayBuckets = window.__homeDayBuckets || [];
    const svgW = window.__homeSvgW || 760;
    const svgH = window.__homeSvgH || 120;
    const padX = window.__homePadX || 28;
    const plotW = window.__homePlotW || (svgW - 2 * padX);
    const plotCanvasH = 122;
    const baseBalText = heroBalVal ? heroBalVal.getAttribute('data-base') : '';
    const segments = pts.__splineSegments || [];
    const N = pts.length;
    const currentPeriod = window.__homePeriod || '7d';

    // Midpoints between adjacent dates for exact day mapping
    const mids = [];
    for (let i = 0; i < N - 1; i++) {
      mids.push((pts[i].x + pts[i + 1].x) / 2);
    }

    const formatOpsCount = (n) => {
      const abs = Math.abs(n) % 100;
      const num = abs % 10;
      if (abs > 10 && abs < 20) return `${n} операций`;
      if (num > 1 && num < 5) return `${n} операции`;
      if (num === 1) return `${n} операция`;
      return `${n} операций`;
    };

    let lastScrubbedDayIdx = -1;

    const handleHomeScrub = (clientX) => {
      const rect = homeWrap.getBoundingClientRect();
      if (!rect.width || rect.width <= 0) return;

      const mousePxX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const targetSvgX = (mousePxX / rect.width) * svgW;
      const minX = pts[0].x;
      const maxX = pts[pts.length - 1].x;
      const clampedX = Math.max(minX, Math.min(targetSvgX, maxX));

      // Continuous Bezier Spline evaluation for visual Y along curve
      let seg = segments.find(s => clampedX >= s.x0 && clampedX <= s.x1);
      if (!seg) {
        if (clampedX <= minX) seg = segments[0];
        else seg = segments[segments.length - 1];
      }

      let svgY = seg ? seg.y0 : 60;
      if (seg) {
        const segSpan = seg.x1 - seg.x0 || 1;
        const t = Math.max(0, Math.min(1, (clampedX - seg.x0) / segSpan));
        svgY = evaluateBezierY(seg.y0, seg.cp1y, seg.cp2y, seg.y1, t);
      }

      // Identify active Day
      let dayIdx = 0;
      if (clampedX <= mids[0]) {
        dayIdx = 0;
      } else if (clampedX >= mids[N - 2]) {
        dayIdx = N - 1;
      } else {
        for (let i = 0; i < mids.length - 1; i++) {
          if (clampedX >= mids[i] && clampedX <= mids[i + 1]) {
            dayIdx = i + 1;
            break;
          }
        }
      }

      if (dayIdx !== lastScrubbedDayIdx) {
        lastScrubbedDayIdx = dayIdx;
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(4);
          }
        } catch (_) {}
      }

      const activePt = pts[dayIdx] || pts[0];
      const bucket = dayBuckets[dayIdx] || activePt;

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

      // Clear solid day balance in hero card
      if (heroBalVal) {
        heroBalVal.innerText = money(activePt.balance);
      }
      if (heroBalLbl) {
        heroBalLbl.innerText = `Остаток на ${esc(activePt.dayDisplay || activePt.dayLabel)}`;
      }

      // Calculate totals for this day
      const dayTxs = (bucket.txs || []).slice().sort((a, b) => getTxMinutes(a) - getTxMinutes(b));
      let dayInc = 0;
      let dayExp = 0;
      dayTxs.forEach(t => {
        if (t.type === 'income') dayInc += Number(t.amount);
        else if (t.type === 'expense') dayExp += Number(t.amount);
      });

      const isTodayBucket = bucket.isToday || (bucket.date === getTodayMskIso());
      const isFutureBucket = bucket.isFuture;

      let statusBadgeHtml = '';
      if (isTodayBucket) {
        statusBadgeHtml = `<span style="background: rgba(45, 212, 191, 0.18); color: #2DD4BF; font-size: 9.5px; font-weight: 700; padding: 1.5px 6px; border-radius: 4px; margin-left: 6px; letter-spacing: 0.03em;">СЕГОДНЯ</span>`;
      } else if (isFutureBucket) {
        statusBadgeHtml = `<span style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; font-size: 9.5px; font-weight: 600; padding: 1.5px 6px; border-radius: 4px; margin-left: 6px; letter-spacing: 0.03em;">ПРОГНОЗ</span>`;
      }

      let txsHtml = '';
      if (dayTxs.length > 0) {
        txsHtml = `
          <div class="chart-tooltip-txs">
            ${dayTxs.map(t => {
              const isInc = t.type === 'income';
              const color = isInc ? 'var(--accent-jade)' : 'var(--accent-coral)';
              const bg = isInc ? 'rgba(45,212,191,0.12)' : 'rgba(251,113,133,0.12)';
              const sign = isInc ? '+' : '−';
              const tTime = formatTxTime(t);
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; font-size: 11.5px; background: ${bg}; padding: 4px 8px; border-radius: 5px;">
                  <span style="color: var(--text-secondary); font-size: 10.5px; font-weight: 600;">${tTime} • ${esc(t.category)}</span>
                  <span style="color: ${color}; font-weight: 700; font-family: var(--font-mono);">${sign}${money(t.amount)}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        txsHtml = isFutureBucket
          ? `<div class="chart-tooltip-badge" style="color: var(--text-muted); margin-top: 6px; font-size: 11px;">Предстоящий день • Прогноз остатка</div>`
          : `<div class="chart-tooltip-badge" style="color: var(--text-muted); margin-top: 6px; font-size: 11px;">В этот день операций не было</div>`;
      }

      homeTooltip.innerHTML = `
        <div class="chart-tooltip-header">
          <span class="chart-tooltip-title">${esc(bucket.fullDate || bucket.dayDisplay || bucket.dayLabel)}</span>
          ${statusBadgeHtml}
        </div>
        <div class="chart-tooltip-value num">${money(activePt.balance)}</div>
        ${dayTxs.length > 0 ? `
          <div style="display: flex; gap: 6px; margin-top: 4px; font-size: 10.5px; align-items: center;">
            ${dayInc > 0 ? `<span style="color: var(--accent-jade); font-weight: 700;">+${money(dayInc)}</span>` : ''}
            ${dayExp > 0 ? `<span style="color: var(--accent-coral); font-weight: 700;">−${money(dayExp)}</span>` : ''}
            <span style="color: var(--text-muted); font-size: 10px;">(${dayTxs.length} оп.)</span>
          </div>
        ` : ''}
        ${txsHtml}
      `;

      // Smart Side-Anchoring for Desktop HUD:
      // If cursor is on right half of chart, popover anchors to the LEFT of the laser beacon!
      // If cursor is on left half, popover anchors to the RIGHT of the laser beacon!
      const isRightHalf = pxX > (rect.width * 0.52);
      const gap = 16;
      const leftPos = isRightHalf ? (pxX - gap) : (pxX + gap);
      const transformX = isRightHalf ? '-100%' : '0%';

      // Clamped safely vertically inside plot bounds (top: 0 is safely below figure and meta chips!)
      homeTooltip.style.left = `${leftPos}px`;
      homeTooltip.style.top = `0px`;
      homeTooltip.style.transform = `translate(${transformX}, 0)`;
      homeTooltip.classList.add('visible');

      // Update Day Breakdown dock (active on mobile and expandable on desktop)
      if (homeDayBreakdown) {
        homeDayBreakdown.innerHTML = `
          <div class="day-breakdown-head">
            <div class="day-breakdown-date-wrap">
              <span class="day-breakdown-dot"></span>
              <span class="day-breakdown-date">${esc(bucket.fullDate || bucket.dayDisplay || bucket.dayLabel)}</span>
              ${statusBadgeHtml}
            </div>
            <div class="day-breakdown-bal num">${money(activePt.balance)}</div>
          </div>
          <div class="day-breakdown-pills">
            ${dayInc > 0 ? `<span class="day-pill inc">+${money(dayInc)}</span>` : ''}
            ${dayExp > 0 ? `<span class="day-pill exp">−${money(dayExp)}</span>` : ''}
            <span class="day-pill count">${formatOpsCount(dayTxs.length)}</span>
          </div>
          ${dayTxs.length > 0 ? `
            <div class="day-breakdown-txs">
              ${dayTxs.map(t => {
                const isInc = t.type === 'income';
                const sign = isInc ? '+' : '−';
                const tTime = formatTxTime(t);
                return `
                  <div class="day-tx-item">
                    <div class="day-tx-left">
                      <span class="day-tx-time">${tTime}</span>
                      <span class="day-tx-cat">${esc(t.category)}</span>
                    </div>
                    <span class="day-tx-amount ${isInc ? 'inc' : 'exp'}">${sign}${money(t.amount)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div style="font-size: 11.5px; color: var(--text-muted); padding: 4px 0;">
              ${isFutureBucket ? 'Предстоящий день недели • Прогноз остатка капитала' : 'В этот день операций не было • Баланс стабилен'}
            </div>
          `}
        `;
        homeDayBreakdown.classList.add('visible');
      }
    };

    const resetHomeScrub = () => {
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
      lastScrubbedDayIdx = -1;
    };

    homeWrap.onmousemove = e => handleHomeScrub(e.clientX);
    homeWrap.onmouseleave = resetHomeScrub;

    // Full Mobile Touch Support with Directional Gesture Arbitration
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalScrub = false;

    homeWrap.addEventListener('touchstart', e => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isHorizontalScrub = false;
      }
    }, { passive: true });

    homeWrap.addEventListener('touchmove', e => {
      if (e.touches && e.touches.length > 0) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dx = Math.abs(currentX - touchStartX);
        const dy = Math.abs(currentY - touchStartY);

        // Only lock vertical scroll if user has intentionally dragged horizontally
        if (!isHorizontalScrub && dx > 10 && dx > dy * 1.25) {
          isHorizontalScrub = true;
        }

        if (isHorizontalScrub) {
          if (e.cancelable) e.preventDefault();
          handleHomeScrub(currentX);
        }
      }
    }, { passive: false });

    homeWrap.addEventListener('touchend', () => {
      isHorizontalScrub = false;
      // On desktop mouse leaves, on mobile keep day breakdown readable until tap elsewhere
      setTimeout(() => {
        if (window.innerWidth <= 640) {
          // On mobile leave the selected day active so user can review the transactions!
        } else {
          resetHomeScrub();
        }
      }, 300);
    }, { passive: true });
  }

  // Cashflow Dual Mode (Bars & Wave) Dynamic Scrubber & Tooltip
  const cfWrap = document.getElementById('cf-chart-wrap');
  const cfTooltip = document.getElementById('cf-chart-tooltip');
  const cfLine = document.getElementById('cf-scrubber-line');
  const cfDotInc = document.getElementById('cf-scrubber-inc');
  const cfDotExp = document.getElementById('cf-scrubber-exp');
  const cfSlotHighlight = document.getElementById('cf-slot-highlight');

  // Mode switcher buttons
  $$('.cf-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const newMode = btn.getAttribute('data-cfmode');
      if (newMode && newMode !== cashflowChartMode) {
        cashflowChartMode = newMode;
        localStorage.setItem('finkaif_cf_mode', newMode);
        renderApp();
      }
    };
  });

  if (cfWrap && cfTooltip && window.__cfPoints && window.__cfPoints.length > 0) {
    const cfPts = window.__cfPoints;
    const cfW = 760;
    const cfH = 210;
    const isBars = window.__cfMode === 'bars';
    const cfBeaconInc = document.getElementById('cf-html-beacon-inc');
    const cfBeaconExp = document.getElementById('cf-html-beacon-exp');

    cfWrap.onmousemove = e => {
      const rect = cfWrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scaleX = cfW / rect.width;
      const targetSvgX = mouseX * scaleX;

      let closest = cfPts[0];
      let minDx = Math.abs((isBars ? cfPts[0].slotCenter : cfPts[0].x) - targetSvgX);
      for (let i = 1; i < cfPts.length; i++) {
        const ptX = isBars ? cfPts[i].slotCenter : cfPts[i].x;
        const dx = Math.abs(ptX - targetSvgX);
        if (dx < minDx) {
          minDx = dx;
          closest = cfPts[i];
        }
      }

      // Highlight active date on HTML axis strip
      document.querySelectorAll('.cf-axis-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-idx') === String(closest.idx));
      });

      if (isBars && cfSlotHighlight) {
        cfSlotHighlight.setAttribute('x', closest.slotX);
        cfSlotHighlight.setAttribute('width', closest.slotW);
        cfSlotHighlight.style.opacity = '1';
      }

      if (!isBars && cfLine) {
        cfLine.setAttribute('x1', closest.x);
        cfLine.setAttribute('x2', closest.x);
        cfLine.style.opacity = '1';
      }

      if (!isBars && cfBeaconInc) {
        cfBeaconInc.style.left = `${(closest.x / cfW) * 100}%`;
        cfBeaconInc.style.top = `${(closest.yInc / cfH) * 100}%`;
        cfBeaconInc.style.opacity = closest.inc > 0 ? '1' : '0.4';
      }

      if (!isBars && cfBeaconExp) {
        cfBeaconExp.style.left = `${(closest.x / cfW) * 100}%`;
        cfBeaconExp.style.top = `${(closest.yExp / cfH) * 100}%`;
        cfBeaconExp.style.opacity = closest.exp > 0 ? '1' : '0.4';
      }

      const dNet = closest.inc - closest.exp;
      cfTooltip.innerHTML = `
        <div class="chart-tooltip-title">${esc(closest.fullDate || closest.dayLabel)}</div>
        <div style="display: flex; gap: 14px; margin-top: 5px;">
          <div>
            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Поступления</div>
            <div style="color: var(--accent-jade); font-weight: 700; font-family: var(--font-mono);">+${money(closest.inc)}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Списания</div>
            <div style="color: var(--accent-amber); font-weight: 700; font-family: var(--font-mono);">−${money(closest.exp)}</div>
          </div>
        </div>
        <div style="margin-top: 6px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <span style="color: var(--text-muted);">Чистый итог:</span>
          <span style="font-weight: 700; font-family: var(--font-mono); color: ${dNet >= 0 ? 'var(--accent-jade)' : 'var(--accent-coral)'};">
            ${dNet >= 0 ? '+' : '−'}${money(Math.abs(dNet))}
          </span>
        </div>
        ${closest.txCount > 0 ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">${closest.txCount} ${pluralizeOps(closest.txCount)}</div>` : ''}
      `;

      const anchorX = isBars ? closest.slotCenter : closest.x;
      const pxX = (anchorX / cfW) * rect.width;
      const anchorY = isBars ? (172 - Math.max(closest.hInc, closest.hExp, 25)) : Math.min(closest.yInc, closest.yExp);
      const pxY = (anchorY / cfH) * rect.height;

      const tipW = 180;
      let leftPos = pxX;
      if (leftPos + tipW / 2 > rect.width) {
        leftPos = rect.width - tipW / 2 - 8;
      } else if (leftPos - tipW / 2 < 0) {
        leftPos = tipW / 2 + 8;
      }

      cfTooltip.style.left = `${leftPos}px`;
      cfTooltip.style.top = `${Math.max(6, pxY - 10)}px`;
      cfTooltip.classList.add('visible');
    };

    cfWrap.onmouseleave = () => {
      document.querySelectorAll('.cf-axis-item').forEach(el => el.classList.remove('active'));
      if (cfSlotHighlight) cfSlotHighlight.style.opacity = '0';
      if (cfLine) cfLine.style.opacity = '0';
      if (cfBeaconInc) cfBeaconInc.style.opacity = '0';
      if (cfBeaconExp) cfBeaconExp.style.opacity = '0';
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
      banner.innerHTML = `<span><span class="status-dot blue"></span> По категории «${esc(cat)}» лимит не установлен</span>`;
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
        <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;"><span class="status-dot coral"></span> Внимание! Превышение лимита бюджета</div>
        <div style="font-size: 11.5px; margin-top: 2px;">
          Лимит: ${money(lim)} • Уже потрачено: ${money(spentThisMonth)}<br>
          С учетом этой операции (${money(amt)}) превышение составит <strong class="num" style="color: #FFF;">${money(overspend)}</strong>!
        </div>
      `;
      banner.style.display = 'block';
    } else if (newTotal >= lim * 0.8) {
      banner.className = 'tx-budget-banner warning';
      banner.innerHTML = `
        <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;"><span class="status-dot amber"></span> Внимание: приближение к лимиту</div>
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

  const openTxModal = (txOrType = 'expense') => {
    const modal = document.getElementById('tx-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    const modalTitle = modal.querySelector('.modal-title');
    const submitBtn = document.getElementById('tx-modal-submit-btn') || modal.querySelector('.btn-submit');
    const deleteBtnWrap = document.getElementById('tx-modal-delete-wrap');
    const typeSelect = document.getElementById('form-type');
    const catInput = document.getElementById('form-category');
    const amtInput = document.getElementById('form-amount');
    const dateInput = document.getElementById('form-date');
    const timeInput = document.getElementById('form-time');
    const descInput = document.getElementById('form-desc');

    if (typeof txOrType === 'object' && txOrType !== null) {
      // EDIT MODE (Financial facts are strictly permanent and locked; only category & description can be modified)
      editingTxId = txOrType.id;
      if (modalTitle) {
        modalTitle.innerHTML = `Редактирование операции <span class="tx-badge-editing">Категория и описание</span>`;
      }
      const modalCard = modal.querySelector('.modal-card');
      if (modalCard) modalCard.classList.add('tx-modal-edit-locked');

      // Add or show immutable ledger banner
      let immBanner = document.getElementById('tx-immutable-banner');
      if (!immBanner) {
        immBanner = document.createElement('div');
        immBanner.id = 'tx-immutable-banner';
        immBanner.className = 'tx-immutable-banner';
        immBanner.innerHTML = `
          <div class="tx-immutable-icon">${icon('lock', 15)}</div>
          <div>
            <div class="tx-immutable-title">Операция зафиксирована банком</div>
            <div class="tx-immutable-desc">Сумма, дата и тип защищены от изменений финансовым реестром. Вы можете скорректировать категорию и описание.</div>
          </div>
        `;
        const formEl = document.getElementById('tx-modal-form');
        if (formEl) formEl.prepend(immBanner);
      } else {
        immBanner.style.display = 'flex';
      }

      // Lock financial facts
      if (typeSelect) {
        typeSelect.value = txOrType.type || 'expense';
        typeSelect.disabled = true;
      }
      const segBox = document.getElementById('modal-type-segmented');
      if (segBox) {
        segBox.classList.add('input-locked');
        segBox.style.pointerEvents = 'none';
        segBox.style.opacity = '0.7';
        segBox.title = 'Тип операции зафиксирован банком';
      }
      $$('.segmented-type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === (txOrType.type || 'expense')));

      if (amtInput) {
        amtInput.value = profile.currency === 'RUB' ? (txOrType.amount || '') : Number(convertFromRub(txOrType.amount).toFixed(2));
        amtInput.readOnly = true;
        amtInput.classList.add('input-locked');
        amtInput.title = 'Сумма зафиксирована банковским реестром и защищена от изменений';
      }
      const nudges = modal.querySelector('.tx-modal-quick-nudges');
      if (nudges) nudges.style.display = 'none';

      if (dateInput) {
        dateInput.value = getTxIso(txOrType);
        dateInput.readOnly = true;
        dateInput.disabled = true;
        dateInput.classList.add('input-locked');
        dateInput.title = 'Дата зафиксирована банком';
      }
      if (timeInput) {
        timeInput.value = formatTxTime(txOrType);
        timeInput.readOnly = true;
        timeInput.disabled = true;
        timeInput.classList.add('input-locked');
        timeInput.title = 'Время зафиксировано банком';
      }

      // Keep Category & Description fully interactive
      if (catInput) {
        catInput.value = txOrType.category || '';
        catInput.readOnly = false;
        catInput.disabled = false;
        catInput.classList.remove('input-locked');
      }
      if (descInput) {
        descInput.value = txOrType.description || '';
        descInput.readOnly = false;
        descInput.disabled = false;
        descInput.classList.remove('input-locked');
      }
      if (submitBtn) submitBtn.innerText = 'Сохранить изменения';
      if (deleteBtnWrap) deleteBtnWrap.style.display = 'block';

      $$('.cat-chip').forEach(c => {
        if (c.getAttribute('data-cat') === txOrType.category) c.classList.add('selected');
        else c.classList.remove('selected');
      });
    } else {
      // CREATE MODE (All fields are editable for manual entry)
      editingTxId = null;
      const modalCard = modal.querySelector('.modal-card');
      if (modalCard) modalCard.classList.remove('tx-modal-edit-locked');

      const immBanner = document.getElementById('tx-immutable-banner');
      if (immBanner) immBanner.style.display = 'none';

      const type = typeof txOrType === 'string' ? txOrType : 'expense';
      if (modalTitle) modalTitle.innerText = 'Новая операция';
      if (typeSelect) {
        typeSelect.value = type;
        typeSelect.disabled = false;
      }
      const segBox = document.getElementById('modal-type-segmented');
      if (segBox) {
        segBox.classList.remove('input-locked');
        segBox.style.pointerEvents = '';
        segBox.style.opacity = '';
        segBox.title = '';
      }
      $$('.segmented-type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === type));

      if (catInput) {
        catInput.value = type === 'income' ? 'Зарплата' : 'Продукты';
        catInput.readOnly = false;
        catInput.disabled = false;
        catInput.classList.remove('input-locked');
      }
      if (amtInput) {
        amtInput.value = '';
        amtInput.readOnly = false;
        amtInput.classList.remove('input-locked');
        amtInput.title = '';
      }
      const nudges = modal.querySelector('.tx-modal-quick-nudges');
      if (nudges) nudges.style.display = 'flex';

      if (dateInput) {
        dateInput.value = toDateIso(getMskDate());
        dateInput.readOnly = false;
        dateInput.disabled = false;
        dateInput.classList.remove('input-locked');
        dateInput.title = '';
      }
      if (timeInput) {
        const d = getMskDate();
        timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        timeInput.readOnly = false;
        timeInput.disabled = false;
        timeInput.classList.remove('input-locked');
        timeInput.title = '';
      }
      if (descInput) {
        descInput.value = '';
        descInput.readOnly = false;
        descInput.disabled = false;
        descInput.classList.remove('input-locked');
      }
      if (submitBtn) submitBtn.innerText = 'Сохранить операцию';
      if (deleteBtnWrap) deleteBtnWrap.style.display = 'none';

      $$('.cat-chip').forEach(c => {
        const chipCat = c.getAttribute('data-cat');
        if (chipCat === (type === 'income' ? 'Зарплата' : 'Продукты')) c.classList.add('selected');
        else c.classList.remove('selected');
      });
    }
    updateModalBudgetAlert();
  };

  if (btnQuickNew) btnQuickNew.onclick = () => openTxModal('expense');
  if (btnFirstOp) btnFirstOp.onclick = () => openTxModal('expense');
  if (btnAddTxView) btnAddTxView.onclick = () => openTxModal('expense');
  const btnImportBank = document.getElementById('btn-import-bank');
  if (btnImportBank) btnImportBank.onclick = () => openBankImportModal();
  const btnEmptyImportBank = document.getElementById('btn-empty-import-bank');
  if (btnEmptyImportBank) btnEmptyImportBank.onclick = () => openBankImportModal();
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.onclick = () => {
      const rows = [
        ['ID', 'Дата', 'Тип', 'Категория', 'Описание', 'Сумма (RUB)']
      ];
      const toExport = (data.transactions || []).filter(t => {
        if (txFilter !== 'all' && t.type !== txFilter) return false;
        if (txMonthFilter !== 'all') {
          const iso = getTxIso(t);
          if (!iso || !iso.startsWith(txMonthFilter)) return false;
        }
        return true;
      });
      toExport.forEach(t => {
        const typeStr = t.type === 'income' ? 'Поступление' : (t.type === 'transfer' ? 'Перевод' : 'Расход');
        const catStr = `"${String(t.category || '').replace(/"/g, '""')}"`;
        const descStr = `"${String(t.description || '').replace(/"/g, '""')}"`;
        rows.push([
          t.id,
          getTxIso(t),
          typeStr,
          catStr,
          descStr,
          t.amount
        ]);
      });
      const csvContent = '\uFEFF' + rows.map(e => e.join(';')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const suffix = txMonthFilter !== 'all' ? `_${txMonthFilter}` : '';
      link.setAttribute('download', `finkaif_transactions${suffix}_${toDateIso(getMskDate())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }
  if (qAddExp) qAddExp.onclick = () => openTxModal('expense');
  if (qAddInc) qAddInc.onclick = () => openTxModal('income');

  const btnCloseModal = document.getElementById('btn-close-modal');
  if (btnCloseModal) {
    btnCloseModal.onclick = () => {
      const modal = document.getElementById('tx-modal');
      if (modal) modal.style.display = 'none';
      editingTxId = null;
    };
  }

  const txModalBackdrop = document.getElementById('tx-modal');
  if (txModalBackdrop) {
    txModalBackdrop.onclick = e => {
      if (e.target === txModalBackdrop) {
        txModalBackdrop.style.display = 'none';
        editingTxId = null;
      }
    };
  }

  // Delete Transaction from inside modal
  const btnModalDelete = document.getElementById('btn-modal-delete-tx');
  if (btnModalDelete) {
    btnModalDelete.onclick = async () => {
      if (!editingTxId) return;
      const confirmed = await showConfirmDialog({
        title: 'Удаление операции',
        message: 'Вы уверены, что хотите удалить эту операцию? Запись будет безвозвратно удалена из истории.',
        confirmText: 'Удалить операцию',
        cancelText: 'Отмена',
        danger: true,
        icon: 'trash'
      });
      if (confirmed) {
        try {
          await api('transactions/' + editingTxId, { method: 'DELETE' });
          const modal = document.getElementById('tx-modal');
          if (modal) modal.style.display = 'none';
          editingTxId = null;
          await refreshAllData();
          renderApp();
        } catch (err) {
          showToast('Ошибка удаления: ' + err.message, 'error');
        }
      }
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
      if (!editingTxId) {
        if (typeSelect) typeSelect.value = catType;
        $$('.segmented-type-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-type') === catType);
        });
      }
      updateModalBudgetAlert();
    };
  });

  // Modal Inputs dynamic budget warning
  const modalCatInput = document.getElementById('form-category');
  const modalAmtInput = document.getElementById('form-amount');
  const modalTypeSelect = document.getElementById('form-type');
  const rubEqEl = document.getElementById('tx-rub-equivalent');

  const updateRubEq = () => {
    if (!rubEqEl) return;
    const cur = profile.currency || 'RUB';
    if (cur === 'RUB') {
      rubEqEl.style.display = 'none';
      return;
    }
    const val = Number(modalAmtInput?.value) || 0;
    if (val > 0) {
      const rub = Math.round(convertToRub(val, cur));
      rubEqEl.textContent = `≈ ${new Intl.NumberFormat('ru-RU').format(rub)} ₽ (базовый расчет)`;
      rubEqEl.style.display = 'block';
    } else {
      rubEqEl.style.display = 'none';
    }
  };

  if (modalCatInput) modalCatInput.oninput = updateModalBudgetAlert;
  if (modalAmtInput) {
    modalAmtInput.oninput = () => {
      updateModalBudgetAlert();
      updateRubEq();
    };
  }
  if (modalTypeSelect) modalTypeSelect.onchange = updateModalBudgetAlert;

  
  // Segmented Type Switcher in Modal
  $$('.segmented-type-btn').forEach(btn => {
    btn.onclick = () => {
      const type = btn.getAttribute('data-type');
      $$('.segmented-type-btn').forEach(b => b.classList.toggle('active', b === btn));
      const typeSelect = document.getElementById('form-type');
      if (typeSelect) {
        typeSelect.value = type;
        typeSelect.dispatchEvent(new Event('change'));
      }
      updateModalBudgetAlert();
    };
  });

  // Quick Amount Nudges (+100, +500, +1000, +5000)
  $$('.tx-nudge-btn').forEach(btn => {
    btn.onclick = () => {
      const amtEl = document.getElementById('form-amount');
      if (!amtEl) return;
      const nudge = Number(btn.getAttribute('data-nudge')) || 0;
      const curVal = Number(amtEl.value) || 0;
      amtEl.value = Math.max(0, curVal + nudge);
      updateModalBudgetAlert();
      updateRubEq();
      amtEl.focus();
    };
  });

  // Modal Form Submit (Create or Update Transaction with Budget Protection)
  const txModalForm = document.getElementById('tx-modal-form');
  if (txModalForm) {
    txModalForm.onsubmit = async e => {
      e.preventDefault();
      const type = document.getElementById('form-type').value;
      const category = document.getElementById('form-category').value.trim();
      const inputAmount = Number(document.getElementById('form-amount').value);
      const amount = profile.currency === 'RUB' ? inputAmount : Math.round(convertToRub(inputAmount));
      const occurred_on = document.getElementById('form-date').value;
      const timeVal = document.getElementById('form-time') ? document.getElementById('form-time').value : '';
      let created_at;
      if (occurred_on && timeVal) {
        const [y, m, d] = occurred_on.split('-').map(Number);
        const [hh, mm] = timeVal.split(':').map(Number);
        const localDt = new Date(y, m - 1, d, hh, mm, 0);
        created_at = localDt.toISOString();
      } else {
        created_at = new Date().toISOString();
      }
      const description = document.getElementById('form-desc').value.trim();

      if (!category || amount <= 0) {
        showToast('Заполните категорию и сумму операции', 'warning');
        return;
      }

      // Budget Enforcement Protection (for new expense or changed expense)
      if (type === 'expense') {
        const budget = (data.budgets || []).find(b => b.category.toLowerCase() === category.toLowerCase());
        if (budget) {
          const now = new Date();
          const curMonthStart = toDateIso(new Date(now.getFullYear(), now.getMonth(), 1));
          const spentThisMonth = (data.transactions || [])
            .filter(t => t.type === 'expense' && (t.category || '').toLowerCase() === category.toLowerCase() && getTxIso(t) >= curMonthStart && (!editingTxId || String(t.id) !== String(editingTxId)))
            .reduce((s, t) => s + Number(t.amount), 0);

          const lim = Number(budget.limit_amount);
          const newTotal = spentThisMonth + amount;
          if (newTotal > lim) {
            const overspend = newTotal - lim;
            const ok = await showConfirmDialog({
              title: 'Превышение лимита бюджета',
              message: `Категория «${category}» имеет установленный лимит ${money(lim)} в месяц.\nУже израсходовано: ${money(spentThisMonth)}.\n\nС сохранением этой записи (${money(amount)}) перерасход составит ${money(overspend)}!\n\nВы точно хотите зафиксировать этот расход сверх лимита?`,
              confirmText: 'Зафиксировать расход',
              cancelText: 'Отмена',
              danger: true,
              icon: 'alertTriangle'
            });
            if (!ok) return;
          }
        }
      }

      try {
        const submitBtn = txModalForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Сохранение...'; }
        if (editingTxId) {
          // Strictly preserve financial ledger facts (type, amount, dates) and update only category and description
          const origTx = (data.transactions || []).find(t => String(t.id) === String(editingTxId));
          const finalType = origTx ? origTx.type : type;
          const finalAmount = origTx ? Number(origTx.amount) : amount;
          const finalOccurredOn = origTx ? getTxIso(origTx) : occurred_on;
          const finalTime = origTx ? formatTxTime(origTx) : timeVal;
          const finalCreatedAt = origTx ? (origTx.created_at || origTx.occurred_at) : created_at;

          await api('transactions/' + editingTxId, {
            method: 'PUT',
            body: JSON.stringify({
              type: finalType,
              category,
              amount: finalAmount,
              occurred_on: finalOccurredOn,
              time: finalTime,
              created_at: finalCreatedAt,
              description
            })
          });
          showToast('Категория и описание обновлены', 'success');
        } else {
          await api('transactions', {
            method: 'POST',
            body: JSON.stringify({ type, category, amount, occurred_on, time: timeVal, created_at, description })
          });
          if (type === 'income' && amount >= 15000) {
            paydaySplitData = { amount };
          }
          showToast('Операция успешно добавлена', 'success');
        }
        const modal = document.getElementById('tx-modal');
        if (modal) modal.style.display = 'none';
        editingTxId = null;
        await refreshAllData();
        renderApp();
      } catch (err) {
        showToast('Ошибка сохранения операции: ' + err.message, 'error');
        const submitBtn = txModalForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = editingTxId ? 'Сохранить изменения' : 'Сохранить операцию'; }
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

  // Transaction Month Chips
  $$('.month-chip').forEach(btn => {
    btn.onclick = () => {
      txMonthFilter = btn.getAttribute('data-month');
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


  // Seamless Bulk Selection & Dock Handlers (Zero Page Reload, Zero Flash)
  function updateBulkDockState() {
    let dock = document.getElementById('tx-bulk-dock');
    if (tab !== 'transactions' || selectedTxIds.size === 0) {
      if (dock) {
        dock.style.opacity = '0';
        dock.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => {
          if (selectedTxIds.size === 0 && dock && dock.parentNode) dock.remove();
        }, 220);
      }
      return;
    }

    const filtered = (data.transactions || []).filter(t => selectedTxIds.has(t.id));
    const bulkSum = filtered.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);

    if (!dock) {
      const dWrap = document.createElement('div');
      dWrap.innerHTML = renderBulkDock();
      dock = dWrap.firstElementChild;
      const appContainer = document.querySelector('.app-container') || document.body;
      appContainer.appendChild(dock);
      bindBulkDockEvents(dock);
      requestAnimationFrame(() => {
        dock.style.opacity = '1';
        dock.style.transform = 'translateX(-50%) translateY(0)';
      });
    } else {
      dock.style.opacity = '1';
      dock.style.transform = 'translateX(-50%) translateY(0)';
      const badgeStrong = dock.querySelector('.tx-bulk-badge strong');
      if (badgeStrong) badgeStrong.textContent = String(selectedTxIds.size);
      const sumEl = dock.querySelector('.tx-bulk-sum');
      if (sumEl) {
        sumEl.className = `tx-bulk-sum ${bulkSum >= 0 ? 'inc' : 'exp'}`;
        sumEl.textContent = `Сумма: ${bulkSum >= 0 ? '+' : '−'}${money(Math.abs(bulkSum))}`;
      }
      const delBtnSpan = dock.querySelector('#btn-bulk-delete span');
      if (delBtnSpan) delBtnSpan.textContent = `Удалить (${selectedTxIds.size})`;
    }
  }

  function toggleTxSelection(id, forceState = null) {
    if (!id) return;
    const shouldSelect = forceState !== null ? forceState : !selectedTxIds.has(id);
    if (shouldSelect) {
      selectedTxIds.add(id);
    } else {
      selectedTxIds.delete(id);
    }

    const card = document.querySelector(`.tx-card[data-id="${id}"]`);
    if (card) {
      card.classList.toggle('selected', shouldSelect);
      const wrap = card.querySelector('.tx-checkbox-wrap');
      if (wrap) {
        wrap.classList.toggle('checked', shouldSelect);
        wrap.title = shouldSelect ? 'Снять выбор' : 'Выбрать операцию';
      }
      const customCb = card.querySelector('.tx-custom-checkbox');
      if (customCb) {
        customCb.classList.toggle('checked', shouldSelect);
        customCb.innerHTML = shouldSelect ? icon('check', 11) : '';
      }
    }

    updateBulkDockState();
  }

  function bindBulkDockEvents(dock) {
    if (!dock) return;
    const btnSelectAll = dock.querySelector('#btn-bulk-select-all');
    if (btnSelectAll) {
      btnSelectAll.onclick = () => {
        (data.transactions || []).forEach(t => selectedTxIds.add(t.id));
        document.querySelectorAll('.tx-card').forEach(c => {
          const cid = c.getAttribute('data-id');
          if (cid) {
            c.classList.add('selected');
            const wrap = c.querySelector('.tx-checkbox-wrap');
            if (wrap) wrap.classList.add('checked');
            const customCb = c.querySelector('.tx-custom-checkbox');
            if (customCb) {
              customCb.classList.add('checked');
              customCb.innerHTML = icon('check', 11);
            }
          }
        });
        updateBulkDockState();
      };
    }

    const btnDeselect = dock.querySelector('#btn-bulk-deselect');
    if (btnDeselect) {
      btnDeselect.onclick = () => {
        selectedTxIds.clear();
        document.querySelectorAll('.tx-card').forEach(c => {
          c.classList.remove('selected');
          const wrap = c.querySelector('.tx-checkbox-wrap');
          if (wrap) wrap.classList.remove('checked');
          const customCb = c.querySelector('.tx-custom-checkbox');
          if (customCb) {
            customCb.classList.remove('checked');
            customCb.innerHTML = '';
          }
        });
        updateBulkDockState();
      };
    }

    const btnDelete = dock.querySelector('#btn-bulk-delete');
    if (btnDelete) {
      btnDelete.onclick = async () => {
        const count = selectedTxIds.size;
        if (count === 0) return;
        const selectedTxs = (data.transactions || []).filter(t => selectedTxIds.has(t.id));
        const totalAmount = selectedTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

        const confirmed = await showConfirmDialog({
          title: `Удалить ${count} операций?`,
          message: `Вы действительно хотите безвозвратно удалить ${count} выбранных операций на сумму ${money(totalAmount)}? Это действие нельзя будет отменить.`,
          confirmText: `Удалить ${count} записей`,
          cancelText: 'Отмена',
          danger: true,
          icon: 'trash'
        });

        if (confirmed) {
          try {
            const ids = Array.from(selectedTxIds);
            ids.forEach(id => {
              const c = document.querySelector(`.tx-card[data-id="${id}"]`);
              if (c) {
                c.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                c.style.opacity = '0';
                c.style.transform = 'scale(0.92)';
              }
            });
            await Promise.all(ids.map(id => api('transactions/' + id, { method: 'DELETE' })));
            selectedTxIds.clear();
            updateBulkDockState();
            await refreshAllData();
            renderApp();
            showToast(`Успешно удалено ${count} операций`, 'success');
          } catch (err) {
            showToast('Ошибка массового удаления: ' + err.message, 'error');
          }
        }
      };
    }
  }

  // Bind existing dock if present
  const existingDockEl = document.getElementById('tx-bulk-dock');
  if (existingDockEl) bindBulkDockEvents(existingDockEl);

  // Checkbox Click Handler for Transaction Cards (Tactile micro-interaction, zero reload)
  $$('.tx-checkbox-wrap').forEach(wrap => {
    wrap.onclick = e => {
      e.stopPropagation();
      const id = wrap.getAttribute('data-id');
      toggleTxSelection(id);
    };
  });

  // Click on Transaction Card to Edit or Toggle Select
  $$('.tx-card').forEach(card => {
    card.onclick = e => {
      if (e.target.closest('.tx-delete-btn') || e.target.closest('.tx-edit-btn') || e.target.closest('.tx-checkbox-wrap')) return;
      const id = card.getAttribute('data-id');
      if (tab === 'transactions' && selectedTxIds.size > 0) {
        toggleTxSelection(id);
        return;
      }
      const tx = data.transactions.find(t => String(t.id) === String(id));
      if (tx) {
        openTxModal(tx);
      }
    };
  });

  // Edit Transaction button (Direct Edit Trigger)
  $$('.tx-edit-btn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const tx = (data.transactions || []).find(t => String(t.id) === String(id));
      if (tx) openTxModal(tx);
    };
  });

  // Mobile Bottom Bar Navigation
  $$('.mobile-nav-btn[data-tab]').forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-tab');
      if (target) switchTab(target);
    };
  });

  const mobileFabAdd = document.getElementById('mobile-fab-add');
  if (mobileFabAdd) {
    mobileFabAdd.onclick = () => openTxModal('expense');
  }

  const mobileMoreBtn = document.getElementById('mobile-more-btn');
  const mobileSheet = document.getElementById('mobile-more-sheet');
  const btnCloseSheet = document.getElementById('btn-close-mobile-sheet');

  if (mobileMoreBtn && mobileSheet) {
    mobileMoreBtn.onclick = () => {
      mobileSheet.style.display = 'flex';
    };
  }

  if (btnCloseSheet && mobileSheet) {
    btnCloseSheet.onclick = () => {
      mobileSheet.style.display = 'none';
    };
  }

  if (mobileSheet) {
    mobileSheet.onclick = e => {
      if (e.target === mobileSheet) mobileSheet.style.display = 'none';
    };
  }

  $$('.mobile-sheet-item[data-tab]').forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-tab');
      if (mobileSheet) mobileSheet.style.display = 'none';
      if (target) switchTab(target);
    };
  });

  const mobileSheetProfile = document.getElementById('mobile-sheet-profile-btn');
  if (mobileSheetProfile) {
    mobileSheetProfile.onclick = () => {
      if (mobileSheet) mobileSheet.style.display = 'none';
      profileModalOpen = true;
      renderApp();
    };
  }

  // Delete Transaction button (Single Deletion)
  $$('.tx-delete-btn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const confirmed = await showConfirmDialog({
        title: 'Удалить операцию?',
        message: 'Эта операция будет безвозвратно удалена из вашей финансовой истории.',
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        danger: true,
        icon: 'trash'
      });
      if (confirmed) {
        try {
          await api('transactions/' + id, { method: 'DELETE' });
          if (selectedTxIds.has(id)) selectedTxIds.delete(id);
          await refreshAllData();
          renderApp();
          showToast('Операция удалена', 'success');
        } catch (err) {
          showToast('Ошибка удаления: ' + err.message, 'error');
        }
      }
    };
  });

  // ==========================================================================
  // PRIVACY MODE TOGGLE & HOTKEY
  // ==========================================================================
  const togglePrivacy = () => {
    privacyMode = !privacyMode;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(6); } catch {}
    }
    localStorage.setItem('finkaif_privacy', privacyMode ? 'true' : 'false');
    renderApp();
  };

  function initNavGlider() {
    const nav = document.querySelector('.nav-controller');
    const glider = document.getElementById('nav-glider');
    if (!nav || !glider) return;

    const updatePosition = (target) => {
      const el = target || nav.querySelector('.nav-item.active') || nav.querySelector(`.nav-item[data-tab="${tab}"]`);
      if (!el || el.offsetWidth === 0) {
        glider.style.opacity = '0';
        return;
      }
      const left = el.offsetLeft;
      const width = el.offsetWidth;
      if (!glider.style.opacity || glider.style.opacity === '0') {
        glider.style.transition = 'opacity 0.16s ease';
        glider.style.transform = `translate3d(${left}px, 0, 0)`;
        glider.style.width = `${width}px`;
        requestAnimationFrame(() => {
          glider.style.opacity = '1';
          requestAnimationFrame(() => {
            glider.style.transition = '';
          });
        });
      } else {
        glider.style.opacity = '1';
        glider.style.transform = `translate3d(${left}px, 0, 0)`;
        glider.style.width = `${width}px`;
      }
    };

    requestAnimationFrame(() => updatePosition());

    nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.onmouseenter = () => updatePosition(btn);
    });
    nav.onmouseleave = () => updatePosition();
  }

  if (!window.__mastheadGlobalBound) {
    window.__mastheadGlobalBound = true;
    window.addEventListener('resize', () => {
      if (typeof initNavGlider === 'function') initNavGlider();
    });
    window.addEventListener('scroll', () => {
      const masthead = document.querySelector('.masthead');
      if (masthead) {
        if (window.scrollY > 16) {
          masthead.classList.add('scrolled');
        } else {
          masthead.classList.remove('scrolled');
        }
      }
    }, { passive: true });
  }

  const btnTogglePrivacy = document.getElementById('btn-toggle-privacy');
  if (btnTogglePrivacy) {
    btnTogglePrivacy.onclick = e => {
      e.stopPropagation();
      togglePrivacy();
    };
  }

  const mastheadBalPill = document.getElementById('masthead-balance-pill');
  if (mastheadBalPill) {
    mastheadBalPill.onclick = () => togglePrivacy();
  }

  const brandCloudStatus = document.getElementById('brand-cloud-status');
  if (brandCloudStatus) {
    brandCloudStatus.onclick = e => {
      e.stopPropagation();
      if (typeof showToast === 'function') {
        showToast('✓ Облако активно: шифрование AES-GCM, мгновенная синхронизация', 'success');
      }
    };
  }

  if (!window.__globalKeysBound) {
    window.__globalKeysBound = true;
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        let shouldRender = false;
        const txModal = document.getElementById('tx-modal');
        if (txModal && txModal.style.display !== 'none') {
          txModal.style.display = 'none';
          editingTxId = null;
        }
        if (profileModalOpen) {
          profileModalOpen = false;
          shouldRender = true;
        }
        const mobileSheet = document.getElementById('mobile-more-sheet');
        if (mobileSheet && mobileSheet.style.display !== 'none') {
          mobileSheet.style.display = 'none';
        }
        if (paydaySplitData) {
          paydaySplitData = null;
          shouldRender = true;
        }
        if (shouldRender) renderApp();
      }
      if ((e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        togglePrivacy();
      }
    });
  }

  // ==========================================================================
  // SMART QUICK-INPUT EXPRESS BAR & 1-TAP PILLS
  // ==========================================================================
  const quickInput = document.getElementById('quick-express-input');
  const btnSubmitExpress = document.getElementById('btn-submit-express');
  const btnClearQuick = document.getElementById('btn-clear-quick');
  const previewBox = document.getElementById('quick-parse-preview');

  let cachedAiTx = null;
  let quickAiDebounceTimer = null;

  const renderQuickPreviewBox = (parsed, isAi = false, isThinking = false) => {
    if (!previewBox) return;
    if (isThinking) {
      previewBox.style.display = 'flex';
      previewBox.innerHTML = `
        <span class="preview-pill ai-tag" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25)); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.5); font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
          <span>✦</span> ИИ анализирует операцию...
        </span>
      `;
      return;
    }

    if (parsed && parsed.amount > 0) {
      previewBox.style.display = 'flex';
      previewBox.innerHTML = `
        <span class="preview-pill type ${parsed.type}"><span class="status-dot ${parsed.type === 'income' ? 'jade' : 'coral'}"></span> ${parsed.type === 'income' ? 'Поступление' : 'Расход'}</span>
        <span class="preview-pill cat">${getCategoryIcon(parsed.category, parsed.type, 13)} ${esc(parsed.category)}</span>
        <span class="preview-pill amt num">${parsed.type === 'income' ? '+' : '−'}${new Intl.NumberFormat('ru-RU').format(parsed.amount)} ₽</span>
        <span class="preview-pill date">${icon('calendar', 12)} ${esc(parsed.dateLabel || 'Сегодня')}</span>
        <span class="preview-pill desc">«${esc(parsed.description)}»</span>
        ${isAi ? `<span class="preview-pill ai-tag">${icon('sparkle', 11)} ИИ</span>` : ''}
      `;
    } else {
      previewBox.style.display = 'none';
      previewBox.innerHTML = '';
    }
  };

  const updateQuickPreview = (triggerAi = true) => {
    if (!quickInput || !previewBox) return;
    const rawVal = quickInput.value.trim();
    if (btnClearQuick) btnClearQuick.style.display = rawVal ? 'inline-flex' : 'none';

    if (!rawVal) {
      if (quickAiDebounceTimer) clearTimeout(quickAiDebounceTimer);
      cachedAiTx = null;
      renderQuickPreviewBox(null);
      return;
    }

    // Check if we have cached AI result for this exact text
    if (cachedAiTx && cachedAiTx.raw === rawVal) {
      renderQuickPreviewBox(cachedAiTx, true, false);
      return;
    }

    // Immediate zero-latency local parse
    const localParsed = parseQuickTxInput(rawVal);
    if (localParsed && localParsed.amount > 0) {
      renderQuickPreviewBox(localParsed, false, false);
    } else if (rawVal.length >= 3) {
      renderQuickPreviewBox(null, false, true);
    } else {
      renderQuickPreviewBox(null);
    }

    // Debounced AI enhancement (calls backend Gemini with multi-model fallback & prompt)
    if (triggerAi && rawVal.length >= 3) {
      if (quickAiDebounceTimer) clearTimeout(quickAiDebounceTimer);
      quickAiDebounceTimer = setTimeout(async () => {
        if (!quickInput || quickInput.value.trim() !== rawVal) return;
        try {
          const aiRes = await api('parse-tx', {
            method: 'POST',
            body: JSON.stringify({ text: rawVal })
          });
          if (aiRes && aiRes.parsed && Number(aiRes.parsed.amount) > 0 && quickInput.value.trim() === rawVal) {
            const p = aiRes.parsed;
            const iconEmoji = getCategoryIcon(p.category, p.type);
            const isToday = !p.occurred_on || p.occurred_on === toDateIso(getMskDate());
            cachedAiTx = {
              raw: rawVal,
              type: p.type || 'expense',
              category: p.category || 'Прочее',
              amount: Number(p.amount),
              occurred_on: p.occurred_on || toDateIso(getMskDate()),
              dateLabel: isToday ? 'Сегодня' : p.occurred_on,
              description: p.description || rawVal,
              icon: iconEmoji,
              isAi: true
            };
            renderQuickPreviewBox(cachedAiTx, true, false);
          }
        } catch (e) {
          // If AI fails, maintain local parsed if valid
          if (localParsed && localParsed.amount > 0 && quickInput.value.trim() === rawVal) {
            renderQuickPreviewBox(localParsed, false, false);
          }
        }
      }, 350);
    }
  };

  if (quickInput) {
    quickInput.oninput = () => updateQuickPreview(true);
    quickInput.onkeydown = async e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnSubmitExpress) btnSubmitExpress.click();
      }
    };
  }

  if (btnClearQuick && quickInput) {
    btnClearQuick.onclick = () => {
      quickInput.value = '';
      if (quickAiDebounceTimer) clearTimeout(quickAiDebounceTimer);
      cachedAiTx = null;
      updateQuickPreview(false);
      quickInput.focus();
    };
  }

  // Voice Input via Web Speech API (ru-RU)
  const btnVoiceExpress = document.getElementById('btn-voice-express');
  if (btnVoiceExpress && quickInput) {
    setupVoiceInputHandler({
      btnEl: btnVoiceExpress,
      inputEl: quickInput,
      defaultPlaceholder: 'Экспресс-запись: «кофе 250», «получил 50к», «зарплата 80к вчера»...',
      listeningPlaceholder: 'Слушаю... (например: «я сегодня получил 50 тысяч рублей»)',
      onResult: () => updateQuickPreview(true),
      onEnd: () => updateQuickPreview(true)
    });
  }

  if (btnSubmitExpress && quickInput) {
    btnSubmitExpress.onclick = async () => {
      const rawVal = quickInput.value.trim();
      let parsed = null;

      if (cachedAiTx && cachedAiTx.raw === rawVal) {
        parsed = cachedAiTx;
      } else {
        parsed = parseQuickTxInput(rawVal);
      }

      // AI Fallback for complex colloquial / slang input
      if (!parsed || parsed.amount <= 0) {
        try {
          btnSubmitExpress.disabled = true;
          btnSubmitExpress.innerText = 'ИИ анализирует...';
          const aiRes = await api('parse-tx', {
            method: 'POST',
            body: JSON.stringify({ text: rawVal })
          });
          if (aiRes && aiRes.parsed && Number(aiRes.parsed.amount) > 0) {
            const p = aiRes.parsed;
            parsed = {
              type: p.type || 'expense',
              category: p.category || 'Прочее',
              amount: Number(p.amount),
              occurred_on: p.occurred_on || toDateIso(getMskDate()),
              dateLabel: 'Сегодня',
              description: p.description || rawVal,
              icon: getCategoryIcon(p.category, p.type)
            };
          }
        } catch (aiErr) {
          console.warn('AI parse error:', aiErr);
        }
      }

      if (!parsed || parsed.amount <= 0) {
        showToast('Введите сумму и категорию (например: «кофе 250», «получил 50к»)', 'warning');
        btnSubmitExpress.disabled = false;
        btnSubmitExpress.innerText = 'Записать';
        quickInput.focus();
        return;
      }

      try {
        btnSubmitExpress.disabled = true;
        btnSubmitExpress.innerText = 'Запись...';

        await api('transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: parsed.type,
            category: parsed.category,
            amount: parsed.amount,
            occurred_on: parsed.occurred_on,
            description: parsed.description
          })
        });

        if (parsed.type === 'income' && parsed.amount >= 15000) {
          paydaySplitData = { amount: parsed.amount };
        }

        quickInput.value = '';
        await refreshAllData();
        renderApp();
      } catch (err) {
        showToast('Ошибка быстрой записи: ' + err.message, 'error');
      } finally {
        if (btnSubmitExpress) btnSubmitExpress.disabled = false;
      }
    };
  }

  // Home Screen 1-Tap Suggestion Chips
  $$('.quick-chip').forEach(chip => {
    chip.onclick = () => {
      const val = chip.getAttribute('data-chip');
      if (quickInput && val) {
        quickInput.value = val;
        quickInput.focus();
        updateQuickPreview(false);
      }
    };
  });

  // 1-Tap Quick-Tap Pills (Монетки)
  $$('.quick-pill-btn').forEach(pill => {
    pill.onclick = async () => {
      if (pill.disabled) return;
      const type = pill.getAttribute('data-type') || 'expense';
      const category = pill.getAttribute('data-cat') || 'Продукты';
      const amount = Number(pill.getAttribute('data-amt')) || 0;
      const description = pill.getAttribute('data-desc') || category;
      const occurred_on = toDateIso(getMskDate());

      if (amount <= 0) return;

      try {
        pill.disabled = true;
        pill.classList.add('saving');
        await api('transactions', {
          method: 'POST',
          body: JSON.stringify({ type, category, amount, occurred_on, description })
        });
        await refreshAllData();
        renderApp();
      } catch (err) {
        showToast('Ошибка быстрой записи: ' + err.message, 'error');
        pill.disabled = false;
      }
    };
  });

  // Pulse Category Cards Click -> Filter Analytics
  $$('.pulse-cat-card').forEach(card => {
    card.onclick = () => {
      const cat = card.getAttribute('data-cat');
      activeAnalyticsCat = cat;
      switchTab('analytics');
    };
  });

  // ==========================================================================
  // SUBSCRIPTION RADAR & RECURRING BILLS EVENTS
  // ==========================================================================
  const btnSubAddOpen = document.getElementById('btn-sub-add-open');
  const subModal = document.getElementById('sub-modal');
  const btnCloseSubModal = document.getElementById('btn-close-sub-modal');
  const btnCancelSubModal = document.getElementById('btn-cancel-sub-modal');
  const subModalForm = document.getElementById('sub-modal-form');

  const openSubModal = () => {
    if (subModal) {
      subModal.style.display = 'flex';
      const nameInp = document.getElementById('sub-form-name');
      if (nameInp) {
        nameInp.value = '';
        nameInp.focus();
      }
    }
  };

  const closeSubModal = () => {
    if (subModal) subModal.style.display = 'none';
  };

  if (btnSubAddOpen) btnSubAddOpen.onclick = openSubModal;
  if (btnCloseSubModal) btnCloseSubModal.onclick = closeSubModal;
  if (btnCancelSubModal) btnCancelSubModal.onclick = closeSubModal;
  if (subModal) {
    subModal.onclick = (e) => {
      if (e.target === subModal) closeSubModal();
    };
  }

  // Presets in Subscriptions Modal
  $$('.sub-modal-preset').forEach(btn => {
    btn.onclick = () => {
      const name = btn.getAttribute('data-name');
      const amt = btn.getAttribute('data-amt');
      const day = btn.getAttribute('data-day');
      const cat = btn.getAttribute('data-cat') || 'Подписки';

      const nameInp = document.getElementById('sub-form-name');
      const amtInp = document.getElementById('sub-form-amount');
      const dayInp = document.getElementById('sub-form-day');
      const catInp = document.getElementById('sub-form-category');

      if (nameInp) nameInp.value = name;
      if (amtInp) amtInp.value = amt;
      if (dayInp) dayInp.value = day;
      if (catInp) catInp.value = cat;
    };
  });

  // Direct 1-tap add from Radar Suggestions strip
  $$('.sub-preset-add-btn').forEach(btn => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      const name = btn.getAttribute('data-name');
      const amount = Number(btn.getAttribute('data-amt')) || 299;
      const day_of_month = Number(btn.getAttribute('data-day')) || 1;
      const category = btn.getAttribute('data-cat') || 'Подписки';

      try {
        await api('subscriptions', {
          method: 'POST',
          body: JSON.stringify({ name, amount, day_of_month, category })
        });
        await refreshAllData();
        renderApp();
      } catch (err) {
        showToast('Ошибка добавления: ' + err.message, 'error');
        btn.disabled = false;
      }
    };
  });

  // Submit Subscription Form
  if (subModalForm) {
    subModalForm.onsubmit = async (e) => {
      e.preventDefault();
      const nameInp = document.getElementById('sub-form-name');
      const amtInp = document.getElementById('sub-form-amount');
      const dayInp = document.getElementById('sub-form-day');
      const catInp = document.getElementById('sub-form-category');
      const saveBtn = document.getElementById('btn-save-sub-modal');

      const name = nameInp ? nameInp.value.trim() : '';
      const amount = Number(amtInp ? amtInp.value : 0);
      const day_of_month = Math.min(31, Math.max(1, parseInt(dayInp ? dayInp.value : 1, 10) || 1));
      const category = (catInp && catInp.value.trim()) ? catInp.value.trim() : 'Подписки';

      if (!name || amount <= 0) {
        showToast('Укажите корректное название и сумму подписки.', 'warning');
        return;
      }

      try {
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerText = 'Сохранение...';
        }

        await api('subscriptions', {
          method: 'POST',
          body: JSON.stringify({ name, amount, day_of_month, category })
        });

        closeSubModal();
        await refreshAllData();
        renderApp();
      } catch (err) {
        showToast('Ошибка сохранения подписки: ' + err.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = 'Добавить в радар';
        }
      }
    };
  }

  // Delete Subscription with Luxury Confirm Dialog
  $$('.sub-delete-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const subName = btn.getAttribute('data-name') || 'подписку';
      if (!id) return;

      const confirmed = await showConfirmDialog({
        title: 'Удалить подписку?',
        message: `Удалить сервис «${subName}» из радара регулярных списаний?`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        danger: true,
        icon: 'trash'
      });

      if (confirmed) {
        try {
          await api(`subscriptions/${id}`, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          showToast('Ошибка при удалении: ' + err.message, 'error');
        }
      }
    };
  });

  // AI Subscription Audit Button
  const btnSubAudit = document.getElementById('btn-sub-audit');
  if (btnSubAudit) {
    btnSubAudit.onclick = () => {
      tab = 'assistant';
      window.location.hash = 'assistant';
      renderApp();
      submitAssistantQuestion('Проведи полный аудит моих регулярных подписок и повторяющихся списаний. Посчитай общие траты в год, выдели потенциально скрытые или избыточные расходы и дай практические рекомендации, как оптимизировать эти списания.');
    };
  }

  // ==========================================================================
  // PAYDAY AUTO-SPLITTER MODAL EVENTS
  // ==========================================================================
  const btnPaydaySplitGoal = document.getElementById('btn-payday-split-goal');
  if (btnPaydaySplitGoal) {
    btnPaydaySplitGoal.onclick = async () => {
      const goalId = btnPaydaySplitGoal.getAttribute('data-goal-id');
      const splitAmt = Number(btnPaydaySplitGoal.getAttribute('data-split-amt'));
      const goal = (data.goals || []).find(g => String(g.id) === String(goalId));
      if (goal && splitAmt > 0) {
        try {
          const newSaved = Number(goal.saved_amount || 0) + splitAmt;
          await api('goals/' + goalId, {
            method: 'PUT',
            body: JSON.stringify({ saved_amount: newSaved })
          });
        } catch (e) {
          console.error('Ошибка пополнения цели:', e);
        }
      }
      paydaySplitData = null;
      await refreshAllData();
      renderApp();
    };
  }

  const btnPaydayCreateGoal = document.getElementById('btn-payday-create-goal');
  if (btnPaydayCreateGoal) {
    btnPaydayCreateGoal.onclick = () => {
      paydaySplitData = null;
      tab = 'goals';
      renderApp();
    };
  }

  const btnClosePayday = document.getElementById('btn-close-payday');
  if (btnClosePayday) {
    btnClosePayday.onclick = () => {
      paydaySplitData = null;
      renderApp();
    };
  }
  const paydayModal = document.getElementById('payday-modal');
  if (paydayModal) {
    paydayModal.onclick = (e) => {
      if (e.target === paydayModal) {
        paydaySplitData = null;
        renderApp();
      }
    };
  }

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
        showToast('Ошибка сохранения бюджета: ' + err.message, 'error');
      }
    };
  }

  // Budgets: Delete
  $$('.budget-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const confirmed = await showConfirmDialog({
        title: 'Удалить лимит бюджета?',
        message: 'Контроль лимита для этой категории будет снят.',
        confirmText: 'Удалить лимит',
        cancelText: 'Отмена',
        danger: true,
        icon: 'chart'
      });
      if (confirmed) {
        try {
          await api('budgets/' + id, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          showToast('Ошибка удаления: ' + err.message, 'error');
        }
      }
    };
  });

  // Budgets: Preset Amount Chips
  $$('.budget-amt-chip').forEach(chip => {
    chip.onclick = () => {
      const amt = chip.getAttribute('data-amt');
      const input = document.getElementById('budget-limit');
      if (input) {
        input.value = amt;
        input.focus();
      }
    };
  });

  // Budgets: Inline Quick Step Adjustment (+1k / -1k)
  $$('.budget-step-inline-btn').forEach(btn => {
    btn.onclick = async () => {
      const category = btn.getAttribute('data-category');
      const step = Number(btn.getAttribute('data-step')) || 1000;
      const budget = (data.budgets || []).find(b => b.category === category);
      if (!budget) return;
      const newLim = Math.max(1000, Number(budget.limit_amount) + step);
      try {
        await api('budgets', {
          method: 'POST',
          body: JSON.stringify({ category, limit_amount: newLim })
        });
        await refreshAllData();
        renderApp();
        showToast(`Лимит «${category}» обновлён: ${money(newLim)}`, 'success');
      } catch (err) {
        showToast('Ошибка изменения лимита: ' + err.message, 'error');
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
        showToast('Ошибка создания цели: ' + err.message, 'error');
      }
    };
  }

  // Goals: Delete
  $$('.goal-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const confirmed = await showConfirmDialog({
        title: 'Удалить цель накопления?',
        message: 'Цель накопления и статистика по ней будут удалены.',
        confirmText: 'Удалить цель',
        cancelText: 'Отмена',
        danger: true,
        icon: 'target'
      });
      if (confirmed) {
        try {
          await api('goals/' + id, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          showToast('Ошибка удаления: ' + err.message, 'error');
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
        showToast('Ошибка пополнения: ' + err.message, 'error');
      }
    };
  });

  // Goals: Popular Presets Chips
  $$('.goal-preset-chip').forEach(chip => {
    chip.onclick = () => {
      const name = chip.getAttribute('data-name');
      const target = chip.getAttribute('data-target');
      const nameInput = document.getElementById('goal-name');
      const targetInput = document.getElementById('goal-target');
      if (nameInput) nameInput.value = name;
      if (targetInput) targetInput.value = target;
      const savedInput = document.getElementById('goal-saved');
      if (savedInput) savedInput.focus();
    };
  });

  // Goals: 1-Click Instant Deposit Chips
  $$('.goal-instant-chip').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const addVal = Number(btn.getAttribute('data-amount')) || 0;
      if (!addVal || addVal <= 0) return;

      const targetGoal = (data.goals || []).find(g => String(g.id) === String(id));
      if (!targetGoal) return;

      const newSaved = Number(targetGoal.saved_amount || 0) + addVal;
      try {
        await api('goals/' + id, {
          method: 'PUT',
          body: JSON.stringify({ saved_amount: newSaved })
        });
        await refreshAllData();
        renderApp();
        showToast(`В цель «${targetGoal.name}» внесено +${money(addVal)}!`, 'success');
      } catch (err) {
        showToast('Ошибка пополнения: ' + err.message, 'error');
      }
    };
  });

  // Robust AI Assistant Dispatcher
  async function submitAssistantQuestion(text) {
    if (!text || isAiThinking) return;
    const input = document.getElementById('assistant-input');
    if (input) input.value = '';

    data.chat.push({ role: 'user', content: text, created_at: new Date().toISOString() });
    isAiThinking = true;
    aiThinkingPhase = 0;
    renderApp();

    const chatBox = document.getElementById('chat-stream-box');
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

    document.querySelectorAll('.assistant-living-orb').forEach(orb => orb.setAttribute('data-state', 'thinking'));

    if (aiThinkingInterval) clearInterval(aiThinkingInterval);
    const phases = [
      'Считываю структуру транзакций и баланс...',
      'Рассчитываю финансовую скорость (Burn Rate)...',
      'Моделирую сценарий сложного процента...',
      'Синтезирую персональную стратегию...'
    ];
    aiThinkingInterval = setInterval(() => {
      aiThinkingPhase = (aiThinkingPhase + 1) % phases.length;
      const phaseEl = document.getElementById('thinking-phase-text');
      if (phaseEl) {
        phaseEl.innerText = phases[aiThinkingPhase];
      }
    }, 700);

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

      if (aiThinkingInterval) clearInterval(aiThinkingInterval);
      isAiThinking = false;
      let answer = res.answer || res.reply || 'Я проанализировал ваши данные. Проверьте текущий баланс и лимиты трат.';

      // Fallback Agentic Intent Recognizer: ensures goal/budget/tx actions execute even if backend didn't format tags
      if (!answer.includes('[ACTION_EXEC:')) {
        const qLower = text.toLowerCase();
        let detectedAmt = null;
        const kM = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:k|к|тыс\.?|тыщ)(?:\s|$)/i);
        const numM = text.match(/(?:^|\s)(\d[\d\s]*(?:[.,]\d+)?)(?:\s*(?:₽|\$|€|₸|руб\.?|р\.?))?(?:\s|$)/i);
        if (kM) detectedAmt = Math.round(parseFloat(kM[1].replace(',', '.')) * 1000);
        else if (numM) {
          const rawV = numM[1].replace(/\s+/g, '').replace(',', '.');
          if (!isNaN(parseFloat(rawV)) && parseFloat(rawV) > 0) detectedAmt = Math.round(parseFloat(rawV));
        }

        if (/(?:создай|поставь|добавь|хочу накопить)\s+(?:цель|накопление)/i.test(qLower) && detectedAmt) {
          let gName = 'Финансовая цель';
          const nameM = text.match(/(?:цель|накопить)\s+(?:на|в)?\s*([а-яёa-z0-9\s-]+?)(?:\s*(?:на|в размере|сумма)?\s*\d|\s*$)/i);
          if (nameM && nameM[1]) gName = nameM[1].replace(/(?:создай|поставь|добавь|хочу)/gi, '').trim() || gName;
          gName = gName.charAt(0).toUpperCase() + gName.slice(1);
          answer += `\n\n[ACTION_EXEC:create_goal:{"name":"${gName}","target_amount":${detectedAmt},"saved_amount":0}]`;
        } else if (/(?:создай|поставь|установи)\s+(?:бюджет|лимит)/i.test(qLower) && detectedAmt) {
          let cat = 'Прочее';
          const catM = text.match(/(?:на|для|по)\s+([а-яёa-z0-9\s-]+?)(?:\s*\d|\s*$)/i);
          if (catM && catM[1]) cat = catM[1].trim();
          cat = cat.charAt(0).toUpperCase() + cat.slice(1);
          answer += `\n\n[ACTION_EXEC:create_budget:{"category":"${cat}","limit_amount":${detectedAmt}}]`;
        } else if (/(?:удали|стереть|сними|убери|закрой)\s+(?:цель|накопление|цели)/i.test(qLower)) {
          let gName = '';
          const nameM = text.match(/(?:цель|накопление|цели)\s+([а-яёa-z0-9\s-]+?)(?:\s*$|\s*[.,!])/i);
          if (nameM && nameM[1]) gName = nameM[1].replace(/(?:удали|стереть|сними|убери|закрой)/gi, '').trim();
          if (/(?:все|всё|все цели)/i.test(qLower)) gName = 'all';
          answer += `\n\n[ACTION_EXEC:delete_goal:{"name":"${gName || 'последнюю'}"}]`;
        } else if (/(?:удали|стереть|сними|убери|отмени)\s+(?:бюджет|лимит)/i.test(qLower)) {
          let cat = '';
          const catM = text.match(/(?:на|для|по|категори[июя]?|бюджет|лимит)\s+([а-яёa-z0-9\s-]+?)(?:\s*$|\s*[.,!])/i);
          if (catM && catM[1]) cat = catM[1].replace(/(?:бюджет|лимит|удали|сними|убери|отмени)/gi, '').trim();
          if (/(?:все|всё|все бюджеты|все лимиты)/i.test(qLower)) cat = 'all';
          answer += `\n\n[ACTION_EXEC:delete_budget:{"category":"${cat || 'Прочее'}"}]`;
        } else if (/(?:удали|стереть|отмени)\s+(?:последнюю\s+)?(?:операцию|трату|расход|транзакцию|запись)/i.test(qLower)) {
          answer += `\n\n[ACTION_EXEC:delete_tx:{"last":true}]`;
        }
      }

      data.chat.push({ role: 'assistant', content: answer, created_at: new Date().toISOString() });
      renderApp();

      document.querySelectorAll('.assistant-living-orb').forEach(orb => orb.setAttribute('data-state', 'responding'));
      setTimeout(() => {
        document.querySelectorAll('.assistant-living-orb').forEach(orb => orb.setAttribute('data-state', 'idle'));
      }, 2500);

      const chatBoxAfter = document.getElementById('chat-stream-box');
      if (chatBoxAfter) chatBoxAfter.scrollTop = chatBoxAfter.scrollHeight;
    } catch (err) {
      if (aiThinkingInterval) clearInterval(aiThinkingInterval);
      isAiThinking = false;
      data.chat.push({ role: 'assistant', content: `Ошибка: ${err.message}`, created_at: new Date().toISOString() });
      renderApp();
    }
  }

  const assistantForm = document.getElementById('assistant-form');
  if (assistantForm) {
    assistantForm.onsubmit = e => {
      e.preventDefault();
      const input = document.getElementById('assistant-input');
      const text = input ? input.value.trim() : '';
      if (text) submitAssistantQuestion(text);
    };
  }

  // Voice Input for Assistant via Web Speech API
  const btnVoiceAssistant = document.getElementById('btn-voice-assistant');
  const assistantInput = document.getElementById('assistant-input');
  if (btnVoiceAssistant && assistantInput) {
    setupVoiceInputHandler({
      btnEl: btnVoiceAssistant,
      inputEl: assistantInput,
      defaultPlaceholder: 'Спросите совет или командуйте: «Создай цель на отпуск 150к», «Поставь бюджет на кафе 20к»...',
      listeningPlaceholder: 'Слушаю вас... (например: «Создай цель на отпуск 150 000 рублей»)',
      onResult: (txt) => {
        assistantInput.value = txt;
      },
      onEnd: () => {}
    });
  }

  // Action Navigation Buttons
  $$('.btn-action-navigate').forEach(btn => {
    btn.onclick = () => {
      const navTab = btn.getAttribute('data-nav-tab');
      if (navTab) switchTab(navTab);
    };
  });

  // Suggestion Chips with Direct Submission
  $$('.suggestion-chip').forEach(btn => {
    btn.onclick = () => {
      const promptText = btn.getAttribute('data-prompt');
      if (promptText) submitAssistantQuestion(promptText);
    };
  });

  // Chat Quick Starter Chips (above input bar)
  $$('.chat-quick-chip').forEach(btn => {
    btn.onclick = () => {
      const promptText = btn.getAttribute('data-prompt');
      if (promptText) submitAssistantQuestion(promptText);
    };
  });

  // Assistant Mode Pills with Direct Submission
  $$('.assistant-mode-pill').forEach(pill => {
    pill.onclick = () => {
      const promptText = pill.getAttribute('data-prompt');
      if (promptText) submitAssistantQuestion(promptText);
    };
  });

  // Chat Embedded Direct Action Buttons
  $$('.chat-action-btn').forEach(btn => {
    btn.onclick = () => {
      const actTab = btn.getAttribute('data-action-tab');
      const actTarget = btn.getAttribute('data-action-target');
      if (actTarget === 'tx-import') {
        switchTab('transactions');
        setTimeout(openBankImportModal, 80);
        return;
      }
      if (actTab) {
        switchTab(actTab);
      }
    };
  });

  // Chat Copy Message
  $$('.chat-copy-btn').forEach(btn => {
    btn.onclick = async () => {
      const text = btn.getAttribute('data-text');
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          btn.innerHTML = `${icon('check', 13)}`;
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = `${icon('copy', 13)}`;
            btn.classList.remove('copied');
          }, 1500);
        } catch {}
      }
    };
  });

  // Clear Chat History
  const btnClearChat = document.getElementById('btn-clear-chat');
  if (btnClearChat) {
    btnClearChat.onclick = async () => {
      const confirmed = await showConfirmDialog({
        title: 'Очистить историю диалога?',
        message: 'Все сообщения и персональные рекомендации ментора будут очищены.',
        confirmText: 'Очистить историю',
        cancelText: 'Отмена',
        danger: true,
        icon: 'chat'
      });
      if (confirmed) {
        data.chat = [];
        renderApp();
      }
    };
  }

  // Toggle Wealth Simulator
  const btnToggleSim = document.getElementById('btn-toggle-sim');
  if (btnToggleSim) {
    btnToggleSim.onclick = () => {
      simState.open = !simState.open;
      renderApp();
    };
  }

  // Wealth Simulator Inputs
  const simInputInitial = document.getElementById('sim-input-initial');
  if (simInputInitial) {
    simInputInitial.oninput = e => {
      simState.initial = Number(e.target.value);
      renderApp();
    };
  }

  const simInputMonthly = document.getElementById('sim-input-monthly');
  if (simInputMonthly) {
    simInputMonthly.oninput = e => {
      simState.monthly = Number(e.target.value);
      renderApp();
    };
  }

  $$('.sim-chip[data-sim-years]').forEach(chip => {
    chip.onclick = () => {
      simState.years = Number(chip.getAttribute('data-sim-years'));
      renderApp();
    };
  });

  $$('.sim-chip[data-sim-rate]').forEach(chip => {
    chip.onclick = () => {
      simState.rate = Number(chip.getAttribute('data-sim-rate'));
      renderApp();
    };
  });

  const btnAskScenario = document.getElementById('btn-ask-scenario');
  if (btnAskScenario) {
    btnAskScenario.onclick = () => {
      const promptText = btnAskScenario.getAttribute('data-prompt');
      const input = document.getElementById('assistant-input');
      if (input) {
        input.value = promptText;
        const form = document.getElementById('assistant-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    };
  }

  bindBankImportModalEvents();
}

function bindBankImportModalEvents() {
  const importModal = document.getElementById('import-bank-modal');
  const btnCloseImport = document.getElementById('btn-close-import-modal');
  const dropZone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('bank-file-input');
  const previewSection = document.getElementById('import-preview-section');
  const btnChangeFile = document.getElementById('btn-import-change-file');
  const btnSubmitImport = document.getElementById('btn-import-submit');
  const selectAllCb = document.getElementById('import-select-all-cb');

  if (btnCloseImport) {
    btnCloseImport.onclick = closeBankImportModal;
  }
  if (importModal) {
    importModal.onclick = (e) => {
      if (e.target === importModal) closeBankImportModal();
    };
  }

  $$('.import-bank-pill').forEach(pill => {
    pill.onclick = async () => {
      $$('.import-bank-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      bankImportSelectedPreset = pill.getAttribute('data-bank') || 'auto';
      if (window._currentBankPdfBase64) {
        await processBankFile(null, window._currentBankFileName || 'statement.pdf', window._currentBankPdfBase64);
      } else if (window._currentBankFileContent) {
        await processBankFile(window._currentBankFileContent, window._currentBankFileName || 'statement.csv', null);
      }
    };
  });

  if (dropZone && fileInput) {
    dropZone.onclick = (e) => {
      if (e.target.closest('#import-scanning-overlay')) return;
      fileInput.click();
    };

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    };
    dropZone.ondragleave = () => {
      dropZone.classList.remove('dragover');
    };
    dropZone.ondrop = async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    };
  }

  async function handleFileSelect(file) {
    const nameLower = file.name.toLowerCase();

    // 1. PDF Statement
    if (nameLower.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const b64 = dataUrl.split(',')[1];
        window._currentBankFileContent = null;
        window._currentBankPdfBase64 = b64;
        window._currentBankFileName = file.name;
        await processBankFile(null, file.name, b64);
      };
      reader.readAsDataURL(file);
      return;
    }

    // 2. Excel Statement (.xlsx, .xls)
    if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          let csvText = '';
          if (window.XLSX && window.XLSX.read) {
            const data = new Uint8Array(ev.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const sCsv = window.XLSX.utils.sheet_to_csv(sheet);
              if (sCsv && sCsv.trim()) {
                csvText += `\n--- Лист: ${sheetName} ---\n` + sCsv;
              }
            }
          }
          if (!csvText) {
            showToast('Не удалось прочитать таблицы из файла Excel.', 'error');
            return;
          }
          window._currentBankFileContent = csvText;
          window._currentBankPdfBase64 = null;
          window._currentBankFileName = file.name;
          await processBankFile(csvText, file.name, null);
        } catch (xErr) {
          showToast('Ошибка чтения файла Excel: ' + xErr.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // 3. Standard Text, CSV, TSV, JSON
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      window._currentBankFileContent = text;
      window._currentBankPdfBase64 = null;
      window._currentBankFileName = file.name;
      await processBankFile(text, file.name, null);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function processBankFile(content, fileName, pdfBase64 = null) {
    const scanOverlay = document.getElementById('import-scanning-overlay');
    if (scanOverlay) scanOverlay.style.display = 'flex';

    try {
      const res = await parseBankStatement(content, fileName, bankImportSelectedPreset, pdfBase64);
      bankImportParsed = res.transactions;

      if (!bankImportParsed || bankImportParsed.length === 0) {
        showToast('Не удалось распознать операции в данном файле.', 'error');
        return;
      }

      // Deduplication against existing transactions and intra-batch duplicates
      const existingLedger = data.transactions || [];
      const seenBatchKeys = new Set();

      bankImportParsed.forEach(tx => {
        const normDate = tx.occurred_on;
        const normAmt = Math.round(Math.abs(Number(tx.amount)) * 100);
        const normDesc = String(tx.description || '').trim().toLowerCase();
        const batchKey = `${normDate}_${normAmt}_${normDesc}`;

        const isLedgerDupe = existingLedger.some(ex => {
          const exAmt = Math.round(Math.abs(Number(ex.amount)) * 100);
          const exDate = ex.occurred_on;
          const exDesc = String(ex.description || '').trim().toLowerCase();
          return exDate === normDate && exAmt === normAmt && (exDesc === normDesc || (normDesc.length > 5 && exDesc.includes(normDesc)));
        });

        const isBatchDupe = seenBatchKeys.has(batchKey);
        seenBatchKeys.add(batchKey);

        if (isLedgerDupe || isBatchDupe) {
          tx.is_duplicate = true;
          tx.selected = false; // Do not select duplicates by default to prevent duplicate entry
        } else {
          tx.is_duplicate = false;
        }
      });

      if (dropZone) dropZone.style.display = 'none';
      if (previewSection) previewSection.style.display = 'flex';

      const periodText = document.getElementById('import-period-text');
      if (periodText) {
        periodText.innerText = res.period?.label || 'За весь период выписки';
      }

      const bankNameEl = document.getElementById('import-bank-name');
      if (bankNameEl) {
        bankNameEl.innerText = res.bank_name || 'Банковская выписка';
      }

      const engineEl = document.getElementById('import-stat-engine');
      if (engineEl) {
        engineEl.innerText = res.engine === 'ai' ? 'FinKaif AI' : 'Smart Engine';
      }

      renderBankPreviewRows();

      // Automatically open modal immediately after file import if any operations need clarification
      const needClarify = bankImportParsed.filter(isTxClarificationNeeded);
      if (needClarify.length > 0) {
        setTimeout(() => {
          openRequiredClarificationModal(needClarify, () => {
            renderBankPreviewRows();
            showToast('Классификация операций успешно сохранена!', 'success');
          }, bankImportParsed);
        }, 200);
      }
    } finally {
      if (scanOverlay) scanOverlay.style.display = 'none';
    }
  }

  function renderBankPreviewRows() {
    window.renderBankPreviewRows = renderBankPreviewRows;
    const tbody = document.getElementById('import-table-tbody');
    if (!tbody) return;

    let incSum = 0;
    let expSum = 0;
    let selCount = 0;

    tbody.innerHTML = bankImportParsed.map((tx, idx) => {
      if (tx.selected) {
        selCount++;
        if (tx.type === 'income') incSum += tx.amount;
        else expSum += tx.amount;
      }

      const isTransfer = tx.tx_kind === 'transfer';
      const isInc = tx.type === 'income' && !isTransfer;

      // Color for amount
      let amtColor;
      if (isTransfer) {
        amtColor = 'var(--text-muted)';
      } else if (isInc) {
        amtColor = 'var(--accent-jade)';
      } else {
        amtColor = 'var(--accent-coral)';
      }

      // Amount prefix
      const amtPrefix = isTransfer ? '⇄' : (isInc ? '+' : '−');

      // Transfer badge
      const transferHint = isTransfer
        ? `<span style="display:inline-block;margin-left:4px;font-size:10px;color:var(--text-muted);background:var(--bg-tertiary);border-radius:4px;padding:1px 5px;">${tx.is_self_transfer ? 'свой счёт' : 'физлицо'}</span>`
        : '';

      const needsClarify = isTxClarificationNeeded(tx);
      const needClarifyBadge = needsClarify
        ? `<div style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:600; color:var(--accent-amber); background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.28); border-radius:4px; padding:1px 6px; margin-top:4px; cursor:pointer;" onclick="openRequiredClarificationModal([bankImportParsed[${idx}]], renderBankPreviewRows, bankImportParsed)">
            <span class="status-dot amber" style="width:5px; height:5px;"></span>
            Требуется уточнение
           </div>`
        : '';

      const duplicateBadge = tx.is_duplicate
        ? `<span class="badge-duplicate" title="Такая операция с этой суммой и датой уже есть в реестре" style="margin-left: 6px;">Повтор</span>`
        : '';

      return `
        <tr class="${tx.selected ? '' : 'unselected'}">
          <td>
            <input type="checkbox" class="bank-tx-cb" data-idx="${idx}" ${tx.selected ? 'checked' : ''}>
          </td>
          <td class="num" style="white-space: nowrap; font-size: 12px; color: var(--text-muted);">${tx.occurred_on}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
              <span class="import-cat-badge${isTransfer ? ' import-cat-transfer' : ''}">${esc(tx.category)}</span>
              ${duplicateBadge}
            </div>
          </td>
          <td style="min-width: 260px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="text" class="import-desc-input" data-idx="${idx}" value="${esc(tx.description)}" placeholder="Уточните (от кого / на что)..." title="Отредактируйте для точного анализа ментором">
              ${transferHint}
            </div>
            ${needClarifyBadge}
          </td>
          <td class="num" style="text-align: right; font-weight: 700; color: ${amtColor};">
            ${amtPrefix}${money(tx.amount)}
          </td>
        </tr>
      `;
    }).join('');

    const countEl = document.getElementById('import-stat-count');
    const incEl = document.getElementById('import-stat-inc');
    const expEl = document.getElementById('import-stat-exp');
    const selCountLbl = document.getElementById('import-selected-count-label');
    const submitBtnLbl = document.getElementById('btn-import-submit-label');
    const transfersEl = document.getElementById('import-stat-transfers');

    const transferCount = bankImportParsed.filter(t => t.tx_kind === 'transfer').length;

    if (countEl) countEl.innerText = String(bankImportParsed.length);
    if (incEl) incEl.innerText = `+${money(incSum)}`;
    if (expEl) expEl.innerText = `−${money(expSum)}`;
    if (transfersEl) transfersEl.innerText = transferCount > 0 ? `${transferCount} шт.` : '—';
    if (selCountLbl) selCountLbl.innerText = `Выбрано: ${selCount} из ${bankImportParsed.length}`;
    if (submitBtnLbl) submitBtnLbl.innerText = `Импортировать (${selCount})`;

    tbody.querySelectorAll('.bank-tx-cb').forEach(cb => {
      cb.onchange = () => {
        const idx = parseInt(cb.getAttribute('data-idx'), 10);
        if (bankImportParsed[idx]) {
          bankImportParsed[idx].selected = cb.checked;
        }
        renderBankPreviewRows();
      };
    });

    tbody.querySelectorAll('.import-desc-input').forEach(inp => {
      inp.oninput = () => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        if (bankImportParsed[idx]) {
          bankImportParsed[idx].description = inp.value;
        }
      };
    });
  }

  const btnOpenClarifyFull = document.getElementById('btn-open-clarify-full');
  if (btnOpenClarifyFull) {
    btnOpenClarifyFull.onclick = () => {
      if (bankImportParsed && bankImportParsed.length > 0) {
        const needClarify = bankImportParsed.filter(isTxClarificationNeeded);
        openRequiredClarificationModal(needClarify, () => {
          renderBankPreviewRows();
        }, bankImportParsed);
      } else {
        showToast('Сначала загрузите выписку для классификации', 'warning');
      }
    };
  }

  if (selectAllCb) {
    selectAllCb.onchange = () => {
      const isChecked = selectAllCb.checked;
      bankImportParsed.forEach(tx => tx.selected = isChecked);
      renderBankPreviewRows();
    };
  }

  if (btnChangeFile) {
    btnChangeFile.onclick = () => {
      if (dropZone) dropZone.style.display = 'flex';
      if (previewSection) previewSection.style.display = 'none';
      if (fileInput) fileInput.value = '';
      bankImportParsed = [];
      window._currentBankFileContent = null;
      window._currentBankPdfBase64 = null;
      window._currentBankFileName = null;
    };
  }

  if (btnSubmitImport) {
    btnSubmitImport.onclick = async () => {
      const selected = bankImportParsed.filter(tx => tx.selected);
      if (selected.length === 0) {
        showToast('Выберите хотя бы одну операцию для импорта.', 'warning');
        return;
      }

      // Permanent Rule: Any selected unclear operations MUST be clarified before importing
      const needClarify = selected.filter(isTxClarificationNeeded);
      if (needClarify.length > 0) {
        openRequiredClarificationModal(needClarify, () => {
          proceedWithImport(selected);
        }, bankImportParsed);
        return;
      }

      proceedWithImport(selected);
    };
  }

  async function proceedWithImport(selected) {
    if (btnSubmitImport) btnSubmitImport.disabled = true;
    const submitBtnLbl = document.getElementById('btn-import-submit-label');
    if (submitBtnLbl) submitBtnLbl.innerText = 'Импортирование...';

    try {
      const txList = selected.map(tx => ({
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        occurred_on: tx.occurred_on
      }));

      let bulkOk = false;
      try {
        const res = await api('transactions/bulk', {
          method: 'POST',
          body: JSON.stringify({ transactions: txList })
        });
        if (res && res.ok) bulkOk = true;
      } catch (_) {}

      if (!bulkOk) {
        for (const tx of txList) {
          await api('transactions', {
            method: 'POST',
            body: JSON.stringify(tx)
          });
        }
      }

      closeBankImportModal();
      bankImportParsed = [];
      window._currentBankFileContent = null;

      await refreshAllData();
      tab = 'transactions';
      renderApp();

      showToast('Успешно импортировано ' + selected.length + ' операций', 'success');
    } catch (err) {
      showToast('Ошибка при импорте: ' + err.message, 'error');
    } finally {
      if (btnSubmitImport) btnSubmitImport.disabled = false;
    }
  }
}

/* ==========================================================================
   INITIALIZATION & DATA REFRESH
   ========================================================================== */
async function refreshAllData() {
  try {
    const [txs, bgs, gls, cht, subs, prof] = await Promise.all([
      api('transactions').catch(() => []),
      api('budgets').catch(() => []),
      api('goals').catch(() => []),
      api('chat').catch(() => []),
      api('subscriptions').catch(() => []),
      api('profile').catch(() => null)
    ]);

    data.transactions = Array.isArray(txs) ? txs : [];
    data.budgets = Array.isArray(bgs) ? bgs : [];
    data.goals = Array.isArray(gls) ? gls : [];
    data.chat = Array.isArray(cht) ? cht : [];
    data.subscriptions = Array.isArray(subs) ? subs : [];

    if (prof) {
      profile.display_name = prof.display_name || '';
      profile.avatar = prof.avatar || 'default';
      if (prof.currency) profile.currency = prof.currency;
      try {
        localStorage.setItem('finkaif_name', profile.display_name);
        localStorage.setItem('finkaif_avatar', profile.avatar);
        localStorage.setItem('finkaif_currency', profile.currency);
      } catch (_) {}
      if (typeof updateMastheadDynamicData === 'function') updateMastheadDynamicData();
    }
  } catch (err) {
    console.warn('Sync notice:', err.message);
  }
}

function syncHash() {
  const h = window.location.hash.replace('#', '');
  if (['home', 'analytics', 'transactions', 'budgets', 'goals', 'assistant'].includes(h)) {
    if (tab !== h) {
      if (typeof switchTab === 'function') switchTab(h);
      else { tab = h; renderApp(); }
    }
  }
}

async function boot() {
  initAmbientCanvas();
  fetchExchangeRates(); // Fetch live CBR exchange rates on launch

  const initHash = window.location.hash.replace('#', '');
  if (['home', 'analytics', 'transactions', 'budgets', 'goals', 'assistant'].includes(initHash)) {
    tab = initHash;
  }

  try {
    const userRes = await api('me');
    me = userRes.user;

    // Load authoritative profile settings from cloud database (PostgreSQL SSOT)
    try {
      const prof = await api('profile');
      if (prof) {
        profile.display_name = prof.display_name || '';
        profile.avatar = prof.avatar || 'default';
        if (prof.currency) profile.currency = prof.currency;
        try {
          localStorage.setItem('finkaif_name', profile.display_name);
          localStorage.setItem('finkaif_avatar', profile.avatar);
          localStorage.setItem('finkaif_currency', profile.currency);
        } catch (_) {}
      }
    } catch { }

    await refreshAllData();
  } catch {
    me = null;
  }

  renderApp();
}

// Global Click Delegation (Steppers, Popovers, etc.)
document.addEventListener('click', (e) => {
  const spinBtn = e.target.closest('.spin-step-btn');
  if (spinBtn) {
    e.preventDefault();
    e.stopPropagation();
    let targetInput = null;
    if (spinBtn.dataset.target) {
      targetInput = document.getElementById(spinBtn.dataset.target);
    }
    if (!targetInput) {
      targetInput = spinBtn.closest('.number-stepper-wrap')?.querySelector('input');
    }
    if (targetInput) {
      const step = Number(spinBtn.dataset.step) || (spinBtn.dataset.dir === 'down' ? -100 : 100);
      let curVal = Number(targetInput.value) || 0;
      let newVal = curVal + step;
      if (targetInput.min !== '' && !isNaN(Number(targetInput.min))) {
        newVal = Math.max(Number(targetInput.min), newVal);
      }
      if (targetInput.max !== '' && !isNaN(Number(targetInput.max))) {
        newVal = Math.min(Number(targetInput.max), newVal);
      }
      if (Math.abs(step) >= 1) {
        newVal = Math.round(newVal);
      } else {
        newVal = Math.round(newVal * 100) / 100;
      }
      targetInput.value = newVal;
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  const btn = e.target.closest('.metric-info-btn');
  const closeBtn = e.target.closest('.popover-close');

  if (btn) {
    e.stopPropagation();
    const id = btn.getAttribute('data-tooltip-id');
    const targetPopover = document.getElementById(id);
    const parentCard = btn.closest('.analytics-metric-card');
    const wasPinned = targetPopover?.classList.contains('pinned');

    // Close all pinned and hover popovers
    document.querySelectorAll('.metric-popover.pinned, .metric-popover.hover-open').forEach(p => {
      p.classList.remove('pinned');
      p.classList.remove('hover-open');
    });
    document.querySelectorAll('.metric-info-btn.active').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.analytics-metric-card.popover-active').forEach(c => c.classList.remove('popover-active'));

    if (!wasPinned && targetPopover) {
      targetPopover.classList.add('pinned');
      btn.classList.add('active');
      if (parentCard) parentCard.classList.add('popover-active');
    }
    return;
  }

  if (closeBtn) {
    e.stopPropagation();
    const id = closeBtn.getAttribute('data-close');
    const targetPopover = document.getElementById(id);
    if (targetPopover) {
      targetPopover.classList.remove('pinned');
      targetPopover.classList.remove('hover-open');
      const card = targetPopover.closest('.analytics-metric-card');
      if (card) card.classList.remove('popover-active');
    }
    document.querySelector(`.metric-info-btn[data-tooltip-id="${id}"]`)?.classList.remove('active');
    return;
  }

  // Clicking outside closes pinned and hover popovers
  if (!e.target.closest('.metric-popover')) {
    document.querySelectorAll('.metric-popover.pinned, .metric-popover.hover-open').forEach(p => {
      p.classList.remove('pinned');
      p.classList.remove('hover-open');
    });
    document.querySelectorAll('.metric-info-btn.active').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.analytics-metric-card.popover-active').forEach(c => c.classList.remove('popover-active'));
  }
});

// Desktop Hover interactions
document.addEventListener('mouseover', (e) => {
  const btn = e.target.closest('.metric-info-btn');
  if (btn) {
    const id = btn.getAttribute('data-tooltip-id');
    const targetPopover = document.getElementById(id);
    const parentCard = btn.closest('.analytics-metric-card');
    if (targetPopover && !targetPopover.classList.contains('pinned')) {
      targetPopover.classList.add('hover-open');
      btn.classList.add('active');
      if (parentCard) parentCard.classList.add('popover-active');
    }
  }
});

document.addEventListener('mouseout', (e) => {
  const card = e.target.closest('.analytics-metric-card');
  if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) {
    // Only close if not pinned by explicit click
    card.querySelectorAll('.metric-popover.hover-open').forEach(p => p.classList.remove('hover-open'));
    if (!card.querySelector('.metric-popover.pinned')) {
      card.querySelectorAll('.metric-info-btn.active').forEach(b => b.classList.remove('active'));
      card.classList.remove('popover-active');
    }
  }
});

window.addEventListener('hashchange', syncHash);
window.addEventListener('DOMContentLoaded', boot);

// ==========================================================================
// FINKAIF DESIGN PROTOCOL v9.0 — MOTION JAVASCRIPT ENGINE
// ==========================================================================

// ── Mouse-follow spotlight on interactive cards ──────────────────────────
(function initSpotlight() {
  const CARD_SELECTOR = [
    '.stat-card', '.hero-balance-card', '.budget-card', '.goal-card',
    '.quick-action-btn', '.tx-card', '.create-card', '.analytics-metric-card',
    '.analytics-card', '.sub-card', '.pulse-cat-card', '.tx-summary-card'
  ].join(',');

  function bindSpotlight(card) {
    if (card.__fk_spotlight) return;
    card.__fk_spotlight = true;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  }

  // Bind existing + observe new cards
  document.querySelectorAll(CARD_SELECTOR).forEach(bindSpotlight);

  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches && node.matches(CARD_SELECTOR)) bindSpotlight(node);
      node.querySelectorAll && node.querySelectorAll(CARD_SELECTOR).forEach(bindSpotlight);
    }));
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ── Scroll-driven masthead glass intensity ───────────────────────────────
(function initMastheadScroll() {
  const masthead = document.querySelector('.masthead');
  if (!masthead) return;

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrolled = window.scrollY > 20;
      masthead.classList.toggle('scrolled', scrolled);
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Run once immediately
})();

// ── Number pop micro-animation when value changes ───────────────────────
(function initNumberPop() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      const el = m.target;
      if (!el || el.__fk_popping) return;
      // Only animate financial value elements
      if (!el.matches || !el.matches('.hero-balance-figure, .stat-amount, .tx-amount, .metric-value, .sim-badge-val')) return;
      el.__fk_popping = true;
      el.style.transition = 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.22s ease';
      el.style.transform = 'scale(1.07)';
      setTimeout(() => {
        el.style.transform = 'scale(1)';
        setTimeout(() => { el.__fk_popping = false; }, 220);
      }, 120);
    });
  });

  // Watch for text changes in value elements
  function bindNumberWatcher(el) {
    if (el.__fk_numbound) return;
    el.__fk_numbound = true;
    observer.observe(el, { characterData: true, subtree: true, childList: true });
  }

  function scanAndBind() {
    document.querySelectorAll('.hero-balance-figure, .stat-amount, .metric-value').forEach(bindNumberWatcher);
  }

  scanAndBind();
  // Re-scan after renders
  const appEl = document.getElementById('app');
  if (appEl) {
    new MutationObserver(scanAndBind).observe(appEl, { childList: true, subtree: false });
  }
})();

// ── Tab switch ripple on nav items ───────────────────────────────────────
(function initTabRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item, .mobile-nav-btn, .period-tab, .filter-tab, .analytics-period-btn');
    if (!btn) return;
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute;pointer-events:none;border-radius:50%;
      width:40px;height:40px;margin-top:-20px;margin-left:-20px;
      background:rgba(45,212,191,0.22);
      transform:scale(0);animation:rippleOut 0.45s ease-out forwards;
    `;
    const rect = btn.getBoundingClientRect();
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top  = `${e.clientY - rect.top}px`;

    if (!document.querySelector('#fk-ripple-style')) {
      const s = document.createElement('style');
      s.id = 'fk-ripple-style';
      s.textContent = '@keyframes rippleOut{to{transform:scale(3.5);opacity:0}}';
      document.head.appendChild(s);
    }

    btn.style.overflow = 'hidden';
    btn.style.position = btn.style.position || 'relative';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });
})();

// ── Quick-express preview re-entrance: repaint pills on each update ──────
(function initPreviewEntrance() {
  const previewEl = document.getElementById('quick-parse-preview');
  if (!previewEl) return;

  new MutationObserver(() => {
    previewEl.querySelectorAll('.preview-pill').forEach((pill, i) => {
      pill.style.animation = 'none';
      pill.offsetHeight; // force reflow
      pill.style.animation = '';
      pill.style.animationDelay = `${i * 45}ms`;
    });
  }).observe(previewEl, { childList: true });
})();

