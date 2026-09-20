import { readFileSync } from 'node:fs';
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
    RUSSIAN_MERCHANTS_KB: kb, localStorage: { getItem: () => token }, userCategories: [] });
  // Execute only the production parser/category functions, without app startup, DOM or network.
  vm.runInContext(section(appSource, 'const SYSTEM_EXPENSE_CATEGORIES', 'const SYSTEM_CATEGORIES') +
    'function getAllCategories(){return [...SYSTEM_EXPENSE_CATEGORIES,...SYSTEM_INCOME_CATEGORIES]};' +
    section(appSource, 'function normalizeCategoryToAvailable', 'let RUSSIAN_MERCHANTS_KB') +
    section(appSource, 'function isCategoryVerifiedInSystem', 'const GENERIC_TX_PLACEHOLDERS'), ctx);
  return ctx;
}
function server(extra = {}) {
  const handlers = {};
  const ctx = vm.createContext({ console: { warn() {} }, Date, AbortSignal,
    RUSSIAN_MERCHANTS_KB: kb, GEMINI_API_KEYS: [], GEMINI_MODELS: [],
    auth() {}, aiLimiter() {}, fail: (res, err) => res.status(500).json({ error: err.message }),
    app: { post: (path, ...args) => { handlers[path] = args.at(-1); } }, ...extra });
  vm.runInContext(section(serverSource, 'function merchantTermMatches', 'async function parseBankStatementWithGemini') +
    section(serverSource, 'app.post("/api/ai/categorize-batch"', 'app.put("/api/transactions/:id"') +
    section(serverSource, 'app.post("/api/transactions/bulk"', 'function merchantTermMatches'), ctx);
  return { ctx, handlers };
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

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
  assert.equal(transactions[0].type,'transfer'); assert.equal(transactions[0].needs_confirmation,false);
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
  const bad=response();await handler({user:{id:'test'},body:{transactions:[row,{...row,occurred_on:'31.02.2026'}]}},bad);
  assert.equal(bad.code,400);assert.equal(queries.length,0);
  const good=response();await handler({user:{id:'test'},body:{transactions:[row]}},good);
  assert.equal(queries[0],'BEGIN');assert.equal(queries.at(-1),'COMMIT');assert.equal(good.body.rows[0].type,'transfer');assert.ok(released);
});

test('bulk failure rolls back and releases connection', async () => {
  const queries=[];let released=false;
  const s=server({db:{connect:async()=>({query:async(sql)=>{queries.push(sql);if(sql.startsWith('insert'))throw Error('db unavailable');},release(){released=true;}})}});
  const res=response();await s.handlers['/api/transactions/bulk']({user:{id:'test'},body:{transactions:[{type:'expense',amount:1,category:'Кафе',occurred_on:'2026-09-19'}]}},res);
  assert.equal(res.code,500);assert.equal(queries.at(-1),'ROLLBACK');assert.ok(released);assert.ok(!queries.includes('COMMIT'));
});
