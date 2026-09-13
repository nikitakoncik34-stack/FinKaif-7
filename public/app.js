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
    return `<img src="${key}" alt="Avatar" class="custom-avatar-img" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(45, 212, 191, 0.4); display: block;">`;
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
let analyticsPeriod = '30d';
let cashflowChartMode = localStorage.getItem('finkaif_cf_mode') || 'bars';
let activeAnalyticsCat = null;
let hoveredAnalyticsCat = null;
let txFilter = 'all';
let txMonthFilter = 'all';
let txSearch = '';
let modalType = 'expense';
let editingTxId = null;
let profileModalOpen = false;
let privacyMode = localStorage.getItem('finkaif_privacy') === 'true';
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

let profile = {
  display_name: localStorage.getItem('finkaif_name') || '',
  avatar: localStorage.getItem('finkaif_avatar') || 'default',
  currency: localStorage.getItem('finkaif_currency') || 'RUB'
};
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

  if (cur === 'USD' || cur === 'EUR') {
    const isSmallOrDecimal = Math.abs(converted) < 1000 || Math.round(converted * 100) !== Math.round(converted) * 100;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: isSmallOrDecimal ? 2 : 0,
      maximumFractionDigits: 2
    }).format(converted);
    return (cur === 'USD' ? '$' : '€') + formatted;
  } else {
    // RUB or KZT
    const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(converted));
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
    if (cur === 'USD' || cur === 'EUR') {
      const isSmallOrDecimal = Math.abs(val) < 1000 || Math.round(val * 100) !== Math.round(val) * 100;
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: isSmallOrDecimal ? 2 : 0,
        maximumFractionDigits: 2
      }).format(val);
    }
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(val));
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

// Beautiful Custom In-App Confirmation Modal
function showConfirmDialog({
  title = 'Подтверждение',
  message = 'Вы уверены, что хотите выполнить это действие?',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = true,
  icon = '⚠️'
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
          <span>${icon}</span>
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

// Rich Action Parser and Markdown formatter for Assistant replies
const formatAssistantMessage = (raw) => {
  if (!raw) return '';
  const actions = [];
  const cleanText = String(raw).replace(/\[ACTION:([^:]+):([^:]+):([^\]]+)\]/g, (_, actTab, actTarget, actLabel) => {
    actions.push({ tab: actTab.trim(), target: actTarget.trim(), label: actLabel.trim() });
    return '';
  });

  let html = formatMarkdown(cleanText.trim());

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

  return { score, label, badgeClass, runway: runway.toFixed(1), savingsRate };
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

// Smart Natural Language Financial Parser (with Full Russian Slang, Livestock/Pets, Composite Numbers & 0ms Latency)
function parseQuickTxInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const lower = ' ' + text.toLowerCase().replace(/ё/g, 'е') + ' ';
  let cleanWords = ' ' + text + ' ';
  let amount = 0;
  let matchedNumStr = '';

  // 1. Extract amount using advanced compound Russian number & slang recognizer
  // A. "X с половиной [миллиарда/миллиона/тысяч/ляма]"
  const sPolovinoi = lower.match(/(?:^|[^а-яa-z0-9])(один|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|\d+(?:[.,]\d+)?)\s+с\s+половиной\s*(миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон[а-я]*|тысяч[а-я]*|тыщ[а-я]*|косар[а-я]*|куск[а-я]*)(?:$|[^а-яa-z0-9])/i);
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

  // B. "полтора / полторы" + scale
  if (!amount) {
    const poltora = lower.match(/(?:^|[^а-яa-z0-9])полтор[ыа]\s*(миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон[а-я]*|тысяч[а-я]*|тыщ[а-я]*|косар[а-я]*|куск[а-я]*)(?:$|[^а-яa-z0-9])/i);
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
  // Billions: 1.5 млрд, 2 арбуза, 1ккк
  if (!amount) {
    const digBillion = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|арбуз[а-я]*|ккк|kkk)(?:$|[^а-яa-z0-9])/i);
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

  // Thousands: 85 тысяч, 15 тыщ, 3 косаря, 100к
  if (!amount) {
    const digThousand = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:тысяч[а-я]*|тыщ[а-я]*|тыс[а-я]*|косар[а-я]*|куск[а-я]*|штук[а-я]*|тонн[а-я]*|к\b|k\b)(?:$|[^а-яa-z0-9])/i);
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

  // E. Russian compound text words ("триста пятьдесят тысяч", "миллион рублей", "сорок пять тысяч")
  if (!amount) {
    const ONES = { 'один': 1, 'одна': 1, 'одно': 1, 'одну': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9 };
    const TEENS = { 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14, 'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19 };
    const TENS = { 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50, 'шестьдесят': 60, 'семьдесят': 70, 'восемьдесят': 80, 'девяносто': 90 };
    const HUNDREDS = { 'сто': 100, 'двести': 200, 'триста': 300, 'четыреста': 400, 'пятьсот': 500, 'шестьсот': 600, 'семьсот': 700, 'восемьсот': 800, 'девятьсот': 900 };
    const MULTIPLIERS = [
      { regex: /^(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|арбуз[а-я]*)$/i, scale: 1000000000 },
      { regex: /^(?:миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон[а-я]*)$/i, scale: 1000000 },
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
    const slangRules = [
      { re: /(?:^|[^а-яa-z0-9])(?:сорокет[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 40000 },
      { re: /(?:^|[^а-яa-z0-9])(?:полтос[а-я]*|полтинник[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 50000 },
      { re: /(?:^|[^а-яa-z0-9])(?:сотка|сотку|сотен)\s*(?:тыс[а-я]*|тыщ[а-я]*|к\b|k\b)(?:$|[^а-яa-z0-9])/i, val: 100000 },
      { re: /(?:^|[^а-яa-z0-9])(?:сотка|сотку|сотен)\s*(?:руб[а-я]*|р\b)(?:$|[^а-яa-z0-9])/i, val: 100 },
      { re: /(?:^|[^а-яa-z0-9])(?:сотка|сотку|сотен)(?:$|[^а-яa-z0-9])/i, val: /(?:руб|кофе|билет|проезд|чай|булк|чипс|жвачк)/i.test(lower) ? 100 : 100000 },
      { re: /(?:^|[^а-яa-z0-9])(?:пятихат[а-я]*|пять сотен)(?:$|[^а-яa-z0-9])/i, val: 500 },
      { re: /(?:^|[^а-яa-z0-9])(?:двушк[а-я]|две штуки)(?:$|[^а-яa-z0-9])/i, val: 2000 },
      { re: /(?:^|[^а-яa-z0-9])(?:трешк[а-я]|трёшк[а-я]|трояк)(?:$|[^а-яa-z0-9])/i, val: 3000 },
      { re: /(?:^|[^а-яa-z0-9])(?:пятерк[а-я]|пятёрк[а-я])(?:$|[^а-яa-z0-9])/i, val: 5000 },
      { re: /(?:^|[^а-яa-z0-9])(?:чирик[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 10000 },
      { re: /(?:^|[^а-яa-z0-9])(?:косарь|косаря|кусок|штука)(?:$|[^а-яa-z0-9])/i, val: 1000 },
      { re: /(?:^|[^а-яa-z0-9])(?:миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 1000000 },
      { re: /(?:^|[^а-яa-z0-9])(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|арбуз[а-я]*)(?:$|[^а-яa-z0-9])/i, val: 1000000000 }
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
      const val = Math.round(parseFloat(cleanNum));
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
  let iconEmoji = '💳';

  // Comprehensive Income Regex Patterns
  const isIncome = /(?:заработ|получил|поднял|срубил|намайнил|выплат|перевел|перечисл|начисл|скинули|закинули|пришл|приход|капнул|упал|прилетел|залетел|поступлен|поступил|доход|выручк|прибыл|гонорар|преми|бонус|оклад|отпускн|больничн|зарплат|аванс|получк|продал|подар|чаев|донат|вернули долг|отдали долг)/i.test(lower);

  if (isIncome) {
    type = 'income';
    if (/фриланс|проект|клиент|заказ|шабашк|халтур|калым|подработк|смен[аы]|дизайн|верстк|разработк|сайт/i.test(lower)) {
      category = 'Фриланс';
      iconEmoji = '💼';
    } else if (/дивиденд|купон|процент|вклад|акци|инвест|крипт|биток|eth|usdt|тон\b/i.test(lower)) {
      category = 'Инвестиции';
      iconEmoji = '📈';
    } else if (/продал|авито|юла|сбыт/i.test(lower)) {
      category = 'Продажи';
      iconEmoji = '🏷️';
    } else if (/подар|день рожден|др\b|чаев|донат/i.test(lower)) {
      category = 'Подарки';
      iconEmoji = '🎁';
    } else if (/кэшбэк|бонус|возврат|вычет/i.test(lower)) {
      category = 'Кэшбэк';
      iconEmoji = '💳';
    } else if (/долг|вернули|отдали/i.test(lower)) {
      category = 'Возврат долга';
      iconEmoji = '🤝';
    } else {
      category = 'Зарплата';
      iconEmoji = '💰';
    }
  } else {
    type = 'expense';
    // Animals / Livestock / Pets / Farming (корова, бык, скот, ферма, корм, собака, кот, ветклиника)
    if (/коров[а-я]*|бык[а-я]*|телят[а-я]*|теленок|телк[а-я]*|коз[а-я]*|свин[а-я]*|хрюш[а-я]*|поросят[а-я]*|лошад[а-я]*|кон[яеь][а-я]*|жереб[а-я]*|овц[а-я]*|баран[а-я]*|ягнят[а-я]*|кур[а-я]*|петух[а-я]*|цыплят[а-я]*|гус[а-я]*|утк[а-я]*|индюк[а-я]*|скот[а-я]*|ферм[а-я]*|пасек[а-я]*|пчел[а-я]*|улей|питом[а-я]*|собак[а-я]*|щен[а-я]*|пес[а-я]*|пёсел[а-я]*|кошк[а-я]*|кот[а-я]*|котят[а-я]*|котейк[а-я]*|хомяк[а-я]*|попуга[а-я]*|рыбк[а-я]*|аквариум[а-я]*|грызун[а-я]*|корм[а-я]*|ветеринар[а-я]*|ветклиник[а-я]*|груминг[а-я]*|поводок|лоток|наполнитель/i.test(lower)) {
      category = 'Питомцы';
      iconEmoji = '🐾';
    }
    // Gadgets, Gaming & Tech
    else if (/плойк|соньк|playstation|ps5|ps4|xbox|иксбокс|нинтендо|switch|стимдек|видяха|видюх|видеокарт|rtx|geforce|проц|процессор|ссд|ssd|оперативк|монитор|моник|клав|мышк|айфон|iphone|эйрподс|airpods|макбук|macbook|ipad|айпад|эппл.*вотч|ноут|ноутбук|комп|пк|системник|телевизор|телик|техник|гаджет|наушник|колонк|алис[а]|станци[яи]|пылесос|стиралк|холодильник|микроволновк/i.test(lower)) {
      category = 'Техника';
      iconEmoji = '💻';
    }
    // Transport, Auto & Fuel
    else if (/такс|uber|убер|яндекс.*гоу|яндекс.*такси|карш|каршеринг|делимобиль|ситидрайв|белк[а]|заправил|бенз|дизель|солярк|азс|лукойл|газпром|роснефть|татнефть|тебойл|мойка|самомойк|детейлинг|помыл тачк|помыл машин|шиномонтаж|переобул|резин[аы]|балансировк|метро|проездной|тройк|стрелк|автобус|маршрутк|трамвай|электричк|мцд|мцк|сапсан|ласточк|ржд|поезд|самолет|авиабилет|побед|аэрофлот|s7|парковк|штраф|гибдд|платка|осаго|каско/i.test(lower)) {
      category = 'Транспорт';
      iconEmoji = '🚕';
    }
    // Coffee, Bakery & Drinks
    else if (/кофе|кофей|латте|капуч|флэт|раф|эспрессо|американо|матча|чай|булочн|выпечк|пекарн|круассан|слойк|булк/i.test(lower)) {
      category = 'Кафе';
      iconEmoji = '☕';
    }
    // Dining, Fast food, Delivery, Bars
    else if (/шав[ауе][а-я]*|шаверм|шаурм|донер|кебаб|пицц|додо|папа.*джонс|бургер|макдак|мак\b|вкусно.*точк|вит\b|кфс|kfc|ростикс|ролл|суши|якитори|тануки|обед|ужин|завтрак|ланч|бизнес.*ланч|столовк|столов[ая]|пивас|пиво|пивко|крафт|сидр|сидрери|вино|бар\b|паб\b|рестик|ресторан|кальян|посидели|скинул.*кент|скинул.*шав|покушать|доставк|самокат|лавка|купер|деливери/i.test(lower)) {
      category = 'Рестораны';
      iconEmoji = '🍽️';
    }
    // Subscriptions & Digital Services
    else if (/спотик|spotify|эппл.*мьюзик|apple.*music|яндекс.*плюс|плюс\b|телег|telegram.*prem|tg.*prem|нетфликс|netflix|ютуб|youtube|кинопоиск|иви|ivi|окко|okko|кион|kion|premier|start|впн|vpn|хостинг|сервер|vps|vds|домен|айклауд|icloud|гугл.*диск|облако|подписк|chatgpt|gpt|midjourney|github|figma/i.test(lower)) {
      category = 'Подписки';
      iconEmoji = '📱';
    }
    // Shopping, Clothes & Marketplaces
    else if (/шмот|педал|тяги|кросс|кед|сникер|ботинк|худи|зипк|толстовк|свитшот|куртк|пуховик|пальто|джинс|штаны|брюк|футболк|мерч|вб\b|вэбэ|вайлдберриз|wildberries|озон|ozon|яндекс.*маркет|маркетплейс|мегамаркет|авито|цум|гум|стокманн|зарин|лайм|lime|befree|lamoda|ламода|косметик|духи|парфюм|золот.*яблок|зя\b|летуаль|шопинг|покупк/i.test(lower)) {
      category = 'Покупки';
      iconEmoji = '🛍️';
    }
    // Health, Fitness & Medical
    else if (/зал\b|качалк|спортзал|фитнес|трен[яе]|тренировк|тренер|персоналк|абонемент|протеин|креатин|бцаа|аптек|таблетк|колес[а]|витамин|омег[а]|врач|доктор|терапевт|стоматолог|зуб|пломб|брекет|элайнер|мрт|кт|узи|анализ|инвитро|гемотест|kdl|здоровь|массаж|психолог|остиопат|спа\b/i.test(lower)) {
      category = 'Здоровье';
      iconEmoji = '🏥';
    }
    // Housing, Renovation & Utilities
    else if (/аренд|квартир|хат|ипотек|жкх|коммуналк|квартплат|свет|электричеств|вод[аы]|отоплен|газ\b|домофон|капремонт|интернет|вайфай|провайдер|ростелеком|домру|клининг|уборк|ремонт|стройк|обои|краск|плитк|ламинат|сантехник|леруа|лемана.*про|петрович|оби|obi|мебель|икеа|ikea|hoff|диван|кровать|шкаф|стол|матрас/i.test(lower)) {
      category = 'Жилье';
      iconEmoji = '🏠';
    }
    // Groceries & Supermarkets
    else if (/продукт|магазин|пятерочк|пятак|перекресток|магнит|вкусвилл|лента|ашан|дикси|спар|spar|метро|глобус|хлеб|молоко|сыр|мясо|яйца|масло|овощ|фрукт|еда/i.test(lower)) {
      category = 'Продукты';
      iconEmoji = '🛒';
    }
    // Entertainment, Gaming & Hobbies
    else if (/стим\b|steam|донат|скин|батлпас|battle.*pass|бп\b|вбакс|v-bucks|кино|фильм|сеанс|театр|спектакль|концерт|фест|фестивал|стендап|квест|боулинг|бильярд|страйкбол|парк|аттракцион|зоопарк|аквапарк|баня|сауна|настолк|игры/i.test(lower)) {
      category = 'Развлечения';
      iconEmoji = '🎉';
    }
    // Investments & Crypto
    else if (/акци|облигац|офз|брокер|тинькофф.*инвест|бкс|крипт|биткоин|биток|btc|эфир|eth|usdt|тезер|тон\b|ton\b|байбит|bybit|бинанс|binance/i.test(lower)) {
      category = 'Инвестиции';
      iconEmoji = '📈';
    }
  }

  // Clean description: remove stop words and action prefixes
  const stopWords = new Set([
    'за', 'на', 'в', 'во', 'из', 'по', 'с', 'со', 'от', 'для', 'к', 'ко',
    'рублей', 'руб', 'рубля', 'р', 'сегодня', 'вчера', 'позавчера',
    'я', 'мне', 'у', 'меня', 'мы', 'нам',
    'тысяч', 'тысячи', 'тыщ', 'тыс', 'миллион', 'миллиона', 'миллионов', 'млн', 'лям', 'лямов', 'лимон', 'лимонов',
    'миллиард', 'миллиарда', 'миллиардов', 'млрд', 'ярд', 'ярдов', 'арбуз', 'арбузов',
    'косарь', 'косаря', 'косарей', 'кусок', 'куска', 'кусков', 'штука', 'штуки', 'штук', 'тонна', 'тонн',
    'сотка', 'сотку', 'сотен', 'полтос', 'полтинник', 'сорокет', 'пятихатка', 'двушка', 'трешка', 'пятерка', 'чирик',
    'баксов', 'долларов', 'евро', 'юаней', 'usdt'
  ]);
  const actionPrefixes = [
    'получил', 'получила', 'заработал', 'заработала', 'поднял', 'подняла', 'срубил', 'срубила',
    'купил', 'купила', 'потратил', 'потратила', 'взял', 'взяла', 'скинул', 'скинула',
    'перевел', 'перевела', 'перечислил', 'перечислила', 'капнул', 'капнуло', 'начислили', 'начислил',
    'отдал', 'отдала', 'упал', 'упали', 'упало', 'прилетел', 'прилетело', 'прилетели', 'залетел', 'залетело',
    'оплатил', 'оплатила'
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
    cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
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
  'Транспорт': '🚕',
  'Такси': '🚕',
  'Зарплата': '💰',
  'Фриланс': '💼',
  'Дивиденды': '📈',
  'Инвестиции': '📈',
  'Продажи': '🏷️',
  'Кэшбэк': '💳',
  'Возврат долга': '🤝',
  'Подписки': '📱',
  'Здоровье': '🏥',
  'Спорт': '🏃',
  'Покупки': '🛍️',
  'Техника': '💻',
  'Жилье': '🏠',
  'ЖКХ': '⚡',
  'Питомцы': '🐾',
  'Животные': '🐾',
  'Хозяйство': '🌾',
  'Путешествия': '✈️',
  'Образование': '📚',
  'Развлечения': '🎉',
  'Подарки': '🎁',
  'Авто': '🚘'
};

const getCategoryIcon = (cat, type) => {
  if (categoryIcons[cat]) return categoryIcons[cat];
  const c = String(cat || '').toLowerCase();
  if (type === 'income') {
    if (/фриланс|проект|клиент|заказ|дизайн|разработк/i.test(c)) return '💼';
    if (/инвест|дивиденд|купон|акци|крипт/i.test(c)) return '📈';
    if (/продаж|авито/i.test(c)) return '🏷️';
    if (/подар|чаев|донат/i.test(c)) return '🎁';
    if (/кэшбэк|бонус/i.test(c)) return '💳';
    if (/долг|возврат/i.test(c)) return '🤝';
    return '💰';
  }
  if (/питом|животн|коров|бык|собак|кошк|корм|вет/i.test(c)) return '🐾';
  if (/хозяйств|ферм/i.test(c)) return '🌾';
  if (/транспорт|такси|авто|машин|бензин|метро/i.test(c)) return '🚕';
  if (/кофе|кафе|пекарн/i.test(c)) return '☕';
  if (/ресторан|бар|пицц|бургер|еда|доставк/i.test(c)) return '🍽️';
  if (/техник|гаджет|комп|айфон|ноут/i.test(c)) return '💻';
  if (/подписк|сервис|онлайн/i.test(c)) return '📱';
  if (/покупк|одежд|шмот|шопинг/i.test(c)) return '🛍️';
  if (/здоров|спорт|фитнес|аптек|врач/i.test(c)) return '🏥';
  if (/жил|аренд|квартир|жкх|коммунал/i.test(c)) return '🏠';
  if (/развлечен|кино|игра|парк/i.test(c)) return '🎉';
  if (/продукт|супермаркет/i.test(c)) return '🛒';
  return '💳';
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
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    wallet: '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"></path>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'
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

  const avatarDisplay = getAvatarHtml(profile.avatar, userInitial, 36);

  return `
    <header class="masthead">
      <div class="brand" data-tab="home">
        <div class="brand-icon">
          ${icon('sparkle', 18)}
        </div>
        <div style="display: flex; align-items: center;">
          <span class="brand-name">FinKaif</span>
          <span class="brand-badge">8.20</span>
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
        <div class="balance-pill num" id="masthead-balance-pill" title="${privacyMode ? 'Показать баланс (горячая клавиша P)' : 'Скрыть баланс (горячая клавиша P)'}">
          <span class="pulse-dot"></span>
          <span id="masthead-balance-figure">${money(balance)}</span>
          <button class="privacy-toggle-btn ${privacyMode ? 'active' : ''}" id="btn-toggle-privacy" title="${privacyMode ? 'Показать баланс' : 'Скрыть баланс'}">
            ${privacyMode ? icon('eyeOff', 14) : icon('eye', 14)}
          </button>
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
    let iconEmoji = '📱';
    if (/яндекс|yandex|плюс/i.test(nameLower)) iconEmoji = '🟡';
    else if (/telegram|телег/i.test(nameLower)) iconEmoji = '✈️';
    else if (/spotify|спотик|музык|apple\s*music/i.test(nameLower)) iconEmoji = '🎧';
    else if (/cloud|облак|icloud|drive/i.test(nameLower)) iconEmoji = '☁️';
    else if (/зал|спорт|фитнес|gym/i.test(nameLower)) iconEmoji = '🏋️';
    else if (/интернет|провайдер|связь|мтс|мегафон|билайн|т2/i.test(nameLower)) iconEmoji = '🌐';
    else if (/ютуб|youtube|netflix|нетфликс|кинопоиск|иви/i.test(nameLower)) iconEmoji = '🎬';

    return { daysLeft, badgeText, badgeClass, cardClass, iconEmoji, day };
  };

  const enrichedSubs = subs.map(s => ({ ...s, meta: getSubMeta(s) }))
    .sort((a, b) => a.meta.daysLeft - b.meta.daysLeft);

  const totalMonthly = subs.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalAnnual = totalMonthly * 12;

  const existingNames = new Set(subs.map(s => (s.name || '').toLowerCase().trim()));
  const presetSuggestions = [
    { name: 'Яндекс Плюс', amount: 299, day: 25, icon: '🟡', cat: 'Подписки' },
    { name: 'Telegram Premium', amount: 299, day: 12, icon: '✈️', cat: 'Подписки' },
    { name: 'Spotify Premium', amount: 299, day: 1, icon: '🎧', cat: 'Подписки' },
    { name: 'Облако iCloud / Drive', amount: 1490, day: 15, icon: '☁️', cat: 'Подписки' },
    { name: 'Фитнес-клуб', amount: 2500, day: 5, icon: '🏋️', cat: 'Здоровье' },
    { name: 'Домашний интернет', amount: 650, day: 1, icon: '🌐', cat: 'Жилье' }
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
                <div class="sub-icon-box">${s.meta.iconEmoji}</div>
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
          <div style="font-size: 28px; margin-bottom: 8px;">📡</div>
          <div style="font-size: 14.5px; font-weight: 700; color: #FFFFFF; margin-bottom: 4px;">Радар пока чист</div>
          <p style="font-size: 12.5px; color: var(--text-muted); max-width: 480px; margin: 0 auto 16px auto;">
            Добавьте ваши регулярные сервисы (Яндекс, Telegram, облачные хранилища, фитнес или интернет), чтобы видеть предстоящие списания и годовую стоимость.
          </p>
        </div>
      `}

      ${presetSuggestions.length > 0 ? `
        <div class="quick-pills-strip" style="margin-bottom: 14px; padding-top: 6px;">
          <span class="quick-pills-label">⚡ Быстрый радар:</span>
          ${presetSuggestions.slice(0, 4).map(p => `
            <button type="button" class="quick-pill-btn sub-preset-add-btn" data-name="${esc(p.name)}" data-amt="${p.amount}" data-day="${p.day}" data-cat="${esc(p.cat)}">
              <span>${p.icon}</span>
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
            <span style="font-size: 20px;">📅</span>
            <h3 class="modal-title">Новое списание в Радар</h3>
          </div>
          <button type="button" class="btn-icon" id="btn-close-sub-modal">${icon('close', 16)}</button>
        </div>

        <div class="quick-pills-strip" style="margin-bottom: 14px;">
          <span class="quick-pills-label">Шаблоны:</span>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Яндекс Плюс" data-amt="299" data-day="25" data-cat="Подписки">
            <span>🟡</span> <span>Яндекс 299 ₽</span>
          </button>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Telegram Premium" data-amt="299" data-day="12" data-cat="Подписки">
            <span>✈️</span> <span>TG 299 ₽</span>
          </button>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Spotify" data-amt="299" data-day="1" data-cat="Подписки">
            <span>🎧</span> <span>Spotify 299 ₽</span>
          </button>
          <button type="button" class="quick-pill-btn sub-modal-preset" data-name="Облако" data-amt="1490" data-day="15" data-cat="Подписки">
            <span>☁️</span> <span>Облако 1 490 ₽</span>
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

  if (period === 'year') {
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

  const mskHour = getMskDate().getHours();
  let timeGreeting = 'Добрый день';
  if (mskHour >= 5 && mskHour < 12) timeGreeting = 'Доброе утро';
  else if (mskHour >= 12 && mskHour < 18) timeGreeting = 'Добрый день';
  else if (mskHour >= 18 && mskHour < 23) timeGreeting = 'Добрый вечер';
  else timeGreeting = 'Доброй ночи';

  return `
    <div class="view-header">
      <div>
        <div class="view-greeting">${timeGreeting}, ${esc(userName)}</div>
        <h1 class="view-title">Финансовый баланс</h1>
        <p class="view-subtitle">Сводный обзор капитала, ежедневные потоки и операционные записи.</p>
      </div>
    </div>

    <!-- Main Capital Hero Card -->
    <div class="hero-balance-card ${isDeficit ? 'deficit' : ''}">
      <div class="hero-topline">
        <span class="hero-label" id="hero-balance-lbl">Чистый свободный остаток</span>
        <div class="period-tabs">
          <button class="period-tab ${period === '7d' ? 'active' : ''}" data-period="7d">Неделя</button>
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
    <div class="quick-express-card">
      <div class="quick-express-top">
        <div class="quick-input-wrap">
          <span class="quick-input-icon">${icon('sparkle', 16)}</span>
          <input id="quick-express-input" placeholder="Экспресс-запись: «кофе 250», «получил 50к», «зарплата 80к вчера»..." autocomplete="off">
          <div class="quick-input-right-actions">
            <button type="button" class="btn-clear-quick" id="btn-clear-quick" style="display: none;" title="Очистить">${icon('close', 12)}</button>
            <button type="button" class="btn-voice-express" id="btn-voice-express" title="Голосовой ввод: нажмите и говорите">
              ${icon('mic', 15)}
            </button>
          </div>
        </div>
        <button class="btn-submit-express" id="btn-submit-express">
          ${icon('plus', 14)}
          <span>Записать</span>
        </button>
      </div>

      <!-- Live parse preview bar -->
      <div id="quick-parse-preview" class="quick-parse-preview" style="display: none;"></div>

      <!-- 1-Tap Quick Tap Pills (Монетки) -->
      <div class="quick-pills-strip">
        <span class="quick-pills-label">Быстрые траты:</span>
        <button class="quick-pill-btn" data-type="expense" data-cat="Кафе" data-amt="250" data-desc="Кофе с собой">
          <span>☕</span> <span>Кофе 250 ₽</span>
        </button>
        <button class="quick-pill-btn" data-type="expense" data-cat="Транспорт" data-amt="450" data-desc="Такси">
          <span>🚕</span> <span>Такси 450 ₽</span>
        </button>
        <button class="quick-pill-btn" data-type="expense" data-cat="Рестораны" data-amt="650" data-desc="Обед">
          <span>🍽️</span> <span>Обед 650 ₽</span>
        </button>
        <button class="quick-pill-btn" data-type="expense" data-cat="Продукты" data-amt="1200" data-desc="Супермаркет">
          <span>🛒</span> <span>Продукты 1 200 ₽</span>
        </button>
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

  if (analyticsPeriod === '7d') {
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
        <button class="analytics-period-btn ${analyticsPeriod === '7d' ? 'active' : ''}" data-aperiod="7d">Неделя</button>
        <button class="analytics-period-btn ${analyticsPeriod === '30d' ? 'active' : ''}" data-aperiod="30d">30 дней</button>
        <button class="analytics-period-btn ${analyticsPeriod === 'month' ? 'active' : ''}" data-aperiod="month">Этот месяц</button>
        <button class="analytics-period-btn ${analyticsPeriod === 'all' ? 'active' : ''}" data-aperiod="all">Все время</button>
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
            <span class="popover-title">📈 Чистый денежный поток</span>
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
            💡 Показывает, сколько свободных денег оседает в вашем капитале после всех трат периода.
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
            <span class="popover-title">🔥 Темп трат (Burn Rate)</span>
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
            💡 Показывает скорость сгорания денег в сутки. При текущем темпе ${dailyIncomeRate > 0 ? `вы сохраняете ${Math.max(0, 100 - Math.round((dailyVelocity / dailyIncomeRate) * 100))}% всех поступлений` : 'контролируйте запас капитала'}.
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
            <span class="popover-title">💼 Остаток на конец месяца</span>
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
            🛡 Консервативный расчет: намеренно не прибавляет гипотетические доходы, чтобы показать гарантированный финансовый остаток.
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
          <span class="metric-icon inc">${userRank.badge}</span>
        </div>
        <div class="metric-value rank-text">${userRank.title}</div>
        <div class="metric-footnote">${userRank.desc}</div>

        <div class="metric-popover" id="tt-financial-status">
          <div class="metric-popover-header">
            <span class="popover-title">👑 Финансовый статус</span>
            <button type="button" class="popover-close" data-close="tt-financial-status">✕</button>
          </div>
          <p class="popover-desc">Ваш инвестиционный ранг по методологии FinKaif OS. Растет по мере накопления капитала и достижения целей.</p>
          <div class="popover-breakdown">
            <div class="p-row"><span>Текущий ранг:</span> <strong>${userRank.title}</strong></div>
            <div class="p-row"><span>Свободный капитал:</span> <strong class="inc">${money(currentBalance)}</strong></div>
            <div class="p-row"><span>Уровень капитала:</span> <strong>${userRank.desc}</strong></div>
          </div>
          <div class="popover-hint">
            🏆 Пополняйте цели и контролируйте расходы, чтобы повышать свой статус в системе.
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
                  data-icon="${s.icon}"
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
    if (txFilter !== 'all' && t.type !== txFilter) return false;
    if (txMonthFilter !== 'all') {
      const iso = getTxIso(t);
      if (!iso || !iso.startsWith(txMonthFilter)) return false;
    }
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
      <div style="display: flex; gap: 8px; align-items: center;">
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
    <div class="tx-card tx-row-clickable" data-id="${t.id}" title="Нажмите для редактирования операции">
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
                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                    <span class="badge-tag ${actualDaily <= plannedDaily ? 'jade' : 'amber'}">
                      ${actualDaily <= plannedDaily ? `🟢 Темп в норме (−${money(Math.abs(paceDelta))} от графика)` : `🟡 Опережение темпа (+${money(paceDelta)} от графика)`}
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

    <!-- Subscriptions & Recurring Bills in Budgets View -->
    ${renderSubscriptionRadar()}
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
              <div class="number-stepper-wrap" style="flex: 1;">
                <input class="form-input num goal-topup-input" data-id="${g.id}" type="number" min="1" step="any" placeholder="Сумма пополнения...">
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
  const finScore = calculateFinScore();
  const thinkingPhases = [
    '🔍 Считываю структуру транзакций и баланс...',
    '⚡ Рассчитываю финансовую скорость (Burn Rate)...',
    '🔮 Моделирую сценарий сложного процента...',
    '🧠 Синтезирую персональную стратегию...'
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
        <button class="assistant-mode-pill" data-prompt="Полная экспресс-диагностика FinScore">
          <span>🩺</span> <span>Аудит FinScore</span>
        </button>
        <button class="assistant-mode-pill" data-prompt="Когда я смогу выйти на FIRE (пассивный доход)?">
          <span>🔥</span> <span>FIRE & Свобода</span>
        </button>
        <button class="assistant-mode-pill" data-prompt="Где я теряю больше всего денег и как оптимизировать?">
          <span>🕵️‍♂️</span> <span>Детектив утечек</span>
        </button>
        <button class="assistant-mode-pill" data-prompt="Прогноз капитала через 5 лет со сложным процентом">
          <span>🔮</span> <span>Прогноз 5 лет</span>
        </button>
        <button class="assistant-mode-pill" data-prompt="Проведи полный аудит моих регулярных подписок и повторяющихся платежей: посчитай сумму за год и найди скрытые утечки бюджета">
          <span>📅</span> <span>Аудит подписок</span>
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
            <span class="wealth-sim-icon">⚡</span>
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
              <span>✨</span> <span>Спросить ассистента об этом плане</span>
            </button>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="assistant-layout">
      <!-- Quick Prompt Suggestions Sidebar -->
      <div class="assistant-sidebar">
        <div class="assistant-sidebar-title">СТРАТЕГИИ И ВОПРОСЫ</div>
        <div class="assistant-suggestions">
          <button class="suggestion-chip" data-prompt="Когда я смогу выйти на FIRE (пассивный доход)?">
            <span class="chip-sparkle">🔥</span>
            <div>
              <div class="chip-title">FIRE & Свобода</div>
              <div class="chip-sub">Срок до пассивного дохода</div>
            </div>
          </button>
          <button class="suggestion-chip" data-prompt="Где я теряю больше всего денег и как оптимизировать?">
            <span class="chip-sparkle">🕵️‍♂️</span>
            <div>
              <div class="chip-title">Детектив утечек</div>
              <div class="chip-sub">Поиск эмоциональных трат</div>
            </div>
          </button>
          <button class="suggestion-chip" data-prompt="На сколько месяцев мне хватит подушки безопасности?">
            <span class="chip-sparkle">🛡️</span>
            <div>
              <div class="chip-title">Запас прочности (Runway)</div>
              <div class="chip-sub">Стресс-тест на случай ЧП</div>
            </div>
          </button>
          <button class="suggestion-chip" data-prompt="Прогноз капитала через 5 лет со сложным процентом">
            <span class="chip-sparkle">🔮</span>
            <div>
              <div class="chip-title">Сложный процент</div>
              <div class="chip-sub">Рост капитала за 1, 3, 5 лет</div>
            </div>
          </button>
          <button class="suggestion-chip" data-prompt="Как распределить доход по правилу 50/30/20?">
            <span class="chip-sparkle">⚖️</span>
            <div>
              <div class="chip-title">Ритуал 50/30/20</div>
              <div class="chip-sub">Сначала заплати себе</div>
            </div>
          </button>
          <button class="suggestion-chip" data-prompt="Полная экспресс-диагностика FinScore">
            <span class="chip-sparkle">🩺</span>
            <div>
              <div class="chip-title">Аудит FinScore</div>
              <div class="chip-sub">Оценка финансового здоровья</div>
            </div>
          </button>
        </div>

        <div class="assistant-note-card">
          <div style="font-weight: 700; color: #FFFFFF; font-size: 12px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>🛡️</span> <span>Защита данных</span>
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
              <p style="font-size: 13px; color: var(--text-secondary); max-width: 440px; margin: 0 auto; line-height: 1.5;">
                Задайте вопрос о сроке выхода на FIRE, поиске скрытых утечек денег, моделировании сложного процента или расчете финансовой подушки.
              </p>
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

        <form class="chat-input-bar" id="assistant-form">
          <input id="assistant-input" placeholder="Спросите о FIRE, прогнозе капитала, сокращении трат или 50/30/20..." required autocomplete="off">
          <button type="submit" class="chat-send-btn" id="chat-send-btn" title="Отправить вопрос">
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

          <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Сумма (${currencySymbols[profile.currency] || '₽'})</label>
              <div class="number-stepper-wrap">
                <input class="form-input num" id="form-amount" type="number" min="0.01" step="any" placeholder="0" required>
                <div class="input-spin-steppers">
                  <button type="button" class="spin-step-btn" data-target="form-amount" data-step="100" title="Увеличить на 100" aria-label="Увеличить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                  <button type="button" class="spin-step-btn" data-target="form-amount" data-step="-100" title="Уменьшить на 100" aria-label="Уменьшить">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
              <div id="tx-rub-equivalent" style="font-size: 11px; color: var(--accent-jade); margin-top: 4px; display: none;"></div>
            </div>
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
            <label class="form-label">Описание</label>
            <input class="form-input" id="form-desc" placeholder="Например: Супермаркет, заказ...">
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
            ${getAvatarHtml(profile.avatar, userInitial, 70)}
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
          <!-- Photo Upload & Current Avatar Card -->
          <div class="form-group" style="margin-bottom: 20px;">
            <div class="avatar-section-title">
              <label class="form-label" style="margin-bottom: 0;">Фото профиля</label>
              <span style="font-size: 11px; color: var(--accent-jade); font-weight: 600;">FinKaif 8.20</span>
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
            <div class="mobile-sheet-item-icon">⚙️</div>
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
          <div class="payday-confetti-star">🎉</div>
          <h3 class="payday-title">Отличное поступление!</h3>
          <div class="payday-amt-badge num">+${new Intl.NumberFormat('ru-RU').format(amt)} ₽</div>
          <p class="payday-subtitle">Время защитить доход по формуле <strong>50 / 30 / 20</strong> — «Сначала заплати себе».</p>
        </div>

        <div class="payday-split-grid">
          <div class="payday-split-item box-savings">
            <div class="payday-split-icon">🛡️</div>
            <div class="payday-split-content">
              <div class="payday-split-label">20% — Сбережения и цели</div>
              <div class="payday-split-val num">+${new Intl.NumberFormat('ru-RU').format(savings)} ₽</div>
              <div class="payday-split-hint">Резервная подушка и инвестиции</div>
            </div>
          </div>

          <div class="payday-split-item box-needs">
            <div class="payday-split-icon">🏠</div>
            <div class="payday-split-content">
              <div class="payday-split-label">50% — Базовые расходы</div>
              <div class="payday-split-val num">+${new Intl.NumberFormat('ru-RU').format(needs)} ₽</div>
              <div class="payday-split-hint">Жильё, продукты, счета, обязательства</div>
            </div>
          </div>

          <div class="payday-split-item box-wants">
            <div class="payday-split-icon">✨</div>
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
        <div class="view-container">
          ${viewHtml}
        </div>
      </main>
      ${renderMobileBottomBar()}
      ${renderModal()}
      ${renderProfileModal()}
      ${renderPaydayModal()}
      ${renderSubscriptionModal()}
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
      const balInRub = incTot - expTot;
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
        alert('Пожалуйста, выберите файл изображения (PNG, JPG, WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
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
          updateModalAvatarPreview();
          renderApp();
          const pm = document.getElementById('profile-modal');
          if (pm) pm.style.display = 'flex';
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  const btnResetAv = document.getElementById('btn-avatar-reset-default');
  if (btnResetAv) {
    btnResetAv.onclick = () => {
      profile.avatar = 'default';
      updateModalAvatarPreview();
      renderApp();
      const pm = document.getElementById('profile-modal');
      if (pm) pm.style.display = 'flex';
    };
  }

  // Currency Selection with Live Instant Conversion
  $$('.currency-pill-btn').forEach(btn => {
    btn.onclick = () => {
      const cur = btn.getAttribute('data-currency');
      profile.currency = cur;
      localStorage.setItem('finkaif_currency', profile.currency);
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
      const confirmed = await showConfirmDialog({
        title: 'Выход из аккаунта',
        message: 'Вы действительно хотите завершить текущую сессию в FinKaif OS?',
        confirmText: 'Выйти',
        cancelText: 'Отмена',
        danger: true,
        icon: '🚪'
      });
      if (confirmed) {
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

    // Full Mobile Touch Support
    homeWrap.addEventListener('touchstart', e => {
      if (e.touches && e.touches.length > 0) {
        handleHomeScrub(e.touches[0].clientX);
      }
    }, { passive: true });

    homeWrap.addEventListener('touchmove', e => {
      if (e.touches && e.touches.length > 0) {
        e.preventDefault(); // lock vertical scroll while scrubbing the chart
        handleHomeScrub(e.touches[0].clientX);
      }
    }, { passive: false });

    homeWrap.addEventListener('touchend', () => {
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
      // EDIT MODE
      editingTxId = txOrType.id;
      if (modalTitle) {
        modalTitle.innerHTML = `Редактирование операции <span class="tx-badge-editing">Изменение</span>`;
      }
      if (typeSelect) typeSelect.value = txOrType.type || 'expense';
      if (catInput) catInput.value = txOrType.category || '';
      if (amtInput) amtInput.value = profile.currency === 'RUB' ? (txOrType.amount || '') : Number(convertFromRub(txOrType.amount).toFixed(2));
      if (dateInput) dateInput.value = getTxIso(txOrType);
      if (timeInput) timeInput.value = formatTxTime(txOrType);
      if (descInput) descInput.value = txOrType.description || '';
      if (submitBtn) submitBtn.innerText = 'Сохранить изменения';
      if (deleteBtnWrap) deleteBtnWrap.style.display = 'block';

      $$('.cat-chip').forEach(c => {
        if (c.getAttribute('data-cat') === txOrType.category) c.classList.add('selected');
        else c.classList.remove('selected');
      });
    } else {
      // CREATE MODE
      editingTxId = null;
      const type = typeof txOrType === 'string' ? txOrType : 'expense';
      if (modalTitle) modalTitle.innerText = 'Новая операция';
      if (typeSelect) typeSelect.value = type;
      if (catInput) catInput.value = type === 'income' ? 'Зарплата' : 'Продукты';
      if (amtInput) amtInput.value = '';
      if (dateInput) dateInput.value = toDateIso(getMskDate());
      if (timeInput) {
        const d = getMskDate();
        timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      if (descInput) descInput.value = '';
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
        icon: '🗑️'
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
          alert('Ошибка удаления: ' + err.message);
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
      if (typeSelect) typeSelect.value = catType;
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
        alert('Заполните категорию и сумму операции');
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
            const ok = await showConfirmDialog({
              title: 'Превышение лимита бюджета',
              message: `Категория «${category}» имеет установленный лимит ${money(lim)} в месяц.\nУже израсходовано: ${money(spentThisMonth)}.\n\nС сохранением этой записи (${money(amount)}) перерасход составит ${money(overspend)}!\n\nВы точно хотите зафиксировать этот расход сверх лимита?`,
              confirmText: 'Зафиксировать расход',
              cancelText: 'Отмена',
              danger: true,
              icon: '⚠️'
            });
            if (!ok) return;
          }
        }
      }

      try {
        const submitBtn = txForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Сохранение...'; }
        if (editingTxId) {
          await api('transactions/' + editingTxId, {
            method: 'PUT',
            body: JSON.stringify({ type, category, amount, occurred_on, time: timeVal, created_at, description })
          });
        } else {
          await api('transactions', {
            method: 'POST',
            body: JSON.stringify({ type, category, amount, occurred_on, time: timeVal, created_at, description })
          });
          if (type === 'income' && amount >= 15000) {
            paydaySplitData = { amount };
          }
        }
        const modal = document.getElementById('tx-modal');
        if (modal) modal.style.display = 'none';
        editingTxId = null;
        await refreshAllData();
        renderApp();
      } catch (err) {
        alert('Ошибка сохранения операции: ' + err.message);
        const submitBtn = txForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Сохранить'; }
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

  // Click on Transaction Card to Edit
  $$('.tx-card').forEach(card => {
    card.onclick = e => {
      if (e.target.closest('.tx-delete-btn')) return;
      const id = card.getAttribute('data-id');
      const tx = data.transactions.find(t => String(t.id) === String(id));
      if (tx) {
        openTxModal(tx);
      }
    };
  });

  // Mobile Bottom Bar Navigation
  $$('.mobile-nav-btn[data-tab]').forEach(btn => {
    btn.onclick = () => {
      tab = btn.getAttribute('data-tab');
      renderApp();
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
      tab = btn.getAttribute('data-tab');
      if (mobileSheet) mobileSheet.style.display = 'none';
      renderApp();
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

  // Delete Transaction button
  $$('.tx-delete-btn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const confirmed = await showConfirmDialog({
        title: 'Удалить операцию?',
        message: 'Эта операция будет безвозвратно удалена из вашей финансовой истории.',
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        danger: true,
        icon: '🗑️'
      });
      if (confirmed) {
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

  // ==========================================================================
  // PRIVACY MODE TOGGLE & HOTKEY
  // ==========================================================================
  const togglePrivacy = () => {
    privacyMode = !privacyMode;
    localStorage.setItem('finkaif_privacy', privacyMode ? 'true' : 'false');
    renderApp();
  };

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
        <span class="preview-pill type ${parsed.type}">${parsed.type === 'income' ? '🟢 Поступление' : '🔴 Расход'}</span>
        <span class="preview-pill cat">${parsed.icon || '💳'} ${esc(parsed.category)}</span>
        <span class="preview-pill amt num">${parsed.type === 'income' ? '+' : '−'}${new Intl.NumberFormat('ru-RU').format(parsed.amount)} ₽</span>
        <span class="preview-pill date">📅 ${esc(parsed.dateLabel || 'Сегодня')}</span>
        <span class="preview-pill desc">💬 «${esc(parsed.description)}»</span>
        ${isAi ? '<span class="preview-pill ai-tag">✨ ИИ</span>' : ''}
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

    if (SpeechRecognition) {
      try {
        recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.continuous = false;
        recognition.interimResults = true;

        const stopRecording = () => {
          isRecording = false;
          btnVoiceExpress.classList.remove('recording');
          quickInput.classList.remove('voice-active');
          quickInput.placeholder = 'Экспресс-запись: «кофе 250», «получил 50к», «зарплата 80к вчера»...';
        };

        recognition.onstart = () => {
          isRecording = true;
          btnVoiceExpress.classList.add('recording');
          quickInput.classList.add('voice-active');
          quickInput.placeholder = 'Слушаю... (например: «я сегодня получил 50 тысяч рублей»)';
        };

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          quickInput.value = transcript;
          updateQuickPreview(true);
        };

        recognition.onerror = (event) => {
          console.warn('Voice recognition notice:', event.error);
          stopRecording();
        };

        recognition.onend = () => {
          stopRecording();
          updateQuickPreview(true);
        };

        btnVoiceExpress.onclick = () => {
          if (!isRecording) {
            try {
              recognition.start();
            } catch (e) {
              console.warn(e);
            }
          } else {
            recognition.stop();
          }
        };
      } catch (err) {
        console.warn('Voice API setup notice:', err);
      }
    } else {
      btnVoiceExpress.onclick = () => {
        alert('Голосовой ввод не поддерживается в этом браузере. Рекомендуем использовать Chrome, Safari или Edge.');
      };
    }
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
        alert('Введите сумму и категорию (например: «кофе 250», «получил 50к», «шавуха 350», «зарплата 80к»)');
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
        alert('Ошибка быстрой записи: ' + err.message);
      } finally {
        if (btnSubmitExpress) btnSubmitExpress.disabled = false;
      }
    };
  }

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
        alert('Ошибка быстрой записи: ' + err.message);
        pill.disabled = false;
      }
    };
  });

  // Pulse Category Cards Click -> Filter Analytics
  $$('.pulse-cat-card').forEach(card => {
    card.onclick = () => {
      const cat = card.getAttribute('data-cat');
      activeAnalyticsCat = cat;
      tab = 'analytics';
      renderApp();
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
        alert('Ошибка добавления: ' + err.message);
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
        alert('Укажите корректное название и сумму подписки.');
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
        alert('Ошибка сохранения подписки: ' + err.message);
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
        icon: '🗑️'
      });

      if (confirmed) {
        try {
          await api(`subscriptions/${id}`, { method: 'DELETE' });
          await refreshAllData();
          renderApp();
        } catch (err) {
          alert('Ошибка при удалении: ' + err.message);
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
        alert('Ошибка сохранения бюджета: ' + err.message);
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
        icon: '📊'
      });
      if (confirmed) {
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
      const confirmed = await showConfirmDialog({
        title: 'Удалить цель накопления?',
        message: 'Цель накопления и статистика по ней будут удалены.',
        confirmText: 'Удалить цель',
        cancelText: 'Отмена',
        danger: true,
        icon: '🎯'
      });
      if (confirmed) {
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
      '🔍 Считываю структуру транзакций и баланс...',
      '⚡ Рассчитываю финансовую скорость (Burn Rate)...',
      '🔮 Моделирую сценарий сложного процента...',
      '🧠 Синтезирую персональную стратегию...'
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
      const answer = res.answer || res.reply || 'Я проанализировал ваши данные. Проверьте текущий баланс и лимиты трат.';
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
      data.chat.push({ role: 'assistant', content: `⚠️ Ошибка: ${err.message}`, created_at: new Date().toISOString() });
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

  // Suggestion Chips with Direct Submission
  $$('.suggestion-chip').forEach(btn => {
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
      if (actTab) {
        tab = actTab;
        window.location.hash = tab;
        renderApp();
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
        icon: '💬'
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
}

/* ==========================================================================
   INITIALIZATION & DATA REFRESH
   ========================================================================== */
async function refreshAllData() {
  try {
    const [txs, bgs, gls, cht, subs] = await Promise.all([
      api('transactions').catch(() => []),
      api('budgets').catch(() => []),
      api('goals').catch(() => []),
      api('chat').catch(() => []),
      api('subscriptions').catch(() => [])
    ]);

    data.transactions = Array.isArray(txs) ? txs : [];
    data.budgets = Array.isArray(bgs) ? bgs : [];
    data.goals = Array.isArray(gls) ? gls : [];
    data.chat = Array.isArray(cht) ? cht : [];
    data.subscriptions = Array.isArray(subs) ? subs : [];
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
  fetchExchangeRates(); // Fetch live CBR exchange rates on launch

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
        profile.avatar = localStorage.getItem('finkaif_avatar') || prof.avatar || 'default';
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
