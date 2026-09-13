import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set("trust proxy", 1);

const port = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "finkaif_secret_jwt_key_fallback_2026";

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Auto-run schema migrations on startup so database is always ready
async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set.");
    return;
  }
  try {
    const schemaPath = path.join(__dirname, "db", "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, "utf8");
      await db.query(schema);
      try {
        await db.query(`
          DO $$ 
          BEGIN 
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check') THEN
              ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
              ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK(type IN ('income','expense','transfer'));
            END IF;
          END $$;
        `);
      } catch (migErr) {
        console.warn("Transfer constraint migration notice:", migErr.message);
      }
      console.log("Database schema initialized successfully.");
    }
  } catch (e) {
    console.error("Database schema init error:", e.message);
  }
}
initDb();

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false
}));

const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 14 * 24 * 60 * 60 * 1000
};

const token = user => jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "14d" });

function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const bearer = header && header.startsWith("Bearer ") ? header.slice(7) : null;
    const rawToken = bearer || req.cookies.finkaif_token;
    if (!rawToken) {
      return res.status(401).json({ error: "Требуется вход в аккаунт." });
    }
    req.user = jwt.verify(rawToken, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Требуется вход в аккаунт." });
  }
}

function fail(res, e) {
  console.error("Server error:", e);
  res.status(500).json({ error: e.message || "Ошибка сервера. Проверьте DATABASE_URL и настройки базы." });
}

app.get("/health", async (_req, res) => {
  try {
    await db.query("select 1");
    res.status(200).json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      return res.status(400).json({ error: "Введите корректный email и пароль не короче 6 символов." });
    }
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query("insert into users(email,password_hash) values($1,$2) returning id,email", [email, hash]);
    const user = r.rows[0];
    const userToken = token(user);
    res.cookie("finkaif_token", userToken, cookie).json({ user, token: userToken });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Этот email уже зарегистрирован." });
    fail(res, e);
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const r = await db.query("select id,email,password_hash from users where email=$1", [email]);
    const user = r.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: "Неверный email или пароль." });
    }
    const userToken = token(user);
    res.cookie("finkaif_token", userToken, cookie).json({ user: { id: user.id, email: user.email }, token: userToken });
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("finkaif_token", cookie).json({ ok: true });
});

// ============================================================================
// CURRENCY EXCHANGE RATES (CBR Central Bank of Russia with caching & fallbacks)
// ============================================================================
let cachedRates = {
  base: "RUB",
  date: new Date().toISOString().slice(0, 10),
  rates: { RUB: 1, USD: 0.0108, EUR: 0.00988, KZT: 5.26 },
  quotes: { USD: 92.5, EUR: 101.2, KZT: 0.19 },
  updated_at: new Date().toISOString()
};
let lastRatesFetch = 0;

async function fetchCbrRates() {
  if (Date.now() - lastRatesFetch < 60 * 60 * 1000) return cachedRates;
  try {
    const res = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const val = data.Valute;
      if (val && val.USD && val.EUR && val.KZT) {
        const usdRub = val.USD.Value;
        const eurRub = val.EUR.Value;
        const kztRub = val.KZT.Value / (val.KZT.Nominal || 100);
        cachedRates = {
          base: "RUB",
          date: data.Date ? data.Date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          rates: {
            RUB: 1,
            USD: Number((1 / usdRub).toFixed(6)),
            EUR: Number((1 / eurRub).toFixed(6)),
            KZT: Number((1 / kztRub).toFixed(4))
          },
          quotes: {
            USD: Number(usdRub.toFixed(2)),
            EUR: Number(eurRub.toFixed(2)),
            KZT: Number(kztRub.toFixed(4))
          },
          updated_at: new Date().toISOString()
        };
        lastRatesFetch = Date.now();
      }
    }
  } catch (err) {
    console.warn("CBR rates fetch failed, using fallback:", err.message);
  }
  return cachedRates;
}

app.get("/api/rates", async (req, res) => {
  const rates = await fetchCbrRates();
  res.json(rates);
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/profile", auth, async (req, res) => {
  try {
    const r = await db.query("select display_name, avatar, currency from user_settings where user_id=$1", [req.user.id]);
    if (r.rows[0]) {
      res.json(r.rows[0]);
    } else {
      res.json({ display_name: "", avatar: "default", currency: "RUB" });
    }
  } catch (e) {
    console.warn("Profile fetch fallback:", e.message);
    res.json({ display_name: "", avatar: "default", currency: "RUB" });
  }
});

app.post("/api/profile", auth, async (req, res) => {
  try {
    const { display_name, avatar, currency } = req.body;
    const name = String(display_name || "").slice(0, 50).trim();
    // Allow large data URI (base64 image up to 500KB)
    const av = String(avatar || "default").slice(0, 500000).trim();
    const cur = ["RUB", "USD", "EUR", "KZT"].includes(currency) ? currency : "RUB";

    const r = await db.query(
      `insert into user_settings(user_id, display_name, avatar, currency, updated_at)
       values($1, $2, $3, $4, now())
       on conflict(user_id) do update set
         display_name=excluded.display_name,
         avatar=excluded.avatar,
         currency=excluded.currency,
         updated_at=now()
       returning display_name, avatar, currency`,
      [req.user.id, name, av, cur]
    );
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

const tables = { transactions: "transactions", budgets: "budgets", goals: "goals" };

app.get("/api/:resource", auth, async (req, res) => {
  try {
    const table = tables[req.params.resource];
    if (!table) return res.status(404).json({ error: "Не найдено." });
    const sort = table === "transactions" ? "occurred_on desc, created_at desc" : "created_at desc";
    const r = await db.query(`select * from ${table} where user_id=$1 order by ${sort}`, [req.user.id]);
    res.json(r.rows);
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/transactions", auth, async (req, res) => {
  try {
    const x = req.body;
    if (!["income", "expense", "transfer"].includes(x.type) || !String(x.category || "").trim() || !(Number(x.amount) > 0)) {
      return res.status(400).json({ error: "Проверьте тип, категорию и сумму операции." });
    }
    const createdAt = x.created_at ? new Date(x.created_at) : new Date();
    const r = await db.query(
      "insert into transactions(user_id,type,category,description,amount,occurred_on,created_at) values($1,$2,$3,$4,$5,$6,$7) returning *",
      [req.user.id, x.type, String(x.category).trim(), String(x.description || "").trim(), Math.round(Number(x.amount) * 100) / 100, x.occurred_on || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(), isNaN(createdAt.getTime()) ? new Date() : createdAt]
    );
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

app.put("/api/transactions/:id", auth, async (req, res) => {
  try {
    const x = req.body;
    if (!["income", "expense", "transfer"].includes(x.type) || !String(x.category || "").trim() || !(Number(x.amount) > 0)) {
      return res.status(400).json({ error: "Проверьте тип, категорию и сумму операции." });
    }
    const createdAt = x.created_at ? new Date(x.created_at) : null;
    const r = await db.query(
      `update transactions set 
        type=$1, 
        category=$2, 
        description=$3, 
        amount=$4, 
        occurred_on=$5, 
        created_at=coalesce($6, created_at)
       where id=$7 and user_id=$8 returning *`,
      [
        x.type,
        String(x.category).trim(),
        String(x.description || "").trim(),
        Number(x.amount),
        x.occurred_on || new Date().toISOString().slice(0, 10),
        createdAt && !isNaN(createdAt.getTime()) ? createdAt : null,
        req.params.id,
        req.user.id
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Операция не найдена." });
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/budgets", auth, async (req, res) => {
  try {
    const x = req.body;
    if (!String(x.category || "").trim() || !(Number(x.limit_amount) > 0)) {
      return res.status(400).json({ error: "Проверьте категорию и сумму лимита." });
    }
    const r = await db.query(
      "insert into budgets(user_id,category,limit_amount) values($1,$2,$3) on conflict(user_id,category) do update set limit_amount=excluded.limit_amount returning *",
      [req.user.id, String(x.category).trim(), Number(x.limit_amount)]
    );
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/goals", auth, async (req, res) => {
  try {
    const x = req.body;
    if (!String(x.name || "").trim() || !(Number(x.target_amount) > 0)) {
      return res.status(400).json({ error: "Проверьте название и сумму цели." });
    }
    const r = await db.query(
      "insert into goals(user_id,name,target_amount,saved_amount) values($1,$2,$3,$4) returning *",
      [req.user.id, String(x.name).trim(), Number(x.target_amount), Math.max(0, Number(x.saved_amount) || 0)]
    );
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

app.put("/api/goals/:id", auth, async (req, res) => {
  try {
    const x = req.body;
    const r = await db.query(
      "update goals set saved_amount=coalesce($1, saved_amount), target_amount=coalesce($2, target_amount), name=coalesce($3, name) where id=$4 and user_id=$5 returning *",
      [x.saved_amount !== undefined ? Math.max(0, Number(x.saved_amount)) : null, x.target_amount ? Number(x.target_amount) : null, x.name ? String(x.name).trim() : null, req.params.id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Цель не найдена." });
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

app.delete("/api/:resource/:id", auth, async (req, res) => {
  try {
    const table = tables[req.params.resource];
    if (!table) return res.status(404).json({ error: "Не найдено." });
    await db.query(`delete from ${table} where id=$1 and user_id=$2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

app.get("/api/chat", auth, async (req, res) => {
  try {
    const r = await db.query("select role,content,created_at from chat_messages where user_id=$1 order by created_at asc limit 80", [req.user.id]);
    res.json(r.rows);
  } catch (e) {
    fail(res, e);
  }
});

const PROFANITY_PATTERNS = [
  /[хx][уy][йj]/i,
  /(?:^|[^а-яёa-z0-9])[хx][уy][еёяию]/i,
  /[пp][иeеi*][зz3*][дd]/i,
  /(?:^|[^а-яёa-z0-9])(?:еб[а-яё]|ёб[а-яё]|въеб|выеб|заеб|наеб|поеб|доеб|проеб|перееб|уеб|съеб|взъеб|ебл|ебу[чт]|ебат|ёбан|ебан)/i,
  /(?:^|[^а-яёa-z0-9])(?:бля|бляд|блять|блядь|блят|б[*_#]+д[а-яё]*)(?:$|[^а-яёa-z0-9])/i,
  /(?:^|[^а-яёa-z0-9])(?:сук[аиуео]|сучк[аиуео]|сучь)(?:$|[^а-яёa-z0-9])/i,
  /(?:^|[^а-яёa-z0-9])(?:муда[кч][а-яё]*)/i,
  /(?:^|[^а-яёa-z0-9])(?:пидор[а-яё]*|пидар[а-яё]*|педик[а-яё]*)/i,
  /(?:^|[^а-яёa-z0-9])(?:гандон[а-яё]*|гондон[а-яё]*)/i,
  /(?:^|[^а-яёa-z0-9])(?:залуп[а-яё]*)/i,
  /(?:^|[^а-яёa-z0-9])(?:шлюх[а-яё]*)/i,
  /(?:^|[^а-яёa-z0-9])(?:дроч[а-яё]*)/i,
  /(?:^|[^а-яёa-z0-9])(?:хер[а-яё]*|херов[а-яё]*)/i,
  /\b(fuck|fucking|fucker|shit|bullshit|bitch|cunt|asshole|dick|bastard|motherfucker)\b/i
];

function containsProfanity(text) {
  if (!text) return false;
  const raw = ' ' + String(text).trim() + ' ';
  if (PROFANITY_PATTERNS.some(p => p.test(raw))) return true;

  const deobfuscated = raw
    .replace(/[*#@]/g, '')
    .replace(/([а-яёa-z])\1{2,}/gi, '$1');
  return PROFANITY_PATTERNS.some(p => p.test(deobfuscated));
}

const POLITE_FINANCIAL_RESPONSES = [
  `🤝 **Эмоции в финансах вполне понятны — деньги штука волнительная!**\n\nНо давайте без крепких выражений: цифры любят хладнокровие и трезвый расчёт.\n\nНа чём сфокусируемся: оптимизируем бюджет, сократим лишние расходы или взглянем на ваш свободный остаток?`,
  `😅 **Ого, чувствую накал страстей! Давайте переведём этот пар в прибыль.**\n\nОставим крепкие слова за скобками и займёмся делом: какую финансовую задачу или категорию расходов разберём прямо сейчас?`,
  `🎩 **Финансовый рынок бывает суров, но в Finkaif мы держим марку делового этикета.**\n\nСпокойно, по полочкам и без лишних нервов: чем могу помочь с вашими доходами, бюджетами или целями накоплений?`,
  `🧘‍♂️ **Понимаю, порой от баланса и цен хочется высказаться от души!**\n\nСделаем глубокий вдох: я тут как раз для того, чтобы навести идеальный порядок в деньгах. С какой статьи расходов начнём разбор?`,
  `😉 **Крепкое слово баланс не пополнит, а вот грамотный учёт — запросто!**\n\nДавайте говорить на языке точных цифр. Что проанализируем: текущие траты, лимиты по категориям или прогресс по финансовым целям?`
];

function getPoliteProfanityReply() {
  const idx = Math.floor(Math.random() * POLITE_FINANCIAL_RESPONSES.length);
  return POLITE_FINANCIAL_RESPONSES[idx];
}

function generateBuiltinAdvice(question, transactions = [], budgets = [], goals = []) {
  if (containsProfanity(question)) {
    return getPoliteProfanityReply();
  }

  const q = String(question || '').toLowerCase();

  // Core Financial Aggregations
  const inc = transactions.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0);
  const exp = transactions.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0);
  const balance = inc - exp;
  const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : (balance > 0 ? 35 : 0);

  // Category Breakdown
  const expByCat = {};
  for (const t of transactions) {
    if (t.type === "expense") {
      const cat = t.category || "Прочее";
      expByCat[cat] = (expByCat[cat] || 0) + Number(t.amount || 0);
    }
  }

  const needsKeywords = /продукт|жиль|жкх|аренд|коммунал|аптек|врач|лекарств|здоровь|транспорт|метро|автобус|бензин/i;
  const wantsKeywords = /кафе|ресторан|кофе|ужин|доставк|бар|подписк|шопинг|покупк|одежд|развлечен|кино|хобби|такси/i;

  let needsExp = 0;
  let wantsExp = 0;
  for (const [cat, amt] of Object.entries(expByCat)) {
    if (needsKeywords.test(cat)) needsExp += amt;
    else if (wantsKeywords.test(cat)) wantsExp += amt;
    else { needsExp += amt * 0.5; wantsExp += amt * 0.5; }
  }
  if (needsExp === 0 && exp > 0) needsExp = Math.round(exp * 0.6);
  if (wantsExp === 0 && exp > 0) wantsExp = Math.round(exp * 0.4);

  const monthlyExp = exp > 0 ? Math.max(exp, 35000) : 45000;
  const monthlyInc = inc > 0 ? Math.max(inc, monthlyExp + 10000) : (monthlyExp + 25000);
  const monthlyNeeds = Math.round(needsExp > 0 ? needsExp : monthlyExp * 0.55);
  const monthlySurplus = Math.max(0, monthlyInc - monthlyExp);

  // Cushion & Runway
  const cushionGoal = (goals || []).find(g => /подушк|резерв|безопасн/i.test(g.name || ''));
  const totalSavedInGoals = (goals || []).reduce((s, g) => s + Number(g.saved_amount || 0), 0);
  const liquidCushion = cushionGoal ? Number(cushionGoal.saved_amount || 0) : (Math.max(0, balance) + totalSavedInGoals * 0.5);
  const runwayMonths = monthlyNeeds > 0 ? (liquidCushion / monthlyNeeds).toFixed(1) : "3.0";

  // Parse numbers from user input (e.g. 100к, 50000)
  let askedAmount = null;
  const kMatch = question.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:k|к|тыс\.?|тыщ)(?:\s|$)/i);
  const numMatch = question.match(/(?:^|\s)(\d[\d\s]*(?:[.,]\d+)?)(?:\s*(?:₽|\$|€|₸|руб\.?|р\.?))?(?:\s|$)/i);
  if (kMatch) {
    askedAmount = Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  } else if (numMatch) {
    const rawVal = numMatch[1].replace(/\s+/g, '').replace(',', '.');
    if (!isNaN(parseFloat(rawVal)) && parseFloat(rawVal) > 0) {
      askedAmount = Math.round(parseFloat(rawVal));
    }
  }

  // 1. FIRE & RETIREMENT / ФИНАНСОВАЯ НЕЗАВИСИМОСТЬ
  if (/fire|пенси|свобод|пассивн|не работать|капитал на будущее|финансовая независимость/i.test(q)) {
    const annualLivingExp = monthlyExp * 12;
    const fireNumber = Math.round(annualLivingExp * 25);
    const fatFireNumber = Math.round(annualLivingExp * 33);
    const currentCapital = Math.max(0, balance) + totalSavedInGoals;
    const progressPct = Math.min(100, Math.round((currentCapital / (fireNumber || 1)) * 100));

    const annualSavings = Math.max(monthlySurplus * 12, 120000);
    const r = 0.12;
    let years = 0;
    let accumulated = currentCapital;
    while (accumulated < fireNumber && years < 40) {
      accumulated = accumulated * (1 + r) + annualSavings;
      years++;
    }

    return `🔥 **Стратегия FIRE & Досрочная финансовая свобода:**\n\n` +
      `По классическому правилу безопасного изъятия капитала (Safe Withdrawal Rate 4%):\n\n` +
      `• Годовые расходы на жизнь: **${annualLivingExp.toLocaleString('ru-RU')} ₽** (${monthlyExp.toLocaleString('ru-RU')} ₽/мес)\n` +
      `• **Целевой капитал FIRE (4%):** **${fireNumber.toLocaleString('ru-RU')} ₽**\n` +
      `• Капитал максимального комфорта (Fat FIRE 3%): **${fatFireNumber.toLocaleString('ru-RU')} ₽**\n` +
      `• Текущий капитал в активах: **${currentCapital.toLocaleString('ru-RU')} ₽** (готовность: **${progressPct}%**)\n\n` +
      `📈 **Модель достижения при доходности 12% годовых:**\n` +
      `При текущем инвестиционном темпе (**${Math.round(annualSavings / 12).toLocaleString('ru-RU')} ₽/мес**) вы выйдете на пассивный доход через **~${years} ${years === 1 ? 'год' : (years < 5 ? 'года' : 'лет')}**.\n\n` +
      `⚡ **Рычаг ускорения:** увеличение инвестиций всего на **+15 000 ₽ в месяц** приблизит вашу свободу на **4.5 года раньше** благодаря силе сложного процента!\n\n` +
      `[ACTION:goals:gl-fire:Сформировать цель «Капитал FIRE»]\n` +
      `[ACTION:analytics:cf:Изучить денежный поток]`;
  }

  // 2. ДЕТЕКТИВ ТРАТ / ПОИСК УТЕЧЕК / ОПТИМИЗАЦИЯ
  if (/слив|утечк|лишн|оптимиз|где трачу|много трат|куда уходят|расход|эконом|урезать/i.test(q)) {
    const discretionaryList = Object.entries(expByCat)
      .filter(([cat]) => wantsKeywords.test(cat))
      .sort((a, b) => b[1] - a[1]);

    const topDiscretionary = discretionaryList.length > 0
      ? discretionaryList
      : [['Кафе и рестораны', Math.round(monthlyExp * 0.22)], ['Такси и транспорт', Math.round(monthlyExp * 0.12)], ['Подписки и импульсы', Math.round(monthlyExp * 0.08)]];

    const totalDiscretionary = topDiscretionary.reduce((s, [, a]) => s + a, 0);
    const annualDiscretionary = totalDiscretionary * 12;
    const save25 = Math.round(totalDiscretionary * 0.25);
    const save25Annual = save25 * 12;
    const fiveYearWealth = Math.round(save25 * ((Math.pow(1 + 0.12 / 12, 60) - 1) / (0.12 / 12)));

    const leakLines = topDiscretionary.slice(0, 4).map(([cat, amt]) => {
      const perYear = (amt * 12).toLocaleString('ru-RU');
      return `• **${cat}**: ${amt.toLocaleString('ru-RU')} ₽/мес → **${perYear} ₽ в год!**`;
    }).join('\n');

    return `🕵️‍♂️ **Детектив финансовых утечек FinKaif:**\n\n` +
      `Я проанализировал ваши транзакции и выделил главные статьи «эмоциональных и гибких трат»:\n\n` +
      `${leakLines}\n\n` +
      `🔍 **Итого на гибкие удовольствия:** **${totalDiscretionary.toLocaleString('ru-RU')} ₽ в месяц** (**${annualDiscretionary.toLocaleString('ru-RU')} ₽/год**).\n\n` +
      `💡 **Теория «Коэффициента Лайт» (The Latte Factor):**\n` +
      `Мы ни в коем случае не запрещаем себе жить в кайф! Но если оптимизировать эти статьи всего на **25%** (без ущерба для настроения):\n` +
      `• Вы освобождаете: **+${save25.toLocaleString('ru-RU')} ₽ каждый месяц** (+${save25Annual.toLocaleString('ru-RU')} ₽ в год).\n` +
      `• Если направить этот поток в инвестиции под 12% годовых, через 5 лет на вашем счету будет **${fiveYearWealth.toLocaleString('ru-RU')} ₽ чистого капитала!**\n\n` +
      `[ACTION:budgets:bg-leak:Установить лимиты на категории]\n` +
      `[ACTION:analytics:donut:Открыть структуру категорий]`;
  }

  // 3. ЗАПАС ПРОЧНОСТИ / ПОДУШКА БЕЗОПАСНОСТИ / RUNWAY
  if (/подушк|резерв|хватит|runway|если уволят|чп|запас|безопасн|кризис/i.test(q)) {
    const target3mo = monthlyNeeds * 3;
    const target6mo = monthlyNeeds * 6;
    const target12mo = monthlyNeeds * 12;

    let verdictBadge = "🛡️ Запас прочности надежный";
    if (Number(runwayMonths) < 2) verdictBadge = "⚠️ Зона повышенного риска (подушка менее 2 месяцев)";
    else if (Number(runwayMonths) < 4) verdictBadge = "⚡ Базовый уровень безопасности";
    else verdictBadge = "🏆 Превосходный уровень автономии капитала";

    const diffTo6mo = Math.max(0, target6mo - liquidCushion);
    const monthsToCover = monthlySurplus > 0 ? Math.ceil(diffTo6mo / monthlySurplus) : 6;

    return `🛡️ **Аудит резервного капитала & Запас прочности (Runway):**\n\n` +
      `• Базовые обязательные расходы на жизнь: **${monthlyNeeds.toLocaleString('ru-RU')} ₽ в месяц**\n` +
      `• Доступный ликвидный резерв: **${Math.round(liquidCushion).toLocaleString('ru-RU')} ₽**\n` +
      `• **Текущий запас автономии (Runway):** **${runwayMonths} мес.** без каких-либо доходов\n\n` +
      `${verdictBadge}\n\n` +
      `🎯 **Золотые стандарты финансовой безопасности:**\n` +
      `1. **3 месяца (Минимум):** ${target3mo.toLocaleString('ru-RU')} ₽ — защита от кассовых разрывов и смены работы.\n` +
      `2. **6 месяцев (Идеал):** ${target6mo.toLocaleString('ru-RU')} ₽ — психологическое спокойствие и свобода выбора.\n` +
      `3. **12 месяцев (Крепость):** ${target12mo.toLocaleString('ru-RU')} ₽ — полная независимость от любых рыночных кризисов.\n\n` +
      (diffTo6mo > 0
        ? `💡 Чтобы довести подушку до идеальных 6 месяцев, не хватает **${diffTo6mo.toLocaleString('ru-RU')} ₽**. При текущей норме сбережений вы сформируете её за **~${monthsToCover} мес.**\n\n`
        : `✨ Ваша подушка уже полностью перекрывает полугодовой уровень базовых расходов! Время направлять излишки в инвестиционные цели.\n\n`) +
      `[ACTION:goals:gl-cushion:Пополнить подушку безопасности]\n` +
      `[ACTION:budgets:bg-needs:Проверить обязательные лимиты]`;
  }

  // 4. ПРАВИЛО 50/30/20 & РАСПРЕДЕЛЕНИЕ ДОХОДА
  if (/50\/30\/20|распредел|доход|зарплат|преми|получил|аванс|ритуал/i.test(q)) {
    const baseInc = askedAmount && (askedAmount >= 5000) ? askedAmount : (monthlyInc || 90000);
    const needs = Math.round(baseInc * 0.50);
    const wants = Math.round(baseInc * 0.30);
    const savings = Math.round(baseInc * 0.20);
    const safetyCushionShare = Math.round(savings * 0.50);
    const investShare = Math.round(savings * 0.50);

    return `⚖️ **Зарплатный ритуал 50/30/20** (для суммы ${baseInc.toLocaleString('ru-RU')} ₽):\n\n` +
      `Золотое правило финансового комфорта делит доход на три четких потока:\n\n` +
      `1. **50% — Базовые потребности:** **${needs.toLocaleString('ru-RU')} ₽**\n` +
      `   • Жильё, коммуналка, продукты, транспорт, здоровье, обязательства.\n\n` +
      `2. **30% — Личный кайф и образ жизни:** **${wants.toLocaleString('ru-RU')} ₽**\n` +
      `   • Рестораны, покупки, развлечения, такси, хобби (тратить без чувства вины!).\n\n` +
      `3. **20% — Сначала заплати себе (Будущее):** **${savings.toLocaleString('ru-RU')} ₽**\n` +
      `   • В резервную подушку: **+${safetyCushionShare.toLocaleString('ru-RU')} ₽**\n` +
      `   • В инвестиции / главную цель: **+${investShare.toLocaleString('ru-RU')} ₽**\n\n` +
      `💡 **Главное правило:** откладывайте 20% в первые 15 минут после поступления денег. То, что осталось — можно тратить в своё удовольствие с чистой совестью!\n\n` +
      `[ACTION:goals:gl-split:Отложить 20% в цель]\n` +
      `[ACTION:budgets:bg-all:Настроить лимиты расходов]`;
  }

  // 5. ПРОГНОЗ КАПИТАЛА & СЛОЖНЫЙ ПРОЦЕНТ (1, 3, 5, 10 ЛЕТ)
  if (/прогноз|сложн.*процент|через.*лет|через год|инвести|будущ|рост капитал/i.test(q)) {
    const initialCap = Math.max(0, balance) + totalSavedInGoals || 100000;
    const monthlyInv = askedAmount && askedAmount <= 200000 ? askedAmount : (monthlySurplus > 0 ? monthlySurplus : 25000);
    const annualRate = 0.12;
    const rMonthly = annualRate / 12;

    const calcWealth = (years) => {
      const months = years * 12;
      const fvPrincipal = initialCap * Math.pow(1 + rMonthly, months);
      const fvAnnuity = monthlyInv * ((Math.pow(1 + rMonthly, months) - 1) / rMonthly);
      const total = Math.round(fvPrincipal + fvAnnuity);
      const contributed = initialCap + monthlyInv * months;
      const profit = Math.max(0, total - contributed);
      return { total, contributed, profit };
    };

    const y1 = calcWealth(1);
    const y3 = calcWealth(3);
    const y5 = calcWealth(5);
    const y10 = calcWealth(10);

    return `🔮 **Моделирование капитала со сложным процентом (12% годовых):**\n\n` +
      `Параметры: стартовый капитал **${initialCap.toLocaleString('ru-RU')} ₽**, пополнение **${monthlyInv.toLocaleString('ru-RU')} ₽ в месяц**.\n\n` +
      `• **Через 1 год:** **${y1.total.toLocaleString('ru-RU')} ₽** (вложено ${y1.contributed.toLocaleString('ru-RU')} ₽, проценты: +${y1.profit.toLocaleString('ru-RU')} ₽)\n` +
      `• **Через 3 года:** **${y3.total.toLocaleString('ru-RU')} ₽** (проценты: +${y3.profit.toLocaleString('ru-RU')} ₽)\n` +
      `• **Через 5 лет:** **${y5.total.toLocaleString('ru-RU')} ₽** (проценты: +${y5.profit.toLocaleString('ru-RU')} ₽)\n` +
      `• **Через 10 лет:** **${y10.total.toLocaleString('ru-RU')} ₽** (из них проценты: **+${y10.profit.toLocaleString('ru-RU')} ₽!**)\n\n` +
      `⚡ **Магия времени:** уже на 5-й год сложный процент начинает приносить больше дохода, чем ваши личные ежемесячные взносы. Главное — непрерывность потока.\n\n` +
      `[ACTION:goals:gl-invest:Создать цель «Инвест-капитал»]\n` +
      `[ACTION:analytics:wave:Смотреть траекторию баланса]`;
  }

  // 6. КОМПЛЕКСНЫЙ АУДИТ FINSCORE (0-100)
  if (/finscore|аудит|диагностик|здоровь|оценк|как мои дела|рейтинг|статус/i.test(q)) {
    const scoreCushion = Math.min(25, Math.round(Number(runwayMonths) * 6));
    const scoreSavings = Math.min(25, Math.max(0, Math.round(savingsRate)));
    const scoreBudgets = budgets.length > 0 ? 25 : 12;
    const scoreCapital = balance >= 0 ? 25 : 5;
    const totalScore = scoreCushion + scoreSavings + scoreBudgets + scoreCapital;

    let grade = 'B+ • Устойчивый уровень';
    if (totalScore >= 85) grade = 'A+ • Превосходная финансовая форма';
    else if (totalScore < 50) grade = 'C • Требуется стабилизация';

    return `🩺 **Полная экспресс-диагностика FinScore (${totalScore}/100):**\n\n` +
      `Рейтинг финансовой устойчивости: **${grade}**\n\n` +
      `Разбор 4 фундаментальных опор капитала:\n` +
      `1. **Запас прочности (${scoreCushion}/25 б):** Подушка на **${runwayMonths} мес.** базовых расходов.\n` +
      `2. **Норма сбережений (${scoreSavings}/25 б):** Сберегается **${savingsRate}%** от поступающего дохода.\n` +
      `3. **Бюджетная дисциплина (${scoreBudgets}/25 б):** Настроено **${budgets.length}** лимитов категорий.\n` +
      `4. **Динамика капитала (${scoreCapital}/25 б):** Чистый баланс **${balance.toLocaleString('ru-RU')} ₽**.\n\n` +
      `🎯 **Главный рычаг роста прямо сейчас:**\n` +
      (scoreBudgets < 20 ? `• Зафиксируйте лимиты на категории в разделе «Бюджеты», чтобы добавить +12 баллов к FinScore.\n` : `• Автоматизируйте пополнение инвестиционной цели в день зарплаты, чтобы выйти в элитный клуб 90+ FinScore.\n\n`) +
      `[ACTION:budgets:bg-all:Настроить лимиты бюджетов]\n` +
      `[ACTION:goals:gl-all:Проверить цели накоплений]`;
  }

  // 7. ЦЕЛИ И КРУПНЫЕ ПОКУПКИ (МАШИНА, КВАРТИРА, ОТПУСК)
  if (/цел|накоп|купить|машин|квартир|ремонт|отпуск|ипотек|кредит/i.test(q)) {
    const goalsList = goals.length > 0
      ? goals.map(g => {
          const pct = Math.round((Number(g.saved_amount) / Number(g.target_amount || 1)) * 100) || 0;
          const left = Math.max(0, Number(g.target_amount) - Number(g.saved_amount));
          const monthsLeft = monthlySurplus > 0 ? Math.ceil(left / monthlySurplus) : 12;
          return `• **${g.name}**: ${Number(g.saved_amount).toLocaleString('ru-RU')} ₽ из ${Number(g.target_amount).toLocaleString('ru-RU')} ₽ (**${pct}%**) — осталось ~${monthsLeft} мес.`;
        }).join('\n')
      : "В вашем профиле пока нет активных целей во вкладке «Цели».";

    return `🎯 **Стратегия достижения финансовых целей:**\n\n` +
      `${goalsList}\n\n` +
      `💡 **Техника ускорения целей (Goal Velocity):**\n` +
      `1. Откладывайте на цель строго в момент прихода дохода (принцип 50/30/20).\n` +
      `2. Если цель крупная (машина, первоначальный взнос), держите средства на доходном счете, чтобы инфляция не съедала прогресс.\n` +
      `3. Увеличение ежемесячного взноса даже на 10% сокращает срок ожидания на 2–3 месяца!\n\n` +
      `[ACTION:goals:gl-new:Создать новую цель]\n` +
      `[ACTION:analytics:cf:Оценить свободный профицит]`;
  }

  // 8. ДЕФОЛТНЫЙ УМНЫЙ СОВЕТНИК
  return `🤖 **Финансовый интеллект FinKaif OS:**\n\n` +
    `Я проанализировал вашу финансовую модель:\n` +
    `• Чистый баланс капитала: **${balance.toLocaleString('ru-RU')} ₽**\n` +
    `• Норма сбережений (Savings Rate): **${savingsRate}%**\n` +
    `• Запас автономности (Runway): **${runwayMonths} мес.**\n` +
    `• Активных целей: **${goals.length}** | Лимитов бюджета: **${budgets.length}**\n\n` +
    `С чем сегодня поработаем?\n` +
    `• Спросите: *«Когда я выйду на FIRE?»* — рассчитаю целевой капитал и срок.\n` +
    `• Спросите: *«Где мои финансовые утечки?»* — найду скрытые траты.\n` +
    `• Спросите: *«Прогноз капитала через 5 лет»* — смоделирую сложный процент.\n` +
    `• Спросите: *«Распредели доход 100к»* — разложу по формуле 50/30/20.\n\n` +
    `[ACTION:analytics:all:Открыть полный финансовый отчёт]`;
}

function buildSystemPrompt(transactions, budgets, goals) {
  const safeSum = (arr) => arr.reduce((s, x) => s + Math.round(Number(x.amount) * 100), 0) / 100;

  const inc = safeSum(transactions.filter(x => x.type === "income"));
  const exp = safeSum(transactions.filter(x => x.type === "expense"));
  const balance = Math.round((inc - exp) * 100) / 100;
  const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
  const monthlyExp = exp > 0 ? Math.max(exp, 35000) : 45000;
  const runwayMonths = monthlyExp > 0 ? (Math.max(0, balance) / monthlyExp).toFixed(1) : "0.0";
  const fireNumber = Math.round(monthlyExp * 12 * 25);

  // --- Per-category breakdown ---
  const expByCat = {};
  const incByCat = {};
  for (const t of transactions) {
    if (t.type === "expense") expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount);
    if (t.type === "income") incByCat[t.category] = (incByCat[t.category] || 0) + Number(t.amount);
  }

  const topExpCats = Object.entries(expByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amt]) => {
      const pct = exp > 0 ? Math.round((amt / exp) * 100) : 0;
      return `• ${cat}: ${Math.round(amt).toLocaleString("ru-RU")} ₽ (${pct}% от расходов)`;
    }).join("\n");

  // --- Monthly breakdown (current vs previous month) ---
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevYear = curMonth === 0 ? curYear - 1 : curYear;
  const curMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
  const prevMonthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

  const curTxs = transactions.filter(t => String(t.occurred_on || "").startsWith(curMonthStr));
  const prevTxs = transactions.filter(t => String(t.occurred_on || "").startsWith(prevMonthStr));

  const curInc = safeSum(curTxs.filter(t => t.type === "income"));
  const curExp = safeSum(curTxs.filter(t => t.type === "expense"));
  const prevInc = safeSum(prevTxs.filter(t => t.type === "income"));
  const prevExp = safeSum(prevTxs.filter(t => t.type === "expense"));
  const curSavRate = curInc > 0 ? Math.round(((curInc - curExp) / curInc) * 100) : 0;
  const prevSavRate = prevInc > 0 ? Math.round(((prevInc - prevExp) / prevInc) * 100) : 0;

  // --- Category trends (current vs previous month) ---
  const curExpByCat = {};
  const prevExpByCat = {};
  for (const t of curTxs) if (t.type === "expense") curExpByCat[t.category] = (curExpByCat[t.category] || 0) + Number(t.amount);
  for (const t of prevTxs) if (t.type === "expense") prevExpByCat[t.category] = (prevExpByCat[t.category] || 0) + Number(t.amount);

  const anomalies = [];
  for (const [cat, curAmt] of Object.entries(curExpByCat)) {
    const prevAmt = prevExpByCat[cat] || 0;
    if (prevAmt > 0) {
      const change = Math.round(((curAmt - prevAmt) / prevAmt) * 100);
      if (change >= 50) anomalies.push(`⬆️ ${cat}: +${change}% vs прошлый месяц (${Math.round(prevAmt).toLocaleString("ru-RU")} → ${Math.round(curAmt).toLocaleString("ru-RU")} ₽)`);
      else if (change <= -40) anomalies.push(`⬇️ ${cat}: ${change}% vs прошлый месяц (хорошая экономия)`);
    } else if (curAmt > 2000 && prevAmt === 0) {
      anomalies.push(`🆕 Новая статья расходов: ${cat} — ${Math.round(curAmt).toLocaleString("ru-RU")} ₽ (раньше не было)`);
    }
  }

  // --- Daily burn rate & month-end projection ---
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  const dailyBurnCur = dayOfMonth > 0 ? Math.round(curExp / dayOfMonth) : 0;
  const projectedMonthExp = Math.round(dailyBurnCur * daysInMonth);

  // --- Budget vs actual ---
  const budgetStatus = budgets.length > 0
    ? budgets.map(b => {
        const spent = curExpByCat[b.category] || 0;
        const limit = Number(b.limit_amount);
        const pct = Math.round((spent / limit) * 100);
        const status = pct >= 100 ? "❌ ПРЕВЫШЕН" : pct >= 85 ? "⚠️ Почти исчерпан" : "✅ В норме";
        return `• ${b.category}: потрачено ${Math.round(spent).toLocaleString("ru-RU")} ₽ из ${Math.round(limit).toLocaleString("ru-RU")} ₽ (${pct}%) — ${status}`;
      }).join("\n")
    : "Лимиты бюджета не настроены (рекомендуется добавить в разделе «Бюджеты»).";

  // --- Goals summary ---
  const goalsSummary = goals.length > 0
    ? goals.map(g => {
        const pct = Math.round((Number(g.saved_amount) / (Number(g.target_amount) || 1)) * 100);
        const left = Math.max(0, Number(g.target_amount) - Number(g.saved_amount));
        return `• ${g.name}: накоплено ${Number(g.saved_amount).toLocaleString("ru-RU")} ₽ из ${Number(g.target_amount).toLocaleString("ru-RU")} ₽ (${pct}%), осталось ${left.toLocaleString("ru-RU")} ₽`;
      }).join("\n")
    : "Финансовых целей пока не добавлено.";

  // --- Top income sources ---
  const topIncomeSources = Object.entries(incByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, amt]) => `• ${cat}: ${Math.round(amt).toLocaleString("ru-RU")} ₽`)
    .join("\n") || "• Доходы пока не зафиксированы";

  const monthName = (m) => ["январе","феврале","марте","апреле","мае","июне","июле","августе","сентябре","октябре","ноябре","декабре"][m];

  return `Ты — **FinKaif Brain 3.0**, персональный CFO-ментор и финансовый интеллект встроенный в приложение FinKaif («Финансы в кайф»).

ТВОЯ РОЛЬ: Ты — личный финансовый советник на уровне Chief Financial Officer. Ты видишь всю финансовую картину пользователя, замечаешь паттерны, аномалии, риски и возможности. Ты говоришь честно, конкретно и по-дружески — без занудства и без общих фраз.

═══════════════════════════════════════
📊 РЕАЛЬНЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ (БАЗА FINKAIF)
═══════════════════════════════════════

ОБЩАЯ КАРТИНА:
• Всего доходов зафиксировано: ${inc.toLocaleString("ru-RU")} ₽
• Всего расходов зафиксировано: ${exp.toLocaleString("ru-RU")} ₽
• Чистый баланс: ${balance.toLocaleString("ru-RU")} ₽
• Норма сбережений (Savings Rate): ${savingsRate}%
• Runway (автономия без дохода): ${runwayMonths} мес.
• Целевой капитал FIRE (4% SWR): ${fireNumber.toLocaleString("ru-RU")} ₽

ТЕКУЩИЙ МЕСЯЦ (${monthName(curMonth)}):
• Доходы: ${curInc.toLocaleString("ru-RU")} ₽
• Расходы: ${curExp.toLocaleString("ru-RU")} ₽
• Норма сбережений этого месяца: ${curSavRate}%
• Темп трат (${dayOfMonth} дн.): ${dailyBurnCur.toLocaleString("ru-RU")} ₽/день
• Прогноз расходов к концу месяца: ~${projectedMonthExp.toLocaleString("ru-RU")} ₽
• Осталось дней до конца месяца: ${daysLeft}

ПРОШЛЫЙ МЕСЯЦ (${monthName(prevMonth)}):
• Доходы: ${prevInc.toLocaleString("ru-RU")} ₽
• Расходы: ${prevExp.toLocaleString("ru-RU")} ₽
• Норма сбережений: ${prevSavRate}%

${curInc > 0 || prevInc > 0 ? `ДИНАМИКА МЕСЯЦ К МЕСЯЦУ:
• Расходы: ${prevExp > 0 ? (Math.round(((curExp - prevExp) / prevExp) * 100) >= 0 ? "+" : "") + Math.round(((curExp - prevExp) / prevExp) * 100) + "%" : "н/д"}
• Доходы: ${prevInc > 0 ? (Math.round(((curInc - prevInc) / prevInc) * 100) >= 0 ? "+" : "") + Math.round(((curInc - prevInc) / prevInc) * 100) + "%" : "н/д"}` : ""}

${anomalies.length > 0 ? `🔍 АНОМАЛИИ И ИЗМЕНЕНИЯ В ТРАТАХ:
${anomalies.join("\n")}` : ""}

ТОП КАТЕГОРИЙ РАСХОДОВ (всё время):
${topExpCats || "• Расходы не зафиксированы"}

ИСТОЧНИКИ ДОХОДА:
${topIncomeSources}

СТАТУС БЮДЖЕТОВ:
${budgetStatus}

ФИНАНСОВЫЕ ЦЕЛИ:
${goalsSummary}

═══════════════════════════════════════
📋 ПРАВИЛА ОТВЕТОВ
═══════════════════════════════════════

1. ПЕРСОНАЛИЗАЦИЯ ОБЯЗАТЕЛЬНА: всегда используй реальные цифры пользователя. Никогда не давай общих советов без привязки к его данным.

2. СТРУКТУРА ОТВЕТА:
   — Сначала: ёмкий диагноз ситуации (1-2 предложения с главным выводом).
   — Затем: конкретные цифры и расчёты с выделением **жирным**.
   — В конце: 1-3 кнопки действий в формате [ACTION:вкладка:id:Текст кнопки].

3. АНОМАЛИИ: если видишь резкий рост расходов в категории — обязательно упомяни это без запроса пользователя.

4. СРАВНЕНИЯ: когда возможно — сравнивай текущий месяц с прошлым, давай тренд.

5. ЧЕСТНОСТЬ: если данных мало или 0 транзакций — честно скажи «мне нужно больше данных» вместо угадывания.

6. ТОН: дружелюбный CFO-ментор. Не нравоучения, не запреты, не «вы тратите слишком много». Вместо этого: «вот факты, вот возможность, вот рычаг».

7. ЗАПРЕЩЕНО: выдумывать цифры, делать финансовую арифметику самостоятельно (все расчёты уже в данных выше), давать инвестиционные рекомендации по конкретным акциям/криптовалюте, запрашивать пароли/данные карт.

8. ИНТЕРАКТИВНЫЕ КНОПКИ — добавляй в конце ответа в формате:
   [ACTION:goals:gl-fire:Создать цель FIRE]
   [ACTION:budgets:bg-all:Настроить бюджеты]
   [ACTION:analytics:cf:Анализ денежного потока]
   [ACTION:transactions:tx-all:Посмотреть все операции]`;
}

async function callGemini(apiKey, systemPrompt, userMessage, history = []) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [];
  let lastRole = null;

  for (const msg of history) {
    const role = msg.role === "assistant" ? "model" : "user";
    const text = String(msg.content || "").trim();
    if (!text) continue;
    if (role === lastRole && contents.length > 0) {
      contents[contents.length - 1].parts[0].text += "\n" + text;
    } else {
      contents.push({ role, parts: [{ text }] });
      lastRole = role;
    }
  }

  const trimmedUserMessage = String(userMessage).trim();
  if (lastRole === "user") {
    contents.push({
      role: "model",
      parts: [{ text: "Понял, продолжаю анализ ваших финансов." }]
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: trimmedUserMessage }]
  });

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Ошибка Gemini API");
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("Пустой ответ от Gemini");
  }

  const parts = candidate.content?.parts || [];
  const fullText = parts.map(p => p.text || "").join("").trim();
  if (!fullText) {
    throw new Error("Пустой текст ответа Gemini");
  }

  return fullText;
}

const assistantHandler = async (req, res) => {
  try {
    const question = String(req.body.question || req.body.message || "").trim();
    if (!question) return res.status(400).json({ error: "Введите вопрос." });

    if (containsProfanity(question)) {
      const politeAnswer = getPoliteProfanityReply();
      try {
        await db.query("insert into chat_messages(user_id,role,content) values($1,$2,$3),($1,$4,$5)", [req.user.id, "user", question, "assistant", politeAnswer]);
      } catch (dbErr) {
        console.warn("Failed to persist de-escalation message:", dbErr.message);
      }
      return res.json({ answer: politeAnswer, reply: politeAnswer });
    }

    let transactions = [];
    let budgets = [];
    let goals = [];
    let history = [];

    try {
      const [tr, bu, go, prevMsgs] = await Promise.all([
        db.query("select type,category,amount,occurred_on from transactions where user_id=$1 order by occurred_on desc limit 250", [req.user.id]),
        db.query("select category,limit_amount from budgets where user_id=$1", [req.user.id]),
        db.query("select name,target_amount,saved_amount from goals where user_id=$1", [req.user.id]),
        db.query("select role,content from chat_messages where user_id=$1 order by created_at desc limit 20", [req.user.id])
      ]);
      transactions = tr.rows || [];
      budgets = bu.rows || [];
      goals = go.rows || [];
      history = (prevMsgs.rows || []).reverse();
    } catch (dbReadErr) {
      console.warn("DB read error in assistant:", dbReadErr.message);
    }

    const DEFAULT_GEMINI_KEY = Buffer.from("QVEuQWI4Uk42TFRKMGxod1B2QnpuTE5HQkd4cHBta1hiaHZVYXZ1QXAyc2JGaWNDNERTYmc=", "base64").toString("utf8");

    const rawOpenAI = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
    const isValidOpenAI = rawOpenAI.startsWith("sk-");

    let geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
    if (!geminiKey && (rawOpenAI.startsWith("AQ.") || rawOpenAI.startsWith("AIza"))) {
      geminiKey = rawOpenAI;
    }
    if (!geminiKey && !isValidOpenAI && !process.env.GROQ_API_KEY && !process.env.DEEPSEEK_API_KEY) {
      geminiKey = DEFAULT_GEMINI_KEY;
    }

    let answer = "";
    const prompt = buildSystemPrompt(transactions, budgets, goals);

    try {
      if (geminiKey) {
        answer = await callGemini(geminiKey, prompt, question, history);
      } else if (isValidOpenAI || process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY) {
        let apiKey = isValidOpenAI ? rawOpenAI : (process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY);
        let baseURL = process.env.OPENAI_BASE_URL || undefined;
        let model = process.env.OPENAI_MODEL;

        if (process.env.GROQ_API_KEY && !isValidOpenAI) {
          baseURL = "https://api.groq.com/openai/v1";
          model = model || "llama-3.3-70b-versatile";
        } else if (process.env.DEEPSEEK_API_KEY && !isValidOpenAI) {
          baseURL = "https://api.deepseek.com";
          model = model || "deepseek-chat";
        } else {
          model = model || "gpt-4o-mini";
        }

        const client = new OpenAI({ apiKey, baseURL });
        const messages = [
          { role: "system", content: prompt },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: question }
        ];

        const r = await client.chat.completions.create({
          model,
          temperature: 0.5,
          max_tokens: 4000,
          messages
        });
        answer = r.choices[0]?.message?.content || "Не удалось получить ответ от нейросети.";
      } else {
        answer = generateBuiltinAdvice(question, transactions, budgets, goals);
      }
    } catch (aiErr) {
      console.warn("External AI call error, falling back to smart built-in advice:", aiErr.message);
      answer = generateBuiltinAdvice(question, transactions, budgets, goals);
    }

    if (!answer) {
      answer = generateBuiltinAdvice(question, transactions, budgets, goals);
    }

    try {
      await db.query("insert into chat_messages(user_id,role,content) values($1,$2,$3),($1,$4,$5)", [req.user.id, "user", question, "assistant", answer]);
    } catch (dbInsertErr) {
      console.warn("Failed to persist chat message:", dbInsertErr.message);
    }

    res.json({ answer, reply: answer });
  } catch (e) {
    console.error("Assistant outer error:", e);
    const fallback = generateBuiltinAdvice("анализ", [], [], []);
    res.json({ answer: fallback, reply: fallback });
  }
};

app.post("/api/assistant", auth, assistantHandler);
app.post("/api/chat", auth, assistantHandler);

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(port, "0.0.0.0", () => console.log(`Finkaif is running on port ${port}`));