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
      console.log("Database schema initialized successfully.");
    }
  } catch (e) {
    console.error("Database schema init error:", e.message);
  }
}
initDb();

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

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

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
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
    if (!["income", "expense"].includes(x.type) || !String(x.category || "").trim() || !(Number(x.amount) > 0)) {
      return res.status(400).json({ error: "Проверьте тип, категорию и сумму операции." });
    }
    const r = await db.query(
      "insert into transactions(user_id,type,category,description,amount,occurred_on) values($1,$2,$3,$4,$5,$6) returning *",
      [req.user.id, x.type, String(x.category).trim(), String(x.description || "").trim(), Number(x.amount), x.occurred_on || new Date().toISOString().slice(0, 10)]
    );
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

function generateBuiltinAdvice(question, transactions, budgets, goals) {
  const inc = transactions.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount), 0);
  const exp = transactions.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount), 0);
  const balance = inc - exp;
  const q = question.toLowerCase();

  const numbers = question.match(/\d+[\d\s]*\d+|\d+/g);
  const askedAmount = numbers ? Number(numbers[0].replace(/\s+/g, "")) : null;
  const baseIncome = askedAmount && (q.includes("доход") || q.includes("зарплат") || q.includes("получа")) ? askedAmount : (inc || 60000);

  let advice = "";

  if (q.includes("отпуск") || q.includes("резерв") || q.includes("подушк") || q.includes("откладывать") || q.includes("50/30/20") || q.includes("распредел")) {
    const needs = Math.round(baseIncome * 0.5);
    const wants = Math.round(baseIncome * 0.3);
    const savings = Math.round(baseIncome * 0.2);
    const reserve = Math.round(savings * 0.5);
    const vacation = Math.round(savings * 0.5);

    advice = `📊 **Финансовый расчет по правилу 50/30/20** (при доходе ${baseIncome.toLocaleString("ru-RU")} ₽):\n\n` +
      `1. **Обязательные расходы (50%):** ${needs.toLocaleString("ru-RU")} ₽ — жилье, еда, ЖКХ, связь, базовые платежи.\n` +
      `2. **Личные траты и отдых (30%):** ${wants.toLocaleString("ru-RU")} ₽ — кафе, развлечения, покупки.\n` +
      `3. **Накопления и цели (20%):** ${savings.toLocaleString("ru-RU")} ₽ в месяц:\n` +
      `   • **Финансовая подушка (10%):** ${reserve.toLocaleString("ru-RU")} ₽ (цель — накопить на 3–6 месяцев базовых расходов, около ${(needs * 3).toLocaleString("ru-RU")} ₽).\n` +
      `   • **На отпуск / крупные цели (10%):** ${vacation.toLocaleString("ru-RU")} ₽.\n\n` +
      `📌 *Ваша статистика в приложении:* учтено доходов: ${inc.toLocaleString("ru-RU")} ₽, расходов: ${exp.toLocaleString("ru-RU")} ₽, остаток: ${balance.toLocaleString("ru-RU")} ₽.`;
  } else if (q.includes("бюджет") || q.includes("лимит") || q.includes("расход") || q.includes("эконом") || q.includes("трат")) {
    advice = `💡 **Анализ расходов и бюджетирования:**\n\n` +
      `• Всего учтено расходов: **${exp.toLocaleString("ru-RU")} ₽**\n` +
      `• Всего учтено доходов: **${inc.toLocaleString("ru-RU")} ₽**\n` +
      `• Текущий баланс: **${balance.toLocaleString("ru-RU")} ₽**\n\n` +
      `Рекомендация: перейдите во вкладку «Бюджет» и задайте месячные лимиты по основным статьям расходов (продукты, кафе, такси). Оптимально, чтобы ни одна отдельная категория не забирала более 25-30% от всех расходов.`;
  } else if (q.includes("цел") || q.includes("накоп") || q.includes("купить") || q.includes("машин") || q.includes("квартир")) {
    const goalsList = goals.length > 0
      ? goals.map(g => `• **${g.name}**: накоплено ${Number(g.saved_amount).toLocaleString("ru-RU")} ₽ из ${Number(g.target_amount).toLocaleString("ru-RU")} ₽ (${Math.round((g.saved_amount / g.target_amount) * 100) || 0}%)`).join("\n")
      : "У вас пока не добавлено целей во вкладке «Цели».";

    advice = `🎯 **Ваши финансовые цели:**\n\n${goalsList}\n\n` +
      `💡 Совет: чтобы цель достигалась быстрее, откладывайте фиксированную сумму сразу в день поступления дохода, а не в конце месяца по остаточному принципу.`;
  } else {
    advice = `🤖 **Финансовый советник Finkaif:**\n\n` +
      `Вы спросили: *«${question}»*\n\n` +
      `По текущим данным вашего аккаунта:\n` +
      `• Доходы: **${inc.toLocaleString("ru-RU")} ₽**\n` +
      `• Расходы: **${exp.toLocaleString("ru-RU")} ₽**\n` +
      `• Баланс: **${balance.toLocaleString("ru-RU")} ₽**\n` +
      `• Целей: **${goals.length}**, лимитов бюджета: **${budgets.length}**\n\n` +
      `Сформулируйте вопрос с указанием сумм или целей (например: *«Доход 80000, сколько откладывать на отпуск?»* или *«Как оптимизировать расходы?»*).`;
  }

  advice += `\n\n*(ℹ️ Режим умного финансового анализа. Чтобы подключить OpenAI, DeepSeek, Groq или Gemini, добавьте API-ключ в переменные Variables на Railway).*`;
  return advice;
}

app.post("/api/assistant", auth, async (req, res) => {
  try {
    const question = String(req.body.question || "").trim();
    if (!question) return res.status(400).json({ error: "Введите вопрос." });

    const [tr, bu, go] = await Promise.all([
      db.query("select type,category,amount,occurred_on from transactions where user_id=$1 order by occurred_on desc limit 250", [req.user.id]),
      db.query("select category,limit_amount from budgets where user_id=$1", [req.user.id]),
      db.query("select name,target_amount,saved_amount from goals where user_id=$1", [req.user.id])
    ]);

    const transactions = tr.rows;
    const budgets = bu.rows;
    const goals = go.rows;

    let apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY;
    let baseURL = process.env.OPENAI_BASE_URL || undefined;
    let model = process.env.OPENAI_MODEL;

    if (process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      apiKey = process.env.GROQ_API_KEY;
      baseURL = "https://api.groq.com/openai/v1";
      model = model || "llama-3.3-70b-versatile";
    } else if (process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      apiKey = process.env.DEEPSEEK_API_KEY;
      baseURL = "https://api.deepseek.com";
      model = model || "deepseek-chat";
    } else if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      apiKey = process.env.GEMINI_API_KEY;
      baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
      model = model || "gemini-1.5-flash";
    } else {
      model = model || "gpt-4o-mini";
    }

    let answer = "";

    if (apiKey) {
      const client = new OpenAI({ apiKey, baseURL });
      const prompt = `Ты — внимательный русскоязычный помощник Finkaif по личным финансам. Отвечай естественно, понятно, с четкой структурой и без лишней воды. Анализируй вопрос и контекст пользователя. Предлагай конкретные действия, распределение сумм или процентные доли. Финансовый контекст: ${JSON.stringify({ transactions, budgets, goals })}`;
      
      const r = await client.chat.completions.create({
        model,
        temperature: 0.45,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: question }
        ]
      });
      answer = r.choices[0]?.message?.content || "Не удалось получить ответ от нейросети.";
    } else {
      answer = generateBuiltinAdvice(question, transactions, budgets, goals);
    }

    await db.query("insert into chat_messages(user_id,role,content) values($1,$2,$3),($1,$4,$5)", [req.user.id, "user", question, "assistant", answer]);
    res.json({ answer });
  } catch (e) {
    console.error("Assistant error:", e);
    res.status(500).json({ error: "Ошибка ответа ИИ: " + (e.message || "Проверьте ключ API в Railway Variables.") });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(port, "0.0.0.0", () => console.log(`Finkaif is running on port ${port}`));