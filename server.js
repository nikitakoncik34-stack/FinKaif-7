import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Russian Merchants & IP Knowledge Base
let RUSSIAN_MERCHANTS_KB = null;
try {
  const kbFile = path.join(__dirname, "data", "russian_merchants_kb.json");
  if (fs.existsSync(kbFile)) {
    RUSSIAN_MERCHANTS_KB = JSON.parse(fs.readFileSync(kbFile, "utf8"));
    console.log(`[FinKaif KB] Loaded Russian Merchant Knowledge Base v${RUSSIAN_MERCHANTS_KB.version} (${RUSSIAN_MERCHANTS_KB.merchants_catalog?.length || 0} merchants, ${RUSSIAN_MERCHANTS_KB.okved_dictionary?.length || 0} OKVED activities)`);
  }
} catch (kbErr) {
  console.warn("[FinKaif KB] Warning loading russian_merchants_kb.json:", kbErr.message);
}

const app = express();
app.set("trust proxy", 1);

const port = Number(process.env.PORT || 3000);
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️ SECURITY WARNING: JWT_SECRET environment variable is not set! Generating ephemeral key.");
    JWT_SECRET = crypto.randomBytes(32).toString("hex");
  } else {
    JWT_SECRET = "finkaif_dev_jwt_secret_key_2026";
  }
}

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
// ============================================================================
// SECURITY HEADERS & DEFENSIVE MIDDLEWARE
// ============================================================================
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// High-performance in-memory sliding window rate limiter
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 20, message = "Слишком много запросов. Попробуйте позже." } = {}) {
  const requests = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) requests.delete(ip);
      else requests.set(ip, valid);
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const timestamps = requests.get(ip) || [];
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length >= max) {
      return res.status(429).json({ error: message });
    }
    valid.push(now);
    requests.set(ip, valid);
    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Слишком много попыток авторизации с вашего IP. Пожалуйста, подождите 15 минут."
});

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 25,
  message: "Превышен лимит запросов к ИИ-ассистенту. Пожалуйста, подождите минуту."
});

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

function getMskIsoDate(d = new Date()) {
  const m = getMskDate(d);
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, '0');
  const day = String(m.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

const GEMINI_API_KEYS = [
  Buffer.from("QVEuQWI4Uk42SndnMS0tOEFLNkRtR2h5RmZwSVNaUVVuNVNMWWNuWlJETW1FdDJiT25PSnc=", "base64").toString("utf8"),
  process.env.GEMINI_API_KEY,
  Buffer.from("QVEuQWI4Uk42S3JXeGdudDl6bDJsd0lHcVlacDBONk1MSHhrVXl4c285aXpwU1VqZEhYSXc=", "base64").toString("utf8"),
  Buffer.from("QVEuQWI4Uk42TFRKMGxod1B2QnpuTE5HQkd4cHBta1hiaHZVYXZ1QXAyc2JGaWNDNERTYmc=", "base64").toString("utf8")
].filter(Boolean);

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest"
].filter(Boolean);

// In-memory LRU cache for ultra-fast NLP parsing (0ms repeated lookup)
const parseTxCache = new Map();
function getCachedParsedTx(key) {
  return parseTxCache.get(key);
}
function setCachedParsedTx(key, val) {
  if (parseTxCache.size > 2000) {
    const first = parseTxCache.keys().next().value;
    parseTxCache.delete(first);
  }
  parseTxCache.set(key, val);
}

function parseTxFallback(raw) {
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
    const val = Math.round(parseFloat(cleanNum));
    if (!isNaN(val) && val > 0) {
      amount = val;
      matchedNumStr = explicitCurrency[0].trim();
    }
  }

  if (!amount) {
    const zaNaDigits = lower.match(/(?:^|[^а-яa-z0-9])(?:за|на)\s+(\d[\d\s]*(?:[.,]\d+)?)(?:$|[^а-яa-z0-9])/i);
    if (zaNaDigits) {
      const cleanNum = zaNaDigits[1].replace(/\s+/g, '').replace(',', '.');
      const val = Math.round(parseFloat(cleanNum));
      if (!isNaN(val) && val > 0) {
        amount = val;
        matchedNumStr = zaNaDigits[0].trim();
      }
    }
  }

  // 1. Amount Extraction
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

  // D. Digits with multiplier
  if (!amount) {
    const digBillion = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:миллиард[а-я]*|млрд[а-я]*|ярд[а-я]*|ккк|kkk)(?:$|[^а-яa-z0-9])/i);
    if (digBillion) {
      amount = Math.round(parseFloat(digBillion[1].replace(',', '.')) * 1000000000);
      matchedNumStr = digBillion[0].trim();
    }
  }
  if (!amount) {
    const digMillion = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:миллион[а-я]*|млн[а-я]*|лям[а-я]*|лимон(?:\b|а|ов)|кк|kk)(?:$|[^а-яa-z0-9])/i);
    if (digMillion) {
      amount = Math.round(parseFloat(digMillion[1].replace(',', '.')) * 1000000);
      matchedNumStr = digMillion[0].trim();
    }
  }
  if (!amount) {
    const digThousand = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:тысяч[а-я]*|тыщ[а-я]*|тыс[а-я]*|косар[а-я]*|куск[а-я]*|штук[а-я]*|тонн[а-я]*|к|k)(?:$|[^а-яa-z0-9])/i);
    if (digThousand) {
      amount = Math.round(parseFloat(digThousand[1].replace(',', '.')) * 1000);
      matchedNumStr = digThousand[0].trim();
    }
  }
  if (!amount) {
    const digHundreds = lower.match(/(?:^|[^а-яa-z0-9])(\d+(?:[.,]\d+)?)\s*(?:сот[ен|ни]|сотен)(?:$|[^а-яa-z0-9])/i);
    if (digHundreds) {
      amount = Math.round(parseFloat(digHundreds[1].replace(',', '.')) * 100);
      matchedNumStr = digHundreds[0].trim();
    }
  }

  // E. Russian compound text words
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
      const val = Math.round(parseFloat(cleanNum));
      if (!isNaN(val) && val > 0) {
        amount = val;
        matchedNumStr = stdNum[0].trim();
      }
    }
  }

  if (matchedNumStr) {
    cleanWords = cleanWords.replace(new RegExp(matchedNumStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }

  // Moscow Date handling
  const mskNow = getMskDate();
  let occurred_on = getMskIsoDate(mskNow);

  if (/(?:^|[^а-яa-z0-9])позавчера(?:$|[^а-яa-z0-9])/i.test(cleanWords)) {
    const d = new Date(mskNow); d.setDate(d.getDate() - 2);
    occurred_on = getMskIsoDate(d);
    cleanWords = cleanWords.replace(/(?:^|[^а-яa-z0-9])позавчера(?:$|[^а-яa-z0-9])/gi, ' ');
  } else if (/(?:^|[^а-яa-z0-9])вчера(?:$|[^а-яa-z0-9])/i.test(cleanWords)) {
    const d = new Date(mskNow); d.setDate(d.getDate() - 1);
    occurred_on = getMskIsoDate(d);
    cleanWords = cleanWords.replace(/(?:^|[^а-яa-z0-9])вчера(?:$|[^а-яa-z0-9])/gi, ' ');
  }

  // 2. Category & Type Detection
  let type = 'expense';
  let category = 'Прочее';

  const isIncome = /(?:заработ|получил|поднял|срубил|намайнил|выплат|перевел.*мне|перечисл|начисл|скинули|закинули|пришл|приход|капнул|упал[а-я]*\s+ден|прилетел|залетел|поступлен|поступил|доход|выручк|прибыл|гонорар|преми|бонус|оклад|отпускн|больничн|зарплат|аванс|получк|продал|подар|чаев|донат|вернули долг|отдали долг)/i.test(lower);

  if (isIncome) {
    type = 'income';
    if (/фриланс|проект|клиент|заказ|шабашк|халтур|калым|подработк|смен[аы]|дизайн|верстк|разработк|сайт/i.test(lower)) {
      category = 'Фриланс';
    } else if (/дивиденд|купон|процент|вклад|акци|инвест|крипт|биток|eth|usdt|тон\b/i.test(lower)) {
      category = 'Инвестиции';
    } else if (/продал|авито|юла|сбыт/i.test(lower)) {
      category = 'Продажи';
    } else if (/подар|день рожден|др\b|чаев|донат/i.test(lower)) {
      category = 'Подарки';
    } else if (/кэшбэк|бонус|возврат|вычет/i.test(lower)) {
      category = 'Кэшбэк';
    } else if (/долг|вернули|отдали/i.test(lower)) {
      category = 'Возврат долга';
    } else {
      category = 'Зарплата';
    }
  } else {
    type = 'expense';

    // A. Coffee, Bakery & Hot Drinks (Кафе)
    if (/кофе|кофей[а-я]*|латте|капуч[а-я]*|флэт.*уайт|раф[а-я]*|эспрессо|американо|матча|какао|чай\b|чаёк|чаек|булочн[а-я]*|пекарн[а-я]*|круассан[а-я]*|слойк[а-я]*|чизкейк[а-я]*|десерт[а-я]*|пончик[а-я]*|донат[а-я]*|синнабон[а-я]*|эклер[а-я]*|пирожн[а-я]*|торт[а-я]*/i.test(lower)) {
      category = 'Кафе';
    }
    // B. Fast food, Asian/Caucasian/European dishes, Dining out & Delivery (Рестораны)
    else if (/шав[ауе][а-я]*|шаверм[а-я]*|шаурм[а-я]*|донер[а-я]*|кебаб[а-я]*|шашлык[а-я]*|люля|пицц[а-я]*|додо|папа.*джонс|бургер[а-я]*|воппер|бигмак|макдак|мак\b|вкусно.*точк|вит\b|кфс|kfc|ростикс|наггетс[а-я]*|стрипс[а-я]*|хот[- ]?дог[а-я]*|ролл[а-я]*|суши|сет.*ролл|филадельфи[а-я]*|калифорни[а-я]*|якитори|тануки|том.*ям|том.*кха|фо.*бо|фо.*га|рамен[а-я]*|рамэн[а-я]*|вок[а-я]*|лапш[а-я]*.*вок|пад.*тай|удон|соба|фунчоз[а-я]*|димсам[а-я]*|бао|хинкал[а-я]*|хачапур[а-я]*|плов[а-я]*|лагман[а-я]*|мант[а-я]*|самс[а-я]*|шурп[а-я]*|чебурек[а-я]*|беляш[а-я]*|борщ[а-я]*|солянк[а-я]*|харчо|ух[а-я]\b|крем[- ]?суп|суп[- ]?пюре|лапш[а-я]*.*курин|карбонар[а-я]*|болоньез[а-я]*|лазань[а-я]*|ризотто|стейк[а-я]*|рибай|медальон[а-я]*|тартар[а-я]*|карпаччо|цезар[а-я]*|оливье|греческ.*салат|бизнес[- ]?ланч[а-я]*|ланч[а-я]*|обед[а-я]*|ужин[а-я]*|завтрак[а-я]*|столовк[а-я]*|столов[а-я]*|рестик[а-я]*|ресторан[а-я]*|кафешк[а-я]*|бистро|трактир|чайхон[а-я]*|фудкорт|посидели|покушать|пожрать|пообедать|поужинать|доставк.*еды|яндекс.*еда|деливери|купер.*еда|пиво|пивас|пивко|крафт|сидр|сидрери[а-я]*|вино|бар\b|паб\b|кальян[а-я]*/i.test(lower)) {
      category = 'Рестораны';
    }
    // C. Groceries & Supermarkets & Staples at home (Продукты)
    else if (/макарон[а-я]*|спагетти|паст[а-я]*|вермишел[а-я]*|рожк[а-я]*|гречк[а-я]*|греч[а-я]*|рис[а-я]*|пшен[а-я]*|овсянк[а-я]*|геркулес[а-я]*|хлопь[а-я]*|круп[а-я]*|булгур[а-я]*|кускус[а-я]*|киноа|чечевиц[а-я]*|фасол[а-я]*|горох[а-я]*|мук[а-я]*|сахар[а-я]*|сол[иь][а-я]*|сод[а-я]*|крахмал[а-я]*|дрожж[а-я]*|специ[а-я]*|приправ[а-я]*|масл[а-я]*|подсолнечн[а-я]*|оливков[а-я]*|сливочн.*масл[а-я]*|майонез[а-я]*|мазик[а-я]*|кетчуп[а-я]*|соус[а-я]*|томатн.*паст[а-я]*|горчиц[а-я]*|хрен[а-я]*|уксус[а-я]*|консерв[а-я]*|тушенк[а-я]*|шпрот[а-я]*|сайр[а-я]*|тун[ец][а-я]*|паштет[а-я]*|горошек[а-я]*|кукуруз[а-я]*|колбас[а-я]*|сосиск[а-я]*|сардельк[а-я]*|ветчин[а-я]*|сервелат[а-я]*|карбонад[а-я]*|бекон[а-я]*|мяс[а-я]*|фарш[а-я]*|котлет[а-я]*|говядин[а-я]*|свинин[а-я]*|телятин[а-я]*|баранин[а-я]*|индейк[а-я]*|куриц[а-я]*|кур[а-я]*|курин[а-я]*|цыплят[а-я]*|цыпленок|грудк[а-я]*|филе|бедрышк[а-я]*|окороч[а-я]*|крылышк[а-я]*|пельмен[а-я]*|вареник[а-я]*|рыб[а-я]*|лосос[а-я]*|семг[а-я]*|сёмг[а-я]*|форел[а-я]*|селедк[а-я]*|минта[а-я]*|треск[а-я]*|скумбри[а-я]*|креветк[а-я]*|кальмар[а-я]*|крабов.*палочк[а-я]*|молок[а-я]*|молочк[а-я]*|творог[а-я]*|творож[а-я]*|сыр[а-я]*|сырок[а-я]*|сырочк[а-я]*|сметан[а-я]*|кефир[а-я]*|ряженк[а-я]*|йогурт[а-я]*|сливк[а-я]*|сгущенк[а-я]*|сгущёнк[а-я]*|яйц[а-я]*|яичк[а-я]*|яиц|овощ[а-я]*|картох[а-я]*|картошк[а-я]*|картофел[а-я]*|помидор[а-я]*|томат[а-я]*|огур[ец][а-я]*|капуст[а-я]*|морков[а-я]*|морковк[а-я]*|лук[а-я]*|чеснок[а-я]*|зелен[а-я]*|укроп[а-я]*|петрушк[а-я]*|салат[а-я]*|свекл[а-я]*|свёкл[а-я]*|кабач[а-я]*|баклажан[а-я]*|перец|перц[а-я]*|гриб[а-я]*|шампиньон[а-я]*|фрукт[а-я]*|яблок[а-я]*|банан[а-я]*|апельсин[а-я]*|мандарин[а-я]*|лимон[а-я]*|груш[а-я]*|виноград[а-я]*|персик[а-я]*|нектарин[а-я]*|ягод[а-я]*|клубник[а-я]*|малин[а-я]*|черник[а-я]*|голубик[а-я]*|арбуз[а-я]*|дыня|дыни|ананас[а-я]*|авокадо|манго|хлеб[а-я]*|хлебушек|батон[а-я]*|лаваш[а-я]*|булк[а-я]*|булочк[а-я]*|багет[а-я]*|тост[а-я]*|сухар[а-я]*|печень[а-я]*|пряник[а-я]*|вафл[а-я]*|конфет[а-я]*|шоколад[а-я]*|шоколадк[а-я]*|батончик[а-я]*|чипс[а-я]*|снек[а-я]*|снэк[а-я]*|сухарик[а-я]*|семечк[а-я]*|орех[а-я]*|арахис[а-я]*|мармелад[а-я]*|зефир[а-я]*|минералк[а-я]*|газировк[а-я]*|лимонад[а-я]*|сочок|соки|сок\b|магазин[а-я]*|супермаркет[а-я]*|гипермаркет[а-я]*|гастроном[а-я]*|универсам[а-я]*|пятерочк[а-я]*|пятёрочк[а-я]*|пятак[а-я]*|магнит[а-я]*|перекресток[а-я]*|перекрёсток[а-я]*|перек[а-я]*|вкусвилл[а-я]*|лент[а-я]*|ашан[а-я]*|дикси|спар\b|spar\b|глобус[а-я]*|чижик[а-я]*|красное.*белое|кб\b|к&б|бристол[а-я]*|ярче|верный|азбук[а-я].*вкус[а-я]*|окей|самокат.*продукт|лавка.*продукт|сбермаркет|продукт[а-я]*|еда домой|покушать домой|закупился|покупки домой/i.test(lower)) {
      category = 'Продукты';
    }
    // D. Transport, Auto & Fuel
    else if (/такс|uber|убер|яндекс.*гоу|яндекс.*такси|карш|каршеринг|делимобиль|ситидрайв|белк[а]|заправил|бенз|дизель|солярк|азс|лукойл|газпром|роснефть|татнефть|тебойл|мойка|самомойк|детейлинг|помыл тачк|помыл машин|шиномонтаж|переобул|резин[аы]|балансировк|метро|проездной|тройк|стрелк|автобус|маршрутк|трамвай|электричк|мцд|мцк|сапсан|ласточк|ржд|поезд|самолет|авиабилет|побед|аэрофлот|s7|парковк|штраф|гибдд|платка|осаго|каско/i.test(lower)) {
      category = 'Транспорт';
    }
    // E. Animals / Pets
    else if (/коров[а-я]*|бык[а-я]*|телят[а-я]*|теленок|телк[а-я]*|коз[а-я]*|свин[а-я]*|хрюш[а-я]*|поросят[а-я]*|лошад[а-я]*|кон[яеь][а-я]*|жереб[а-я]*|овц[а-я]*|баран[а-я]*|ягнят[а-я]*|кур[а-я]*|петух[а-я]*|цыплят[а-я]*|гус[а-я]*|утк[а-я]*|индюк[а-я]*|скот[а-я]*|ферм[а-я]*|пасек[а-я]*|пчел[а-я]*|улей|питом[а-я]*|собак[а-я]*|щен[а-я]*|пес[а-я]*|пёсел[а-я]*|кошк[а-я]*|кот[а-я]*|котят[а-я]*|котейк[а-я]*|хомяк[а-я]*|попуга[а-я]*|рыбк[а-я]*|аквариум[а-я]*|грызун[а-я]*|корм[а-я]*|ветеринар[а-я]*|ветклиник[а-я]*|груминг[а-я]*|поводок|лоток|наполнитель/i.test(lower)) {
      category = 'Питомцы';
    }
    // F. Tech & Gaming
    else if (/плойк|соньк|playstation|ps5|ps4|xbox|иксбокс|нинтендо|switch|стимдек|видяха|видюх|видеокарт|rtx|geforce|проц|процессор|ссд|ssd|оперативк|монитор|моник|клав|мышк|айфон|iphone|эйрподс|airpods|макбук|macbook|ipad|айпад|эппл.*вотч|ноут|ноутбук|комп|пк|системник|телевизор|телик|техник|гаджет|наушник|колонк|алис[а]|станци[яи]|пылесос|стиралк|холодильник|микроволновк/i.test(lower)) {
      category = 'Техника';
    }
    // G. Subscriptions
    else if (/спотик|spotify|эппл.*мьюзик|apple.*music|яндекс.*плюс|плюс\b|телег|telegram.*prem|tg.*prem|нетфликс|netflix|ютуб|youtube|кинопоиск|иви|ivi|окко|okko|кион|kion|premier|start|vpn|vpn|хостинг|сервер|vps|vds|домен|айклауд|icloud|гугл.*диск|облако|подписк|chatgpt|gpt|midjourney|github|figma/i.test(lower)) {
      category = 'Подписки';
    }
    // H. Shopping & Clothes
    else if (/шмот|педал|тяги|кросс|кед|сникер|ботинк|худи|зипк|толстовк|свитшот|куртк|пуховик|пальто|джинс|штаны|брюк|футболк|мерч|вб\b|вэбэ|вайлдберриз|wildberries|озон|ozon|яндекс.*маркет|маркетплейс|мегамаркет|авито|цум|гум|стокманн|зарин|лайм|lime|befree|lamoda|ламода|косметик|духи|парфюм|золот.*яблок|зя\b|летуаль|шопинг|покупк/i.test(lower)) {
      category = 'Покупки';
    }
    // I. Health & Sports
    else if (/зал\b|качалк|спортзал|фитнес|трен[яе]|тренировк|тренер|персоналк|абонемент|протеин|креатин|бцаа|аптек|таблетк|колес[а]|витамин|омег[а]|врач|доктор|терапевт|стоматолог|зуб|пломб|брекет|элайнер|мрт|кт|узи|анализ|инвитро|гемотест|kdl|здоровь|массаж|психолог|остиопат|спа\b/i.test(lower)) {
      category = 'Здоровье';
    }
    // J. Housing & Utilities
    else if (/аренд|квартир|хат|ипотек|жкх|коммуналк|квартплат|свет|электричеств|вод[аы]|отоплен|газ\b|домофон|капремонт|интернет|вайфай|провайдер|ростелеком|домру|клининг|уборк|ремонт|стройк|обои|краск|плитк|ламинат|сантехник|леруа|лемана.*про|петрович|оби|obi|мебель|икеа|ikea|hoff|диван|кровать|шкаф|стол|матрас/i.test(lower)) {
      category = 'Жилье';
    }
    // K. Entertainment
    else if (/стим\b|steam|донат|скин|батлпас|battle.*pass|бп\b|вбакс|v-bucks|кино|фильм|сеанс|театр|спектакль|концерт|фест|фестивал|стендап|квест|боулинг|бильярд|страйкбол|парк|аттракцион|зоопарк|аквапарк|баня|сауна|настолк|игры/i.test(lower)) {
      category = 'Развлечения';
    }
    // L. Investments
    else if (/акци|облигац|офз|брокер|тинькофф.*инвест|бкс|крипт|биткоин|биток|btc|эфир|eth|usdt|тезер|тон\b|ton\b|байбит|bybit|бинанс|binance/i.test(lower)) {
      category = 'Инвестиции';
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
    type,
    category,
    amount,
    description: cleanDesc || (type === 'income' ? 'Поступление средств' : category),
    occurred_on
  };
}

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
  const msg = process.env.NODE_ENV === "production"
    ? "Внутренняя ошибка сервера. Пожалуйста, попробуйте позже."
    : (e.message || "Ошибка сервера. Проверьте DATABASE_URL и настройки базы.");
  res.status(500).json({ error: msg });
}

app.get("/health", async (_req, res) => {
  try {
    await db.query("select 1");
    res.status(200).json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
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

app.post("/api/auth/login", authLimiter, async (req, res) => {
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

const tables = { transactions: "transactions", budgets: "budgets", goals: "goals", subscriptions: "subscriptions" };

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
      [req.user.id, x.type, String(x.category).trim(), String(x.description || "").trim(), Math.round(Number(x.amount) * 100) / 100, x.occurred_on || getMskIsoDate(), isNaN(createdAt.getTime()) ? new Date() : createdAt]
    );
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/transactions/bulk", auth, async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body.transactions || []);
    if (!list.length) return res.status(400).json({ error: "Список операций пуст." });

    const inserted = [];
    for (const x of list) {
      if (!["income", "expense", "transfer"].includes(x.type) || !String(x.category || "").trim() || !(Number(x.amount) > 0)) {
        continue;
      }
      const createdAt = x.created_at ? new Date(x.created_at) : new Date();
      const r = await db.query(
        "insert into transactions(user_id,type,category,description,amount,occurred_on,created_at) values($1,$2,$3,$4,$5,$6,$7) returning *",
        [req.user.id, x.type, String(x.category).trim(), String(x.description || "").trim(), Math.round(Number(x.amount) * 100) / 100, x.occurred_on || getMskIsoDate(), isNaN(createdAt.getTime()) ? new Date() : createdAt]
      );
      inserted.push(r.rows[0]);
    }
    res.json({ ok: true, count: inserted.length, rows: inserted });
  } catch (e) {
    fail(res, e);
  }
});

const STATEMENT_AI_SYSTEM_PROMPT = `Ты — экспертный финансовый искусственный интеллект FinKaif AI для распознавания и анализа банковских выписок любых банков РФ (Т-Банк, Сбер, Альфа, ВТБ, Райффайзен, 1С, Точка и др.), а также любых таблиц учета расходов/доходов (Excel/XLSX, Google Таблицы, 1С, выгрузки TXT/CSV/TSV/JSON).

ТВОЯ ЗАДАЧА:
1. Определить источник данных (bank_name): "Т-Банк", "СберБанк", "Альфа-Банк", "ВТБ", "Райффайзенбанк", "Точка" или "1С / Банк-Клиент".
2. Определить точный период выписки (period: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", label: "ДД.ММ.ГГГГ — ДД.ММ.ГГГГ" }).
3. Посчитать total_income и total_expense (переводы между своими счетами не включать).
4. Извлечь ВСЕ транзакции с точным сохранением копеек без округления!

═══════════════════════════════════════
СТРОГИЕ СИСТЕМНЫЕ КАТЕГОРИИ (БЕЗ ЭМОДЗИ!):
═══════════════════════════════════════
Для расходов (type="expense"):
• Продукты: супермаркеты (Пятёрочка, Магнит, Перекрёсток, ВкусВилл, Дикси, Лента, Ашан, Metro Cash & Carry, Spar, Чижик, К&Б, Бристоль), мясные, рыбные, овощные лавки, минимаркеты у дома, гастрономы.
• Кафе: кофейни (Coffee Like, Cofix, Surf Coffee, One Price, Stars Coffee, Шоколадница, Кофемания, Дринкит), пекарни (Буханка, Хлебница, Цех 85, Вольчек), булочные, кондитерские, круассаны, кофе с собой.
• Рестораны: рестораны, фастфуд (Додо Пицца, Вкусно и точка, Burger King, Rostic's/KFC, Subway, Теремок), шаурма/донер/кебаб, бургерные, пиццерии, суши/роллы, хинкальные, чайхана, столовые, доставка еды (Яндекс Еда, Купер), бары, пабы.
• Транспорт: метро (Мосметро, турникет, валидатор, Тройка, Подорожник — ВСЕГДА Транспорт!), общественный транспорт, автобус, поезд, электричка, такси (Яндекс Go, Uber), каршеринг (Делимобиль, Ситидрайв), АЗС, бензин, парковки, платные дороги.
• Авто: автосервис, СТО, шиномонтаж, автомойка, детейлинг, автозапчасти (Exist, Autodoc, Emex), эвакуатор, шины/диски.
• Хобби: рыбалка и рыболовные снасти (Кайда, спиннинг, воблеры, удочки, приманки — ВСЕГДА Хобби!), товары для охоты, туризм, настольные игры (Hobby Games, Мосигра), творчество (Леонардо).
• Здоровье: аптеки (Ригла, Горздрав, Апрель, Планета Здоровья, Еаптека), клиники, анализы (Инвитро, Гемотест), стоматология, доктора, оптика, салоны красоты, парикмахерские, барбершопы (TopGun, Borodach), маникюр, косметология, массаж.
• Спорт: фитнес-клубы (World Class, DDX), тренажерный зал, бассейн, спортивные секции.
• Покупки: маркетплейсы (Wildberries, Ozon, Яндекс Маркет, Мегамаркет), ПВЗ, одежда, обувь, электроника (DNS, М.Видео), косметика (Золотое Яблоко, Л'Этуаль), цветы и букеты, подарки, зоомагазины.
• Подписки: онлайн-кинотеатры (Кинопоиск, Иви, Okko), музыка, Яндекс Плюс, Telegram Premium, VPN, сотовая связь (МТС, Билайн, Мегафон, T2), интернет.
• Жилье: ЖКХ, коммунальные платежи, квартплата, аренда, управляющие компании, домофон, стройматериалы (Леруа/Лемана Про, Петрович), мебель, ремонт.
• Развлечения: кинотеатры, театры, концерты, квесты, парки, игры (Steam, PlayStation).
• Путешествия: авиабилеты (Аэрофлот, Победа, S7), отели, бронирование жилья, экскурсии.
• Инвестиции: брокерские счета, ценные бумаги, криптоактивы.
• Прочее: если ни одна категория выше объективно не подходит.

Для доходов (type="income"):
• Зарплата: оклад, аванс, премия, выплата по трудовому договору.
• Фриланс: гонорар, проектная оплата, самозанятость.
• Дивиденды: доход от акций, купоны по облигациям, проценты по вкладу.
• Кэшбэк: банковский кэшбэк, бонусы.
• Переводы: входящий перевод от другого человека.

Для переводов (type="transfer"):
• Переводы: перевод между своими счетами или сторонний перевод.

═══════════════════════════════════════
ПРАВИЛА ДЛЯ ИП (ИНДИВИДУАЛЬНЫХ ПРЕДПРИНИМАТЕЛЕЙ):
═══════════════════════════════════════
- Если платеж в пользу "ИП [Фамилия]" и есть название точки или сфера деятельности (кафе, автосервис, шиномонтаж, салон красоты, стоматология, ПВЗ Wildberries/Ozon, снасти, пекарня, продукты) — классифицируй в соответствующую точную категорию!
- Очищай описание: убирай юридический шум ("ИП Смирнов А.В. / Кафе Зерно" -> "Кафе Зерно (ИП Смирнов)").
- Если указано чистое ФИО ИП без каких-либо намеков и невозможно определить назначение: выбери наиболее вероятную категорию ("Покупки" или "Кафе"), но поставь confidence: 0.50 и needs_confirmation: true.
- Для четко распознанных мерчантов ставь confidence: 0.95+ и needs_confirmation: false.

ФОРМАТ ВЫХОДНОГО JSON (СТРОГО ВАЛИДНЫЙ JSON БЕЗ MARKDOWN):
{
  "bank_name": "...",
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "label": "ДД.ММ.ГГГГ — ДД.ММ.ГГГГ" },
  "total_income": 0,
  "total_expense": 0,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": 0,
      "type": "income" | "expense" | "transfer",
      "is_self_transfer": true | false,
      "category": "КатегорияБезЭмодзи",
      "description": "ПонятноеНазваниеМерчанта",
      "confidence": 0.95,
      "needs_confirmation": false
    }
  ]
}`;

// Russian Merchant & IP Knowledge Base Engine (Shared Server / Client Specs)
const SERVER_EXPENSE_CATEGORIES = [
  'Продукты', 'Кафе', 'Рестораны', 'Транспорт', 'Такси', 'Хобби',
  'Подписки', 'Здоровье', 'Спорт', 'Покупки', 'Жилье',
  'ЖКХ', 'Путешествия', 'Развлечения', 'Авто', 'Инвестиции'
];
const SERVER_INCOME_CATEGORIES = [
  'Зарплата', 'Фриланс', 'Дивиденды', 'Кэшбэк', 'Переводы'
];
const SERVER_DEFAULT_CATEGORIES = [...SERVER_EXPENSE_CATEGORIES, ...SERVER_INCOME_CATEGORIES, 'Прочее'];

function isCategoryVerifiedInSystem(cat, availableCats = SERVER_DEFAULT_CATEGORIES) {
  if (!cat || typeof cat !== 'string') return false;
  const clean = cat.replace(/^[\p{Emoji}\u200d\s]+/u, '').trim().toLowerCase();
  if (!clean || clean === 'прочее' || clean === 'другое') return false;
  if (!Array.isArray(availableCats) || availableCats.length === 0) return false;

  const matchesClean = (name) => {
    if (!name || typeof name !== 'string') return false;
    const n = name.replace(/^[\p{Emoji}\u200d\s]+/u, '').trim().toLowerCase();
    return availableCats.some(c => {
      if (!c || typeof c !== 'string') return false;
      const ac = c.replace(/^[\p{Emoji}\u200d\s]+/u, '').trim().toLowerCase();
      return ac === n;
    });
  };

  if (matchesClean(clean)) return true;

  if (RUSSIAN_MERCHANTS_KB && RUSSIAN_MERCHANTS_KB.synonym_mappings) {
    const mapped = RUSSIAN_MERCHANTS_KB.synonym_mappings[clean];
    if (mapped && matchesClean(mapped)) return true;
  }

  return false;
}

function normalizeCategoryToAvailable(cat, availableCats = SERVER_DEFAULT_CATEGORIES) {
  if (!cat) return 'Прочее';
  const clean = String(cat).replace(/^[\p{Emoji}\u200d\s]+/u, '').trim();
  const low = clean.toLowerCase();

  // 1. Direct exact match (case-insensitive)
  const exact = availableCats.find(c => c.toLowerCase() === low);
  if (exact) return exact;

  // 2. Knowledge base synonym mapping
  if (RUSSIAN_MERCHANTS_KB && RUSSIAN_MERCHANTS_KB.synonym_mappings) {
    const kbTarget = RUSSIAN_MERCHANTS_KB.synonym_mappings[low];
    if (kbTarget) {
      const found = availableCats.find(c => c.toLowerCase() === kbTarget.toLowerCase());
      if (found) return found;
      if (kbTarget === 'Авто' || kbTarget === 'Такси') {
        const tr = availableCats.find(c => c.toLowerCase() === 'транспорт');
        if (tr) return tr;
      }
      if (kbTarget === 'Кафе') {
        const rest = availableCats.find(c => c.toLowerCase() === 'рестораны');
        if (rest) return rest;
      }
    }
  }

  // 3. Fallback regex synonym map
  const synonymMap = [
    { re: /фастфуд|столов|пицц|суши|ресторан|бургер|шаурм|шаверм|донер|кебаб|гриль|шашлык|бар\b|паб\b/i, target: 'Рестораны' },
    { re: /кафе(?!др)|кофе|кофейн|пекарн|выпечк|булочн|кондитерск|круассан/i, target: 'Кафе' },
    { re: /супермаркет|продукты|гастроном|универсам|бакалея|мясн|рыбн|овощ|фрукт/i, target: 'Продукты' },
    { re: /такси|uber/i, target: 'Такси' },
    { re: /метро|автобус|троллейбус|трамвай|поезд|электричк|каршеринг|ржд|цппк|проезд|парковк/i, target: 'Транспорт' },
    { re: /автосервис|сто\b|шиномонтаж|автомойка|детейлинг|автозапчаст|автодок|exist|экзист|бензин|азс|газпром|лукойл/i, target: 'Авто' },
    { re: /рыбал|рыболов|снаст|воблер|блесн|удочк|спиннинг|охот|туризм|моделизм|настолк|рукоделие|хобби/i, target: 'Хобби' },
    { re: /аптек|фарм|клиник|стоматолог|зубн|врач|доктор|медцентр|анализ|салон красоты|парикмахер|барбер|маникюр|педикюр|косметолог|здоровье/i, target: 'Здоровье' },
    { re: /фитнес|спортзал|тренажер|бассейн|спорт/i, target: 'Спорт' },
    { re: /одежд|обувь|маркетплейс|вайлдберриз|wildberries|wb\b|ozon|озон|шопинг|покупк|электроник|днс|dns|мвидео|цветы|флористик|подарк/i, target: 'Покупки' },
    { re: /жкх|квартплат|еирц|ук\b|тсж|коммунал|аренда жил|стройматериал|сантехник|электрик|мебель|обои/i, target: 'Жилье' },
    { re: /подписк|интернет|связь|мтс|билайн|мегафон|теле2|t2|кинопоиск|spotify|яндекс плюс/i, target: 'Подписки' },
    { re: /кино|театр|концерт|парк|развлечен|квест/i, target: 'Развлечения' },
    { re: /авиа|отел|путешеств/i, target: 'Путешествия' },
    { re: /зарплат|аванс|оклад|получк/i, target: 'Зарплата' },
    { re: /фриланс|гонорар/i, target: 'Фриланс' },
    { re: /дивиденд|процент.*вклад|инвестиц/i, target: 'Инвестиции' },
    { re: /кэшбэк|cashback/i, target: 'Кэшбэк' },
    { re: /перевод|сбп/i, target: 'Переводы' }
  ];

  for (const s of synonymMap) {
    if (s.re.test(low)) {
      const found = availableCats.find(c => c.toLowerCase() === s.target.toLowerCase());
      if (found) return found;
      if (s.target === 'Авто' || s.target === 'Такси') {
        const tr = availableCats.find(c => c.toLowerCase() === 'транспорт');
        if (tr) return tr;
      }
      if (s.target === 'Кафе') {
        const rest = availableCats.find(c => c.toLowerCase() === 'рестораны');
        if (rest) return rest;
      }
    }
  }

  const partial = availableCats.find(c => c.toLowerCase().includes(low) || low.includes(c.toLowerCase()));
  if (partial) return partial;

  return 'Прочее';
}

function analyzeRussianMerchant(rawDesc, amount = 0, availableCats = SERVER_DEFAULT_CATEGORIES) {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return {
      category: 'Прочее',
      clean_description: 'Не указано',
      confidence: 0,
      needs_confirmation: true,
      reason: 'empty'
    };
  }

  const orig = rawDesc.trim();
  const low = orig.toLowerCase().replace(/ё/g, 'е');

  // Check Individual Entrepreneur (ИП / IP / Индивидуальный предприниматель)
  const isIp = /^(?:индивидуальный\s+предприниматель|ип|ip)(?:\s+|$)/i.test(orig) || /(?:^|\s)(?:ип|ip)\s+[А-Яа-яЁёA-Za-z]/iu.test(orig);
  let ipPersonName = '';
  let ipSubtitle = '';

  if (isIp) {
    const afterIp = orig.replace(/^(?:индивидуальный\s+предприниматель|ип|ip)\s+/i, '').trim();
    const sepMatch = afterIp.match(/^([А-Яа-яЁёA-Za-z\s.]+?)(?:\s*[\/\-–—|(]\s*(.+?)[)\]]?$|\s+["«](.+?)["»]$)/u);
    if (sepMatch) {
      ipPersonName = (sepMatch[1] || '').trim();
      ipSubtitle = (sepMatch[2] || sepMatch[3] || '').trim();
    } else {
      const words = afterIp.split(/\s+/);
      if (words.length <= 3 && words.every(w => /^[А-Яа-яЁёA-Za-z.]+$/u.test(w) && !/салон|кафе|стоматолог|шиномонтаж|магазин|пекарн|аптек/i.test(w))) {
        ipPersonName = afterIp;
        ipSubtitle = '';
      } else {
        const nameParts = [];
        const restParts = [];
        let inName = true;
        for (const w of words) {
          if (inName && (/^[А-Яа-яЁёA-Za-z]\.?$/u.test(w) || nameParts.length < 1)) {
            nameParts.push(w);
          } else {
            inName = false;
            restParts.push(w);
          }
        }
        ipPersonName = nameParts.join(' ');
        ipSubtitle = restParts.join(' ');
      }
    }
  }

  // Consistent result formatter with strict category existence validation
  const formatResult = (rawCat, cleanTitle, highConfidence, defaultReason) => {
    const verified = isCategoryVerifiedInSystem(rawCat, availableCats);
    const normCat = normalizeCategoryToAvailable(rawCat, availableCats);
    let finalDesc = cleanTitle;
    if (ipSubtitle && ipPersonName) {
      finalDesc = `${ipSubtitle} (ИП ${ipPersonName.split(' ')[0] || ''})`.trim();
    } else if (ipPersonName && !finalDesc.includes('ИП')) {
      finalDesc = `${finalDesc} (ИП ${ipPersonName.split(' ')[0] || ''})`.trim();
    }

    if (!verified) {
      return {
        category: normCat,
        clean_description: finalDesc,
        confidence: 0.50,
        needs_confirmation: true,
        suggested_category: normCat,
        reason: 'category_not_in_system'
      };
    }

    return {
      category: normCat,
      clean_description: finalDesc,
      confidence: highConfidence,
      needs_confirmation: false,
      reason: defaultReason
    };
  };

  // 1. Metro Transit vs Metro C&C
  if (!/(?:кэш|cash|c&c|гипер)/i.test(low) && /(?:метрополитен|мосметро|станци[а-я]*\s+метро|турникет|валидатор|тройк|подорожник|метро)/i.test(low)) {
    return formatResult('Транспорт', 'Московский метрополитен (проезд)', 0.99, 'metro_transit');
  }

  // 2. Metro Cash & Carry (Groceries)
  if (/(?:metro cash|metro c&c|метро кэш)/i.test(low)) {
    return formatResult('Продукты', 'Metro Cash & Carry', 0.98, 'metro_cash_carry');
  }

  // 3. Fishing, Tackle & Outdoor Hobbies
  if (/(?:рыбал[а-я]*|рыболов[а-я]*|снаст[а-я]*|хищник|трофей|клёв|клев|кайда|kaida|spinningline|fmagazin|волжанка|серебряный ручей|воблер|блесн|удочк|спиннинг)/i.test(low)) {
    return formatResult('Хобби', orig.replace(/^(?:оплата|покупка|списание)\s+/i, '').trim(), 0.98, 'fishing_hobby');
  }

  // 4. Query Russian Merchant & Brand Knowledge Base catalog
  if (RUSSIAN_MERCHANTS_KB && Array.isArray(RUSSIAN_MERCHANTS_KB.merchants_catalog)) {
    for (const m of RUSSIAN_MERCHANTS_KB.merchants_catalog) {
      const aliasMatch = m.aliases && m.aliases.some(a => low.includes(a.toLowerCase()));
      if (aliasMatch) {
        const title = m.default_title || m.name;
        return formatResult(m.category, title, 0.97, 'kb_catalog_matched');
      }
    }
  }

  // 5. Query OKVED activities dictionary
  if (RUSSIAN_MERCHANTS_KB && Array.isArray(RUSSIAN_MERCHANTS_KB.okved_dictionary)) {
    for (const ok of RUSSIAN_MERCHANTS_KB.okved_dictionary) {
      const kwMatch = ok.keywords && ok.keywords.some(k => low.includes(k.toLowerCase()));
      if (kwMatch) {
        const title = ipSubtitle || ok.keywords[0] || orig;
        return formatResult(ok.category, title, 0.95, 'kb_okved_matched');
      }
    }
  }

  // 6. Deep Russian merchant knowledge base rules
  const knowledgeRules = [
    // A. Bakeries, Cafes & Coffee
    {
      re: /(?:кафе(?!др)|кофе|кофейн[а-я]*|пекарн[а-я]*|булочн[а-я]*|буханка|хлебниц[а-я]*|цех\s*85|вольчек|дринкит|drinkit|surf coffee|серф кофе|coffee like|кофе лайк|cofix|кофикс|one price|ван прайс|stars coffee|starbucks|шоколадниц[а-я]*|кофемания|coffeemania|синнабон|cinnabon|кулинари[яи]|кондитерск[а-я]*|круассан|чизкейк|пончик)/i,
      cat: 'Кафе',
      confidence: 0.96,
      defaultTitle: 'Кофейня / Кафе'
    },
    // B. Restaurants, Dining, Fast Food, Shawarma & Pizzeria
    {
      re: /(?:додо|dodo pizza|вкусно и точка|mcdonalds|макдоналдс|бургер кинг|burger king|kfc|ростикс|rostics|теремок|крошка картошка|subway|сабвей|шаурм[а-я]*|шаверм[а-я]*|донер|кебаб|шашлычн[а-я]*|гриль|хинкальн[а-я]*|чайхан[а-я]*|чайхон[а-я]*|столов[а-я]*|трапезн[а-я]*|блинн[а-я]*|пицц[а-я]*|суши|sushi|ролл[а-я]*|суши wok|суши sell|ёбидоёби|тануки|якитори[а-я]*|мята lounge|hookah|бар\b|паб\b|ресторан)/i,
      cat: 'Рестораны',
      confidence: 0.95,
      defaultTitle: 'Ресторан / Фастфуд'
    },
    // C. Pick-up Points (ПВЗ), Marketplaces & Delivery
    {
      re: /(?:wildberries|вайлдберриз|вайлдбериз|\bwb\b|\bвб\b|ozon\b|озон\b|яндекс маркет|мегамаркет|авито\s*доставка|пвз|пункт выдачи|сдэк|cdek|boxberry|боксберри)/i,
      cat: 'Покупки',
      confidence: 0.97,
      defaultTitle: 'Маркетплейс / ПВЗ'
    },
    // D. Auto Services, Tires, Car Wash, Parts & Gas
    {
      re: /(?:автосервис|шиномонтаж|автомойк[а-я]*|детейлинг|\bсто\b|автозапчаст[а-я]*|автодок|autodoc|exist|экзист|emex|емекс|автомаг|шины|диски|эвакуатор|техосмотр|лукойл|газпромнефть|роснефть|татнефть|тебойл|бензин|\bазс\b)/i,
      cat: 'Транспорт',
      confidence: 0.95,
      defaultTitle: 'Автосервис / АЗС'
    },
    // E. Beauty Salons, Barbershops, Hairdressers, Nails & Cosmetics
    {
      re: /(?:салон красоты|парикмахерск[а-я]*|барбер[а-я]*|барбершоп|topgun|borodach|chop-chop|маникюр|педикюр|ногт[ейи]*|бьюти|ресниц[а-я]*|бров[ейи]*|косметолог[а-я]*|эпиляци[яи]|массаж|золотое яблоко|летуаль|рив гош)/i,
      cat: 'Здоровье',
      confidence: 0.95,
      defaultTitle: 'Салон красоты / Барбершоп'
    },
    // F. Medical, Dentistry, Clinics, Pharmacies, Labs
    {
      re: /(?:стоматолог[а-я]*|зубн[а-я]*|клиник[а-я]*|медцентр|медицинск[а-я]*|доктор|инвитро|гемотест|\bcmd\b|хеликс|ситилаб|аптек[а-я]*|фарма|ригла|горздрав|планета здоровья|апрель|еаптека|оптика|линзы)/i,
      cat: 'Здоровье',
      confidence: 0.96,
      defaultTitle: 'Медицина / Стоматология'
    },
    // G. Fitness, Gym, Sports
    {
      re: /(?:фитнес|спортзал|тренажер[а-я]*|бассейн|\bddx\b|world class|спортмастер|турник)/i,
      cat: 'Спорт',
      confidence: 0.95,
      defaultTitle: 'Фитнес / Спорт'
    },
    // H. Supermarkets, Groceries, Meat, Fish, Dairy, Tobacco & Alcohol
    {
      re: /(?:пятерочк[а-я]*|пятёрочк[а-я]*|магнит\b|перекресток|перекрёсток|вкусвилл|чижик|дикси|лента\b|ашан|окей|спар\b|spar|красное\s*(&|и)\s*белое|\bк&б\b|\bкб\b|бристоль|ярче|азбука вкуса|самокат|яндекс лавка|купер|мясн[а-я]*|сыроварн[а-я]*|рыбн[а-я]*|овощ[ейи]*|фрукт[а-я]*|гастроном|универсам|продукты|минимаркет|табачн[а-я]*|пивоварн[а-я]*|разливн[а-я]*)/i,
      cat: 'Продукты',
      confidence: 0.95,
      defaultTitle: 'Супермаркет / Продукты'
    },
    // I. Home, Construction, Hardware, Furniture & Repairs
    {
      re: /(?:стройматериал[а-я]*|сантехник[а-я]*|электрик[а-я]*|крепеж|метиз[а-я]*|мебель|обои|краск[а-я]*|леруа|лемана про|петрович|максидом|\bоби\b|\bobi\b|ремонт квартир|хозтовар[а-я]*|1000 мелочей)/i,
      cat: 'Жилье',
      confidence: 0.94,
      defaultTitle: 'Стройматериалы / Ремонт'
    },
    // J. Flowers & Gifts
    {
      re: /(?:цвет[ыов]+|букет[а-я]*|флористик[а-я]*|цветочный ряд|мосцветторг|подарк[а-я]*|сувенир[а-я]*|воздушные шары)/i,
      cat: 'Покупки',
      confidence: 0.94,
      defaultTitle: 'Цветы и подарки'
    },
    // K. Pets & Veterinary
    {
      re: /(?:зоомагазин|зоотовар[а-я]*|ветклиник[а-я]*|ветеринар|ветаптек[а-я]*|корм для животных|груминг|четыре лапы|бетховен)/i,
      cat: 'Покупки',
      confidence: 0.94,
      defaultTitle: 'Зоотовары / Ветклиника'
    },
    // L. Tech & Phone Repair
    {
      re: /(?:ремонт телефонов|сервисный центр|днс|\bdns\b|м\.видео|мвидео|эльдорадо|ситилинк|re:store|чехлы для телефонов)/i,
      cat: 'Покупки',
      confidence: 0.94,
      defaultTitle: 'Электроника / Сервис'
    }
  ];

  for (const r of knowledgeRules) {
    if (r.re.test(low)) {
      const title = ipSubtitle || r.defaultTitle || orig;
      return formatResult(r.cat, title, r.confidence, 'rule_matched');
    }
  }

  // 7. Generic Individual Entrepreneur (ИП without clear category hints)
  // CANNOT be reliably auto-determined! ALWAYS highlight for confirmation!
  if (isIp) {
    const surnameParts = (ipPersonName || orig.replace(/^(?:индивидуальный\s+предприниматель|ип|ip)\s+/i, '')).trim().split(/[\s.]+/);
    const personSurname = surnameParts[0] || 'Контрагент';
    const cleanTitle = `ИП ${personSurname}`;
    
    let candidateCat = 'Покупки';
    if (amount > 0 && amount <= 500) candidateCat = 'Кафе';
    else if (amount > 500 && amount <= 3000) candidateCat = 'Покупки';
    else if (amount > 3000 && amount <= 15000) candidateCat = 'Здоровье';
    else if (amount > 50000) candidateCat = 'Переводы';

    const normCat = normalizeCategoryToAvailable(candidateCat, availableCats);
    return {
      category: normCat,
      clean_description: cleanTitle,
      confidence: 0.50,
      needs_confirmation: true,
      suggested_category: normCat,
      reason: 'ip_generic_unconfirmed'
    };
  }

  // 8. Fallbacks
  if (/зарплат[а-я]*|аванс|оклад|расчет|преми[яи]|гонорар/i.test(low)) {
    return formatResult('Зарплата', orig, 0.95, 'keyword_salary');
  }
  if (/дивиденд[а-я]*|купон[а-я]*|брокер|вклад|процент по вкладу/i.test(low)) {
    return formatResult('Инвестиции', orig, 0.95, 'keyword_invest');
  }
  if (/перевод от|пополнение счета|сбп/i.test(low)) {
    return formatResult('Переводы', orig, 0.90, 'keyword_transfers');
  }

  // 9. Unknown
  return {
    category: 'Прочее',
    clean_description: orig,
    confidence: 0.30,
    needs_confirmation: true,
    suggested_category: 'Покупки',
    reason: 'unknown'
  };
}

async function parseBankStatementWithGemini(fileContent, fileName = '', bankPreset = 'auto') {
  const truncated = String(fileContent || '').slice(0, 120000);
  const promptUser = `Распознай эту банковскую выписку (файл: "${fileName}", подсказка банка: "${bankPreset}") и верни JSON со всеми операциями, банком и периодом:\n\n${truncated}`;

  const body = {
    system_instruction: {
      parts: [{ text: STATEMENT_AI_SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: promptUser }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  let lastErr = null;
  for (const apiKey of GEMINI_API_KEYS) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
          lastErr = new Error(data.error?.message || `Gemini ${model} error: ${response.status}`);
          continue;
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const parsed = JSON.parse(rawText);
        if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
          return {
            success: true,
            engine: `gemini-ai (${model})`,
            bank_name: parsed.bank_name || (bankPreset !== 'auto' ? bankPreset : 'Банк РФ'),
            period: parsed.period || null,
            total_income: Number(parsed.total_income) || 0,
            total_expense: Number(parsed.total_expense) || 0,
            transactions: parsed.transactions
          };
        }
      } catch (err) {
        lastErr = err;
        console.warn(`Gemini bank parse error on model ${model}:`, err.message);
      }
    }
  }

  throw lastErr || new Error("Не удалось распознать выписку через Gemini AI");
}

async function parseBankStatementWithGeminiPdf(pdfBase64, fileName = '', bankPreset = 'auto') {
  const promptUser = `Распознай эту банковскую выписку в формате PDF (файл: "${fileName}", подсказка банка: "${bankPreset}") и верни JSON со всеми операциями, периодом и банком.`;

  const body = {
    system_instruction: {
      parts: [{ text: STATEMENT_AI_SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: "application/pdf",
              data: pdfBase64
            }
          },
          {
            text: promptUser
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  let lastErr = null;
  for (const apiKey of GEMINI_API_KEYS) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
          lastErr = new Error(data.error?.message || `Gemini ${model} error: ${response.status}`);
          continue;
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const parsed = JSON.parse(rawText);
        if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
          return {
            success: true,
            engine: `gemini-ai-pdf (${model})`,
            bank_name: parsed.bank_name || (bankPreset !== 'auto' ? bankPreset : 'Банк РФ'),
            period: parsed.period || null,
            total_income: Number(parsed.total_income) || 0,
            total_expense: Number(parsed.total_expense) || 0,
            transactions: parsed.transactions
          };
        }
      } catch (err) {
        lastErr = err;
        console.warn(`Gemini PDF parse error on model ${model}:`, err.message);
      }
    }
  }

  throw lastErr || new Error("Не удалось распознать PDF выписку через Gemini AI");
}

app.post("/api/ai/parse-statement", auth, async (req, res) => {
  try {
    const { content, pdf_base64, filename, preset } = req.body || {};
    if (!content && !pdf_base64) {
      return res.status(400).json({ error: "Пустой файл выписки." });
    }

    try {
      let result;
      if (pdf_base64) {
        result = await parseBankStatementWithGeminiPdf(pdf_base64, filename, preset);
      } else {
        result = await parseBankStatementWithGemini(content, filename, preset);
      }
      return res.json(result);
    } catch (aiErr) {
      console.warn("AI Statement parsing notice:", aiErr.message);
      return res.json({
        success: false,
        fallback: true,
        error: aiErr.message
      });
    }
  } catch (e) {
    fail(res, e);
  }
});

async function callGeminiBatchCategorizer(apiKey, systemPrompt, userMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds for deep batch reasoning
  try {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Gemini batch model ${model} status ${response.status}:`, errText.slice(0, 100));
          continue;
        }
        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) continue;
        const parts = candidate.content?.parts || [];
        const validParts = parts.filter(p => !p.thought);
        const fullText = (validParts.length > 0 ? validParts : parts).map(p => p.text || "").join("").trim();
        if (fullText) return fullText;
      } catch (err) {
        if (controller.signal.aborted) {
          console.warn("Gemini batch request timed out (10s limit)");
          break;
        }
      }
    }
  } catch (e) {
    console.warn("Gemini batch categorizer notice:", e.message);
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

app.post("/api/ai/categorize-batch", auth, aiLimiter, async (req, res) => {
  try {
    const { transactions, user_categories } = req.body || {};
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "Список транзакций для классификации пуст." });
    }

    const availableCats = Array.isArray(user_categories) && user_categories.length > 0
      ? user_categories
      : SERVER_DEFAULT_CATEGORIES;

    // 1. First pass: run deterministic Russian Merchant & IP Knowledge Base (0ms)
    const processed = transactions.map((t, idx) => {
      const desc = String(t.description || t.title || '').trim();
      const amt = Number(t.amount) || 0;
      const localAnalysis = analyzeRussianMerchant(desc, amt, availableCats);
      return {
        index: idx,
        id: t.id || idx,
        original_description: desc,
        amount: amt,
        type: t.type || 'expense',
        ...localAnalysis
      };
    });

    // 2. Identify items that require Neural Gemini Classification
    // (confidence < 0.85 or generic IP without subtitle, or unknown description)
    const needingNeural = processed.filter(p => p.confidence < 0.85);

    if (needingNeural.length > 0) {
      const itemsForPrompt = needingNeural.slice(0, 40).map(p => ({
        index: p.index,
        description: p.original_description,
        amount: p.amount,
        type: p.type
      }));

      const neuralPrompt = `Ты — экспертный финансовый классификатор банковских выписок РФ в FinKaif OS.
ТВОЯ ЗАДАЧА: Для каждой транзакции определить точную категорию и чистое название торговой точки.

СПИСОК РАЗРЕШЕННЫХ КАТЕГОРИЙ (СТРОГО ВЫБИРАЙ ТОЛЬКО ИЗ ЭТОГО СПИСКА):
${JSON.stringify(availableCats)}

ПРАВИЛА АНАЛИЗА ОПЕРАЦИЙ И ИП (ИНДИВИДУАЛЬНЫХ ПРЕДПРИНИМАТЕЛЕЙ):
1. В РФ огромное число торговых точек, кофеен, пекарен, ПВЗ, сервисов и аптек оформлены как "ИП [Фамилия]".
2. Если в названии, описании или мерчанте есть намёк на сферу деятельности:
   - Кофейня, пекарня, выпечка, булочная, кофе -> "Кафе" (уверенность 0.95+)
   - Ресторан, шаурма, пицца, бургеры, суши, доставка еды, столовая, фастфуд -> "Рестораны" (уверенность 0.95+)
   - ПВЗ Wildberries, Ozon, Яндекс Маркет, одежда, обувь, цветы, косметика, электроника -> "Покупки" (уверенность 0.95+)
   - Автосервис, шиномонтаж, автомойка, автозапчасти, бензин, АЗС -> "Транспорт" или "Авто" (уверенность 0.95+)
   - Салон красоты, парикмахерская, барбершоп, стоматология, аптека, клиника, анализы -> "Здоровье" (уверенность 0.95+)
   - Супермаркет, овощи, фрукты, мясо, рыба, продукты питания -> "Продукты" (уверенность 0.95+)
   - Снасти, рыбалка, охота, туризм, настольные игры -> "Хобби" (уверенность 0.98+)
   - Метро, Мосметро, турникет, проездной, Тройка -> "Транспорт" (уверенность 1.0)
   - Metro Cash & Carry (гипермаркет) -> "Продукты" (уверенность 0.98)
3. Если указано только "ИП [Фамилия]" без каких-либо намёков и невозможно определить сферу:
   - Сформируй чистое название "ИП [Фамилия]".
   - Предложи наиболее вероятную категорию (например "Покупки" или "Кафе").
   - Установи "confidence": 0.50 и "needs_confirmation": true.
4. Если операция четко определена:
   - Установи "needs_confirmation": false и "confidence": 0.90..1.0.

ФОРМАТ ОТВЕТА (СТРОГО JSON-массив без markdown):
[
  {
    "index": 0,
    "category": "Категория_из_списка",
    "clean_description": "Красивое название",
    "confidence": 0.95,
    "needs_confirmation": false
  }
]`;

      const userText = JSON.stringify(itemsForPrompt);

      for (const key of GEMINI_API_KEYS) {
        try {
          const raw = await callGeminiBatchCategorizer(key, neuralPrompt, userText);
          if (raw) {
            const cleanJson = raw.replace(/^```(?:json)?/im, '').replace(/```$/im, '').trim();
            const aiResults = JSON.parse(cleanJson);
            if (Array.isArray(aiResults)) {
              for (const aiItem of aiResults) {
                const target = processed.find(p => p.index === aiItem.index);
                if (target && aiItem.category) {
                  const verified = isCategoryVerifiedInSystem(aiItem.category, availableCats);
                  target.category = normalizeCategoryToAvailable(aiItem.category, availableCats);
                  if (aiItem.clean_description) target.clean_description = String(aiItem.clean_description).trim();
                  
                  if (verified) {
                    target.confidence = Math.max(0.1, Math.min(1.0, Number(aiItem.confidence) || 0.7));
                    target.needs_confirmation = aiItem.needs_confirmation !== undefined ? Boolean(aiItem.needs_confirmation) : target.confidence < 0.85;
                    target.reason = target.needs_confirmation ? (target.reason || 'gemini_ai_unconfirmed') : 'gemini_ai';
                  } else {
                    target.confidence = 0.45;
                    target.needs_confirmation = true;
                    target.reason = 'category_not_in_system';
                  }
                  target.suggested_category = target.category;
                }
              }
              break;
            }
          }
        } catch (geminiErr) {
          console.warn("Gemini batch categorization notice:", geminiErr.message);
        }
      }
    }

    res.json({
      ok: true,
      count: processed.length,
      results: processed
    });
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
        x.occurred_on || getMskIsoDate(),
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

app.post("/api/subscriptions", auth, async (req, res) => {
  try {
    const x = req.body;
    if (!String(x.name || "").trim() || !(Number(x.amount) > 0)) {
      return res.status(400).json({ error: "Проверьте название и сумму подписки." });
    }
    const day = Math.min(31, Math.max(1, parseInt(x.day_of_month, 10) || 1));
    const cat = String(x.category || "Подписки").trim();
    const r = await db.query(
      "insert into subscriptions(user_id,name,amount,category,day_of_month) values($1,$2,$3,$4,$5) returning *",
      [req.user.id, String(x.name).trim(), Math.round(Number(x.amount) * 100) / 100, cat, day]
    );
    res.json(r.rows[0]);
  } catch (e) {
    fail(res, e);
  }
});

async function callGeminiFast(apiKey, systemPrompt, userMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1600);
  try {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 128,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (!response.ok) continue;
        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) continue;
        const parts = candidate.content?.parts || [];
        const validParts = parts.filter(p => !p.thought);
        const fullText = (validParts.length > 0 ? validParts : parts).map(p => p.text || "").join("").trim();
        if (fullText) return fullText;
      } catch (err) {
        if (controller.signal.aborted) break;
      }
    }
  } catch (e) {
    // ignore
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

app.post("/api/parse-tx", auth, aiLimiter, async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Текст не передан." });
    }
    const cleanInput = String(text).trim();
    const cacheKey = cleanInput.toLowerCase();

    // 0ms Cache hit
    const cached = getCachedParsedTx(cacheKey);
    if (cached) {
      return res.json({ ok: true, parsed: cached, fromCache: true });
    }

    // High confidence local deterministic check (< 0.1ms)
    const instantParse = parseTxFallback(cleanInput);
    if (instantParse && instantParse.amount > 0 && instantParse.category !== 'Прочее') {
      setCachedParsedTx(cacheKey, instantParse);
      return res.json({ ok: true, parsed: instantParse, instant: true });
    }

    const mskNow = getMskDate();
    const dYesterday = new Date(mskNow); dYesterday.setDate(dYesterday.getDate() - 1);
    const dBefore = new Date(mskNow); dBefore.setDate(dBefore.getDate() - 2);
    const toIso = d => getMskIsoDate(d);

    const prompt = `Ты — финансовый классификатор FinKaif OS. Извлеки операцию из разговорной русской фразы.

КАТЕГОРИИ:
- "Продукты": еда домой, супермаркеты (пятерочка, магнит, перекресток, вкусвилл, лента, ашан, кб, дикси, ярче), бакалея (макароны, спагетти, паста, крупы, рис, гречка, мука, масло), мясо, курица, индейка, фарш, рыба, сыр, творог, яйца, овощи, фрукты, хлеб, чай, сок, сладости, снэки.
- "Рестораны": кафе, рестораны, столовые, фастфуд (шаурма/шавуха, додо, бургеры, вкусно и точка, кфс, ростикс), готовые блюда (том ям, фо бо, рамен, хинкали, хачапури, плов, лагман, борщ, солянка, паста карбонара, стейк, суши, роллы), доставка еды (яндекс еда, деливери), бары, пабы, пиво.
- "Кафе": кофейни, кофе, капучино, латте, раф, чай в кофейне, пекарни, круассаны, чизкейк, десерты, выпечка.
- "Транспорт": такси, каршеринг, бензин, заправка, азс, автомойка, шиномонтаж, метро, автобус, поезд, авиабилеты, парковка, штрафы.
- "Питомцы": корова, бык, скот, ферма, корм для животных, собака, щенок, кот, кошка, ветеринар, ветклиника, груминг.
- "Техника": телефон, айфон, комп, ноутбук, консоль, видеокарта, наушники, бытовая техника.
- "Подписки": спотифай, яндекс плюс, телеграм премиум, нетфликс, впн, хостинг, облако.
- "Покупки": одежда, обувь, шмотки, кроссовки, маркетплейсы (ozon, wildberries), косметика.
- "Здоровье": аптека, лекарства, витамины, врач, анализы, стоматолог, спортзал, фитнес, тренировки.
- "Жилье": аренда, ипотека, жкх, коммуналка, интернет, ремонт, стройматериалы, мебель.
- "Развлечения": кино, игры, steam, концерты, квесты, баня, настолки.
- "Инвестиции": акции, облигации, крипта, биток.
- "Зарплата": зп, аванс, оклад, получка, премия, бонусы, выплата на работе.
- "Фриланс": оплата за проект, дизайн, разработка, сайт, халтура, калым.
- "Продажи": продал на авито/юле.
- "Подарки": подарили, донат, чаевые.
- "Возврат долга": вернули долг, отдали долг.

СУММЫ И СЛЕНГ:
- косарь, косаря, косарей, кусок, штука = 1 000
- пятихатка, пятихат = 500
- сотка при покупках = 100; сотка при зарплате/доходе = 100 000
- полтос = 50 000; сорокет = 40 000; двушка = 2 000; трешка = 3 000; пятерка = 5 000; чирик = 10 000
- 50к, 50k = 50 000; 1.5к = 1 500
- лям = 1 000 000; лимон (в контексте денег) = 1 000 000; полтора ляма = 1 500 000
- ярд = 1 000 000 000
ВАЖНО: "арбуз" — это ВСЕГДА фрукт/ягода (категория "Продукты"), а НЕ сумма! "лимоны" в покупках — это фрукты (категория "Продукты")! Сумма ВСЕГДА извлекается из явных цифр фразы (например "за 100 рублей" = 100).

ДАТЫ: сегодня = ${toIso(mskNow)}, вчера = ${toIso(dYesterday)}, позавчера = ${toIso(dBefore)}

Ответь СТРОГО валидным JSON без markdown:
{"type":"income"|"expense","category":"Категория","amount":число,"description":"Чистое название (без 'купил', 'взял', 'потратил' и сумм)","occurred_on":"YYYY-MM-DD"}`;

    let parsed = null;
    for (const key of GEMINI_API_KEYS) {
      try {
        const raw = await callGeminiFast(key, prompt, cleanInput);
        if (raw) {
          const cleanJson = raw.replace(/^```(?:json)?/im, '').replace(/```$/im, '').trim();
          const p = JSON.parse(cleanJson);
          if (p && Number(p.amount) > 0) {
            parsed = {
              type: p.type === 'income' ? 'income' : 'expense',
              category: String(p.category || (p.type === 'income' ? 'Зарплата' : 'Прочее')),
              amount: Math.round(Number(p.amount)),
              description: String(p.description || cleanInput),
              occurred_on: String(p.occurred_on || toIso(mskNow)),
              ai: true
            };
            break;
          }
        }
      } catch (err) {
        // continue
      }
    }

    if (!parsed) {
      parsed = instantParse || parseTxFallback(cleanInput);
    }

    if (parsed) {
      setCachedParsedTx(cacheKey, parsed);
    }

    res.json({ ok: true, parsed });
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

  // ─── 0. АГЕНТНЫЕ ДЕЙСТВИЯ (DIRECT AGENTIC ACTION ENGINE) ───
  // Создание цели: "Создай цель на отпуск 150000", "Поставь цель подушка 300к", "Хочу накопить 500к на машину"
  if (/(?:создай|поставь|добавь|хочу накопить|сделай цель)\s+(?:цель|накопление|накопить)?/i.test(q) || (/(?:цель|накопить)\s+(?:на|в)/i.test(q) && askedAmount)) {
    const amt = askedAmount || 100000;
    let goalName = 'Финансовая цель';
    const nameMatch = question.match(/(?:цель|накопить|накопление)\s+(?:на|в)?\s*([а-яёa-z0-9\s-]+?)(?:\s*(?:на|в размере|сумма|цель)?\s*\d|\s*$)/i);
    if (nameMatch && nameMatch[1]) {
      const clean = nameMatch[1].replace(/(?:создай|поставь|добавь|хочу|мне|нужно)/gi, '').trim();
      if (clean.length > 1) {
        goalName = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
    } else {
      const generalMatch = question.match(/(?:на|для)\s+([а-яёa-z0-9\s-]+?)(?:\s*\d|\s*$)/i);
      if (generalMatch && generalMatch[1].trim().length > 1) {
        const c = generalMatch[1].trim();
        goalName = c.charAt(0).toUpperCase() + c.slice(1);
      }
    }

    return `🎯 **Цель «${goalName}» на ${amt.toLocaleString('ru-RU')} ₽ успешно создается!**\n\n` +
      `Я подготовил и зафиксировал эту цель в вашей системе FinKaif. Теперь прогресс будет отображаться в разделе «Цели» с автоматическим расчётом необходимого ежемесячного пополнения.\n\n` +
      `💡 **Совет:** при норме сбережений ${savingsRate}% вы достигнете цели гораздо быстрее, если настроите автопополнение в день зарплаты.\n\n` +
      `[ACTION_EXEC:create_goal:{"name":"${goalName}","target_amount":${amt},"saved_amount":0}]`;
  }

  // Создание / установка бюджета: "Поставь бюджет на продукты 35000", "Создай лимит на кафе 20к"
  if (/(?:создай|поставь|установи|зафиксируй|сделай)\s+(?:бюджет|лимит)/i.test(q) || (/(?:бюджет|лимит)\s+(?:на|для|по)/i.test(q) && askedAmount)) {
    const amt = askedAmount || 25000;
    let category = 'Прочие расходы';
    const catMatch = question.match(/(?:на|для|по|категори[июя]?)\s+([а-яёa-z0-9\s-]+?)(?:\s*(?:на|в размере|сумма|лимит)?\s*\d|\s*$)/i);
    if (catMatch && catMatch[1]) {
      const clean = catMatch[1].replace(/(?:бюджет|лимит|создай|поставь|установи)/gi, '').trim();
      if (clean.length > 1) {
        category = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
    }

    return `📊 **Лимит бюджета для категории «${category}» на ${amt.toLocaleString('ru-RU')} ₽/мес зафиксирован!**\n\n` +
      `Я занёс этот лимит в модуль «Бюджеты». Система FinKaif будет автоматически отслеживать ваши ежедневные траты и заранее предупредит при приближении к 85% лимита.\n\n` +
      `[ACTION_EXEC:create_budget:{"category":"${category}","limit_amount":${amt}}]`;
  }

  // Запись операции: "Запиши расход 1200 на такси", "Добавь доход 95000 зарплата"
  if (/(?:запиши|зафиксируй|добавь)\s+(?:расход|доход|трату|поступление|операцию)/i.test(q) || (/(?:потратил|купил|получил|пришло)\s+\d/i.test(q))) {
    const isIncome = /доход|поступление|получил|пришло|зарплат|преми/i.test(q);
    const amt = askedAmount || 1000;
    let cat = isIncome ? 'Доходы' : 'Разное';
    if (/такси|транспорт|метро|бензин/i.test(q)) cat = 'Транспорт';
    else if (/продукт|еда|супермаркет|магазин/i.test(q)) cat = 'Продукты';
    else if (/кафе|ресторан|кофе|бар/i.test(q)) cat = 'Рестораны';
    else if (/аптек|врач|лекарств/i.test(q)) cat = 'Здоровье';
    else if (/зарплат|аванс/i.test(q)) cat = 'Зарплата';

    const desc = isIncome ? 'Поступление средств' : 'Запись через ассистента';

    return `⚡ **Операция успешно добавлена в журнал!**\n\n` +
      `Зафиксировано: **${isIncome ? '+' : '−'}${amt.toLocaleString('ru-RU')} ₽** (${cat}). Баланс капитала и графики расходов мгновенно обновлены.\n\n` +
      `[ACTION_EXEC:create_tx:{"type":"${isIncome ? 'income' : 'expense'}","amount":${amt},"category":"${cat}","description":"${desc}"}]`;
  }

  // Пополнение цели: "Пополни цель отпуск на 10000", "Отложи 5000 в подушку"
  if (/(?:пополни|отложи|закинь|переведи)\s+(?:в|на)?\s*(?:цель|подушку|копилку)/i.test(q) && askedAmount) {
    const amt = askedAmount;
    let goalName = (goals && goals[0]) ? goals[0].name : 'Подушка безопасности';
    const gMatch = question.match(/(?:цель|копилку|подушку)\s*([а-яёa-z0-9\s-]+?)(?:\s*(?:на|сумма)?\s*\d|\s*$)/i);
    if (gMatch && gMatch[1] && gMatch[1].trim().length > 1) {
      goalName = gMatch[1].trim();
    }

    return `💰 **В цель «${goalName}» зачислено +${amt.toLocaleString('ru-RU')} ₽!**\n\n` +
      `Отличный шаг к финансовой свободе. Накопительный прогресс цели увеличился.\n\n` +
      `[ACTION_EXEC:deposit_goal:{"name":"${goalName}","amount":${amt}}]`;
  }

  // Удаление цели: "Удали цель отпуск", "Сними цель подушка", "Удали все цели"
  if (/(?:удали|стереть|сними|убери|закрой)\s+(?:цель|накопление|цели)/i.test(q)) {
    let goalName = '';
    const gMatch = question.match(/(?:цель|накопление|цели)\s+([а-яёa-z0-9\s-]+?)(?:\s*$|\s*[.,!])/i);
    if (gMatch && gMatch[1]) {
      goalName = gMatch[1].replace(/(?:удали|стереть|сними|убери|закрой)/gi, '').trim();
    }
    const isAll = /(?:все|всё|все цели)/i.test(q);
    const targetName = isAll ? 'all' : (goalName || 'последнюю');
    return `🗑️ **Цель «${isAll ? 'Все цели' : (goalName || 'Финансовая цель')}» успешно удалена!**\n\n` +
      `Цель снята с мониторинга и удалена из вашего портфеля FinKaif. Доступные ресурсы распределены на оставшиеся приоритеты.\n\n` +
      `[ACTION_EXEC:delete_goal:{"name":"${targetName}"}]`;
  }

  // Удаление лимита бюджета: "Удали бюджет на кафе", "Сними лимит продукты", "Удали все бюджеты"
  if (/(?:удали|стереть|сними|убери|отмени)\s+(?:бюджет|лимит)/i.test(q)) {
    let category = '';
    const catMatch = question.match(/(?:на|для|по|категори[июя]?|бюджет|лимит)\s+([а-яёa-z0-9\s-]+?)(?:\s*$|\s*[.,!])/i);
    if (catMatch && catMatch[1]) {
      category = catMatch[1].replace(/(?:бюджет|лимит|удали|сними|убери|отмени)/gi, '').trim();
    }
    const isAll = /(?:все|всё|все бюджеты|все лимиты)/i.test(q);
    const targetCat = isAll ? 'all' : (category || 'Прочее');
    return `🗑️ **Лимит бюджета для «${isAll ? 'Всех категорий' : targetCat}» успешно снят!**\n\n` +
      `Ограничение трат удалено из модуля «Бюджеты». Вы можете установить новый лимит в любое время.\n\n` +
      `[ACTION_EXEC:delete_budget:{"category":"${targetCat}"}]`;
  }

  // Удаление операции: "Удали последнюю операцию", "Отмени транзакцию"
  if (/(?:удали|стереть|отмени)\s+(?:последнюю\s+)?(?:операцию|трату|расход|транзакцию|запись)/i.test(q)) {
    return `🗑️ **Последняя операция успешно удалена из журнала!**\n\n` +
      `Запись стёрта из истории транзакций, баланс капитала и статистика скорректированы.\n\n` +
      `[ACTION_EXEC:delete_tx:{"last":true}]`;
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

  // --- Monthly breakdown (current vs previous month in Moscow Time) ---
  const now = getMskDate();
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

8. ИНТЕРАКТИВНЫЕ КНОПКИ НАВИГАЦИИ — добавляй в конце ответа в формате:
   [ACTION:goals:gl-fire:Создать цель FIRE]
   [ACTION:budgets:bg-all:Настроить бюджеты]
   [ACTION:analytics:cf:Анализ денежного потока]
   [ACTION:transactions:tx-all:Посмотреть все операции]

9. ⚡ АГЕНТНЫЕ КОМАНДЫ ДЕЙСТВИЯ (ПОЛНЫЙ ИНТЕРФЕЙС УПРАВЛЕНИЯ СИСТЕМОЙ FINKAIF):
   Ты умеешь НЕ ПРОСТО говорить, а РЕАЛЬНО УПРАВЛЯТЬ объектами в приложении FinKaif (создавать, пополнять, удалять цели, бюджеты и операции)!
   Когда пользователь просит:
   • Создать/поставить цель (накопить на что-то, цель на отпуск/машину/подушку) — ОБЯЗАТЕЛЬНО включи в ответ строку:
     [ACTION_EXEC:create_goal:{"name":"Название цели","target_amount":Сумма,"saved_amount":0}]
   • Удалить цель / снять цель (например, «удали цель Отпуск», «удали цель ...») — ОБЯЗАТЕЛЬНО включи строку:
     [ACTION_EXEC:delete_goal:{"name":"Название цели"}]
   • Создать/установить лимит бюджета на категорию — ОБЯЗАТЕЛЬНО включи в ответ строку:
     [ACTION_EXEC:create_budget:{"category":"Категория","limit_amount":Сумма}]
   • Удалить лимит бюджета / снять ограничение с категории (например, «удали бюджет на кафе», «сними лимит с такси») — ОБЯЗАТЕЛЬНО включи строку:
     [ACTION_EXEC:delete_budget:{"category":"Категория"}]
   • Записать операцию/трату/доход — ОБЯЗАТЕЛЬНО включи в ответ строку:
     [ACTION_EXEC:create_tx:{"type":"expense"|"income","amount":Сумма,"category":"Категория","description":"Описание"}]
   • Удалить операцию/отменить последнюю операцию (например, «удали последнюю операцию», «отмени расход») — ОБЯЗАТЕЛЬНО включи строку:
     [ACTION_EXEC:delete_tx:{"last":true}]
   • Пополнить цель деньгами — ОБЯЗАТЕЛЬНО включи строку:
     [ACTION_EXEC:deposit_goal:{"name":"Название цели","amount":Сумма}]
   Клиент FinKaif распознает этот блок и АВТОМАТИЧЕСКИ выполнит действие в базе данных и покажет интерактивную карточку выполнения!

10. АНАЛИЗ ОПИСАНИЙ И ПРИМЕЧАНИЙ ПОЛЬЗОВАТЕЛЯ:
    В транзакциях пользователь часто указывает важные уточнения: «от кого/кому» (перевод другу, возврат долга от Саши, подарок на ДР, отпуск, премия).
    ОБЯЗАТЕЛЬНО обращай внимание на эти описания и ссылайся на них в анализе («Вижу, что вам вернули долг 15 000 ₽ за поездку, а на подарки ушло 5 000 ₽...»), чтобы пользователь чувствовал глубокое понимание его контекста!`;
}


async function callGemini(apiKey, systemPrompt, userMessage, history = []) {
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
      temperature: 0.2,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) {
        lastErr = new Error(data.error?.message || `Gemini ${model} error`);
        console.warn(`Gemini model ${model} error notice:`, data.error?.message?.slice(0, 120));
        continue;
      }

      const candidate = data.candidates?.[0];
      if (!candidate) continue;

      const parts = candidate.content?.parts || [];
      const validParts = parts.filter(p => !p.thought);
      const fullText = (validParts.length > 0 ? validParts : parts).map(p => p.text || "").join("").trim();
      if (fullText) return fullText;
    } catch (err) {
      lastErr = err;
      console.warn(`Gemini request to ${model} error:`, err.message);
    }
  }

  throw lastErr || new Error("Не удалось получить ответ от Gemini API");
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

    const rawOpenAI = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
    const isValidOpenAI = rawOpenAI.startsWith("sk-");

    let geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
    if (!geminiKey && (rawOpenAI.startsWith("AQ.") || rawOpenAI.startsWith("AIza"))) {
      geminiKey = rawOpenAI;
    }
    if (!geminiKey && !isValidOpenAI && !process.env.GROQ_API_KEY && !process.env.DEEPSEEK_API_KEY) {
      geminiKey = GEMINI_API_KEYS[0];
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

app.post("/api/assistant", auth, aiLimiter, assistantHandler);
app.post("/api/chat", auth, aiLimiter, assistantHandler);

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(port, "0.0.0.0", () => console.log(`Finkaif is running on port ${port}`));