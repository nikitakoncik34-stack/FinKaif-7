import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const kb = JSON.parse(readFileSync(new URL('../data/russian_merchants_kb.json', import.meta.url), 'utf8'));
const section = (source, from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const categories = section(appSource, 'const SYSTEM_EXPENSE_CATEGORIES', 'function getAllCategories');
function client(api = async () => ({ success: false }), token = null) {
  const ctx = vm.createContext({ console: { warn() {} }, Date, api,
    RUSSIAN_MERCHANTS_KB: kb, localStorage: { getItem: () => null }, me: token ? { id: 'test-user' } : null, userCategories: [] });
  // Execute only the production parser/category functions, without app startup, DOM or network.
  vm.runInContext(section(appSource, 'const SYSTEM_EXPENSE_CATEGORIES', 'const SYSTEM_CATEGORIES') +
    'function getAllCategories(){return [...SYSTEM_EXPENSE_CATEGORIES,...SYSTEM_INCOME_CATEGORIES]};' +
    section(appSource, 'function financialAmountToCents', '// Financial Rank Calculator') +
    section(appSource, 'function normalizeCategoryToAvailable', 'let RUSSIAN_MERCHANTS_KB') +
    section(appSource, 'function isCategoryVerifiedInSystem', 'const GENERIC_TX_PLACEHOLDERS'), ctx);
  return ctx;
}
function server(extra = {}) {
  const handlers = {};
  const ctx = vm.createContext({ console: { warn() {} }, Date, AbortSignal,
    RUSSIAN_MERCHANTS_KB: kb, GEMINI_API_KEYS: [], GEMINI_MODELS: [],
    auth() {}, aiLimiter() {}, fail: (res, err) => res.status(500).json({ error: err.message }),
    app: {
      post: (path, ...args) => { handlers[path] = args.at(-1); },
      put: (path, ...args) => { handlers[path] = args.at(-1); }
    }, ...extra });
  vm.runInContext(section(serverSource, 'function merchantTermMatches', 'async function parseBankStatementWithGemini') +
    section(serverSource, 'app.post("/api/ai/categorize-batch"', 'app.put("/api/transactions/:id"') +
    section(serverSource, 'app.post("/api/transactions"', 'function merchantTermMatches') +
    section(serverSource, 'app.put("/api/transactions/:id"', 'app.post("/api/budgets"'), ctx);
  return { ctx, handlers };
}

function authServer(user) {
  const handlers = {};
  const calls = [];
  const ctx = vm.createContext({
    console: { warn() {}, error() {} },
    app: {
      post: (path, ...args) => { handlers[`POST ${path}`] = args.at(-1); },
      get: (path, ...args) => { handlers[`GET ${path}`] = args.at(-1); }
    },
    authLimiter() {}, auth() {}, cookie: { httpOnly: true }, JWT_SECRET: 'test-jwt-secret',
    bcrypt: { compare: async () => true, hash: async () => 'hash' },
    jwt: { sign: payload => `signed:${payload.purpose || 'session'}`, verify: () => ({}) },
    token: () => 'session-token', consumeTwoFactorCode: async () => true,
    crypto, Buffer,
    db: {
      query: async (sql, args) => {
        calls.push({ sql, args });
        if (sql.includes('insert into users')) return { rows: [{ id: 'u1', email: args[0] }], rowCount: 1 };
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
    },
    fail: (res, err) => res.status(500).json({ error: err.message })
  });
  vm.runInContext(section(serverSource, 'app.post("/api/auth/register"', '// CURRENCY EXCHANGE RATES'), ctx);
  return { handlers, calls };
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const authResponse = () => ({
  code: 200,
  cookies: [],
  status(code) { this.code = code; return this; },
  cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
  clearCookie() { return this; },
  json(body) { this.body = body; return this; }
});

test('2FA: RFC TOTP vector, encrypted secret and recovery codes', () => {
  const ctx = vm.createContext({ crypto, Buffer, process: { env: {} }, JWT_SECRET: 'test-jwt-secret' });
  vm.runInContext(section(serverSource, 'const BASE32_ALPHABET', '// Central Moscow Time'), ctx);
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(ctx.generateTotp(rfcSecret, 59000), '287082');
  assert.equal(ctx.findValidTotpStep(rfcSecret, '287082', 59000, 0), 1);
  assert.equal(ctx.findValidTotpStep(rfcSecret, '000000', 59000, 0), null);

  const encrypted = ctx.encryptTwoFactorSecret(rfcSecret);
  assert.ok(!encrypted.includes(rfcSecret));
  assert.equal(ctx.decryptTwoFactorSecret(encrypted), rfcSecret);

  const codes = ctx.generateRecoveryCodes(8);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const code of codes) assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(ctx.hashRecoveryCode(codes[0]), ctx.hashRecoveryCode(codes[0].toLowerCase()));
});

test('auth: 2FA gates session creation and successful login returns cookie only', async () => {
  const protectedUser = {
    id: 'u1', email: 'user@example.ru', password_hash: 'hash',
    two_factor_enabled: true, two_factor_secret: 'encrypted',
    two_factor_recovery_hashes: [], two_factor_last_used_step: -1
  };
  const protectedAuth = authServer(protectedUser);
  const challengeResponse = authResponse();
  await protectedAuth.handlers['POST /api/auth/login']({ body: { email: protectedUser.email, password: 'long-password' } }, challengeResponse);
  assert.equal(challengeResponse.body.requires_2fa, true);
  assert.equal(challengeResponse.cookies.length, 0);
  assert.ok(challengeResponse.body.challenge.startsWith('signed:2fa-login'));

  const openAuth = authServer({ ...protectedUser, two_factor_enabled: false, two_factor_secret: null });
  const loginResponse = authResponse();
  await openAuth.handlers['POST /api/auth/login']({ body: { email: protectedUser.email, password: 'long-password' } }, loginResponse);
  assert.equal(loginResponse.cookies[0].name, 'finkaif_token');
  assert.equal(loginResponse.body.user.email, protectedUser.email);
  assert.equal(Object.hasOwn(loginResponse.body, 'token'), false);
});

test('auth: registration enforces a long password and never exposes the session token', async () => {
  const auth = authServer(null);
  const weak = authResponse();
  await auth.handlers['POST /api/auth/register']({ body: { email: 'new@example.ru', password: 'short' } }, weak);
  assert.equal(weak.code, 400);

  const strong = authResponse();
  await auth.handlers['POST /api/auth/register']({ body: { email: 'new@example.ru', password: 'long-password' } }, strong);
  assert.equal(strong.cookies[0].name, 'finkaif_token');
  assert.equal(Object.hasOwn(strong.body, 'token'), false);
});

test('money: locales, Unicode minus, parentheses, invalid input, server/client parity', () => {
  const c = client(), s = server().ctx;
  for (const [raw, expected] of [['1 234,56',1234.56], ['1,234.56',1234.56], ['1.234,56',1234.56], ['−1234,56',-1234.56], ['(1 234,56)',-1234.56], ['1\u202f234,50 ₽',1234.5], ['0,01',.01]]) {
    assert.equal(c.parseBankAmount(raw), expected);
    assert.equal(s.parseBankAmount(raw), expected);
  }
  for (const raw of ['abc', '12,34,56', '1234.5678', 'Infinity', NaN]) assert.throws(() => c.parseBankAmount(raw));
  for (let cents = 1; cents < 100000; cents += 17) {
    const raw = `${Math.floor(cents/100)},${String(cents%100).padStart(2,'0')}`;
    assert.equal(Math.round(c.parseBankAmount(raw)*100), cents);
  }
});

test('dates: no invented date, leap years and invalid calendar days', () => {
  const c = client();
  assert.equal(c.parseBankDate('29.02.2024'), '2024-02-29');
  assert.equal(c.parseBankDate('2026-09-19T12:30:00'), '2026-09-19');
  for (const raw of ['', 'неизвестно', '31.02.2026', '29.02.2025', '31/04/2026']) assert.throws(() => c.parseBankDate(raw));
});

test('ledger reconciliation requires the imported multiplicity to be newly present', () => {
  const c = client();
  const row = {type:'expense',amount:250.5,occurred_on:'2026-09-19',description:'Кофе'};
  assert.equal(c.didLedgerGainTransactions([row], [row], [row]), false);
  assert.equal(c.didLedgerGainTransactions([row], [row, {...row}], [row]), true);
  assert.equal(c.didLedgerGainTransactions([], [row], [row, {...row}]), false);
});

test('capital contract: total includes goals while free capital subtracts allocated savings', () => {
  const c = client();
  for (let i = 1; i <= 250; i++) {
    const incomeCents = i * 9973;
    const expenseCents = i * 3187;
    const goalCents = i * 1129;
    const snapshot = c.getCapitalSnapshot([
      {type:'income', amount:incomeCents / 100},
      {type:'expense', amount:expenseCents / 100},
      {type:'transfer', amount:(i * 500) / 100}
    ], [{saved_amount:goalCents / 100}]);
    assert.equal(Math.round(snapshot.totalCapital * 100), incomeCents - expenseCents);
    assert.equal(Math.round(snapshot.savedInGoals * 100), goalCents);
    assert.equal(Math.round(snapshot.freeCapital * 100), incomeCents - expenseCents - goalCents);
  }
});

test('short merchant keywords cannot match part of a surname, in both engines', () => {
  for (const c of [client(), server().ctx]) {
    assert.equal(c.analyzeRussianMerchant('ИП Тестов',450).needs_confirmation, true);
    assert.equal(c.analyzeRussianMerchant('ИП Тестов',450).category, 'Прочее');
    assert.equal(c.analyzeRussianMerchant('СТО ремонт',450).category, 'Транспорт');
  }
});

test('confident categories and bank descriptions survive enrichment', async () => {
  const c = client();
  const rows = [{type:'income',category:'Дивиденды',description:'Проценты по вкладу',amount:1000,confidence:.98,needs_confirmation:false}];
  await c.enrichTransactionsWithMerchantIntelligence(rows);
  assert.equal(rows[0].category, 'Дивиденды');
  assert.equal(rows[0].raw_description, 'Проценты по вкладу');
});

test('batch server retains non-contiguous indexes; client applies only requested results', async () => {
  const s = server();
  const c = client(async (_, options) => {
    const res = response();
    await s.handlers['/api/ai/categorize-batch']({body:JSON.parse(options.body)},res);
    assert.equal(res.body.results[0].index,1);
    res.body.results.push({index:0,category:'Кафе',confidence:1}); // unsolicited response is ignored
    return res.body;
  }, 'test-token');
  const rows = [{type:'expense',amount:65,description:'Мосметро'}, {type:'expense',amount:450,description:'ИП Тестов'}];
  await c.enrichTransactionsWithMerchantIntelligence(rows);
  assert.equal(rows[0].category,'Транспорт');
  assert.equal(rows[0].description,'Мосметро');
  assert.equal(rows[1].needs_confirmation,true);
});

test('AI confirmation flag remains true even with a high confidence number', async () => {
  const c = client(async () => ({ok:true,results:[{index:0,category:'Кафе',confidence:.99,needs_confirmation:true}]}),'test');
  const rows=[{type:'expense',amount:450,description:'ИП Абырвалг'}];
  await c.enrichTransactionsWithMerchantIntelligence(rows);
  assert.equal(rows[0].needs_confirmation,true);
});

test('CSV separate debit/credit columns, decimal commas and invalid rows', () => {
  const c=client();
  const rows=c.parseStatementBuiltin('Дата;Описание;Приход;Расход\n19.09.2026;Зарплата;10000;0\n19.09.2026;Кофе;0;250,50');
  assert.equal(rows.length,2); assert.equal(rows[0].type,'income'); assert.equal(rows[1].type,'expense'); assert.equal(rows[1].amount,250.5);
  assert.throws(()=>c.parseStatementBuiltin('Дата;Описание;Сумма\n31.02.2026;Кофе;-250'));
});

test('1C: incoming/outgoing direction follows account ownership', () => {
  const c=client();
  const text='1CClientBankExchange\nРасчСчет=123\nСекцияДокумент=Платежное поручение\nДата=19.09.2026\nСумма=150,25\nПлательщикСчет=456\nПолучательСчет=123\nНазначениеПлатежа=Оплата услуг';
  assert.equal(c.parseStatementBuiltin(text)[0].type,'income');
});

test('own transfer preserved through AI parse and categorization', async () => {
  const c=client(async()=>({success:true,transactions:[{date:'2026-09-19',amount:5000,type:'transfer',is_self_transfer:true,category:'Переводы',description:'Мой счет'}]}));
  const {transactions}=await c.parseBankStatement('', 'test.pdf','auto','fake-pdf');
  await c.enrichTransactionsWithMerchantIntelligence(transactions);
  assert.equal(transactions[0].type,'transfer');
  assert.equal(transactions[0].needs_confirmation,true);
  assert.equal(transactions[0].transfer_confirmed,false);
  assert.throws(()=>c.normalizeStatementRow({date:'2026-09-19',amount:5,type:'transfer',is_self_transfer:false}));
});

test('AI classifies all 81 ambiguous records in bounded chunks', async () => {
  const batches=[];
  const s=server({GEMINI_API_KEYS:['test'],callGeminiBatchCategorizer:async(key,prompt,body)=>{
    const rows=JSON.parse(body);batches.push(rows.length);
    return JSON.stringify(rows.map(t=>({index:t.index,category:'Кафе',confidence:.5,needs_confirmation:true})));
  }});
  const res=response();
  await s.handlers['/api/ai/categorize-batch']({body:{transactions:Array.from({length:81},(_,i)=>({index:i*2,description:'ИП Абырвалг',amount:450,type:'expense'}))}},res);
  assert.deepEqual(batches,[40,40,1]); assert.equal(res.body.results[80].index,160);
});

test('bulk: rejects malformed rows before writes; all inserts commit together', async () => {
  const queries=[];let released=false;
  const connection={query:async(sql,params)=>{queries.push(sql);return {rows:params?[{type:params[1]}]:[]};},release(){released=true;}};
  const s=server({db:{connect:async()=>connection}});
  const handler=s.handlers['/api/transactions/bulk'];
  const row={type:'transfer',amount:5000,category:'Переводы',occurred_on:'2026-09-19'};
  const unconfirmed=response();await handler({user:{id:'test'},body:{transactions:[row]}},unconfirmed);
  assert.equal(unconfirmed.code,400);assert.equal(queries.length,0);
  const bad=response();await handler({user:{id:'test'},body:{transactions:[row,{...row,occurred_on:'31.02.2026'}]}},bad);
  assert.equal(bad.code,400);assert.equal(queries.length,0);
  const good=response();await handler({user:{id:'test'},body:{transactions:[{...row,transfer_confirmed:true}]}},good);
  assert.equal(queries[0],'BEGIN');assert.equal(queries.at(-1),'COMMIT');assert.equal(good.body.rows[0].type,'transfer');assert.ok(released);
});

test('single transfer API rejects missing approval and accepts explicit approval', async () => {
  const queries=[];
  const s=server({db:{query:async(sql,params)=>{queries.push({sql,params});return {rows:[{type:params[1]}]};}}});
  const handler=s.handlers['/api/transactions'];
  const base={type:'transfer',amount:1500,category:'Переводы',occurred_on:'2026-09-20'};
  const rejected=response();await handler({user:{id:'test'},body:base},rejected);
  assert.equal(rejected.code,400);assert.equal(queries.length,0);
  const accepted=response();await handler({user:{id:'test'},body:{...base,transfer_confirmed:true}},accepted);
  assert.equal(accepted.code,200);assert.equal(accepted.body.type,'transfer');assert.equal(queries.length,1);
});

test('transfer update API also requires explicit approval', async () => {
  const queries=[];
  const s=server({db:{query:async(sql,params)=>{queries.push({sql,params});return {rows:[{type:params[0]}]};}}});
  const handler=s.handlers['/api/transactions/:id'];
  const base={type:'transfer',amount:1500,category:'Переводы',occurred_on:'2026-09-20'};
  const rejected=response();await handler({params:{id:'tx-1'},user:{id:'test'},body:base},rejected);
  assert.equal(rejected.code,400);assert.equal(queries.length,0);
  const accepted=response();await handler({params:{id:'tx-1'},user:{id:'test'},body:{...base,transfer_confirmed:true}},accepted);
  assert.equal(accepted.code,200);assert.equal(accepted.body.type,'transfer');assert.equal(queries.length,1);
});

test('bulk failure rolls back and releases connection', async () => {
  const queries=[];let released=false;
  const s=server({db:{connect:async()=>({query:async(sql)=>{queries.push(sql);if(sql.startsWith('insert'))throw Error('db unavailable');},release(){released=true;}})}});
  const res=response();await s.handlers['/api/transactions/bulk']({user:{id:'test'},body:{transactions:[{type:'expense',amount:1,category:'Кафе',occurred_on:'2026-09-19'}]}},res);
  assert.equal(res.code,500);assert.equal(queries.at(-1),'ROLLBACK');assert.ok(released);assert.ok(!queries.includes('COMMIT'));
});
