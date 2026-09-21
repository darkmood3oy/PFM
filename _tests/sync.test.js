// End-to-end sync client test against a mocked Supabase server.
// Exercises: passphrase prompt -> sign-in -> encrypted push -> pull -> decrypt -> replace.
// Run with:  node _tests/sync.test.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let src = html.match(/<script>([\s\S]*)<\/script>/)[1];

// Expose internals to the test, and run init() immediately (no DOMContentLoaded in node).
src = src.replace(
  "document.addEventListener('DOMContentLoaded', init);",
  "globalThis.__test={encryptJSON,decryptJSON,isEnvelope,getState:()=>state,setSessionPass:p=>{sessionPass=p},ITERATIONS};init();"
);

const els = new Map();
function stubEl(id) { const el = { id, className:'', textContent:'', innerHTML:'', value:'', checked:false, disabled:false, onclick:null, onchange:null, oninput:null, title:'', classList:{add(){},remove(){},toggle(){}}, appendChild(){},removeChild(){},click(){},focus(){}, files:[] }; els.set(id,el); return el; }
const byId = id => { if(!els.has(id)) els.set(id, stubEl(id)); return els.get(id); };
const tabs = [];
globalThis.document = {
  querySelector: s => { const id=(s.match(/^#(.+)/)||[])[1]; return byId(id||'__x'); },
  querySelectorAll: s => s==='.tab' ? tabs : [],
  addEventListener(){}, removeEventListener(){},
  body: byId('__body'), createElement: () => stubEl('__c'+(els.size)),
};
globalThis.localStorage = { _d:{}, getItem:k=>globalThis.localStorage._d[k]||null, setItem:(k,v)=>{globalThis.localStorage._d[k]=String(v);}, removeItem:k=>{delete globalThis.localStorage._d[k];} };
globalThis.confirm = () => true;
globalThis.alert = () => {};
globalThis.navigator = { serviceWorker:{ register: () => new Promise(()=>{}) } };
globalThis.window = { scrollTo(){}, addEventListener(){} };
for (let i=0;i<10;i++) tabs.push({ dataset:{ view:['dashboard','income','expenses','accounts','reports','data'][i%6] }, classList:{ toggle(){} } });

// ---- mocked Supabase ----
const server = { rows: [], lastBody: null, signIns: 0 };
function jsonResp(obj, status){
  return Promise.resolve({ ok: status ? status<400 : obj!==null, status: status||200,
    text: () => Promise.resolve(obj===null ? '' : (typeof obj==='string' ? obj : JSON.stringify(obj))),
    json: () => Promise.resolve(obj) });
}
globalThis.fetch = (url, opts) => {
  const u = String(url), method = (opts&&opts.method)||'GET';
  if (u.includes('/auth/v1/token')) { server.signIns++; return jsonResp({ access_token:'tok-1', refresh_token:'ref-1', expires_in:3600, user:{ id:'user-123' } }); }
  if (u.includes('/rest/v1/finance_sync') && method==='GET') return jsonResp(server.rows);
  if (u.includes('/rest/v1/finance_sync') && method==='POST') { server.lastBody = JSON.parse(opts.body); return jsonResp(null, 201); }
  return jsonResp({ message:'not found' }, 404);
};

let passed=0, failed=0;
function ok(c,n){ if(c){passed++;console.log('  PASS  '+n);} else {failed++;console.error('  FAIL  '+n);} }
function waitFor(cond, timeout=4000){ const t0=Date.now(); return new Promise((res,rej)=>{ const chk=()=>{ if(cond()) res(); else if(Date.now()-t0>timeout) rej(new Error('timeout')); else setTimeout(chk,15); }; chk(); }); }

try { eval(src); } catch(e){ console.error('FATAL eval: '+e.message); process.exit(1); }
const T = globalThis.__test;

(async () => {
  // set a distinctive currency so we can prove round-trips
  T.getState().currency = '€';
  T.getState().incomes.push({ id:'x1', date:'2026-01-02', source:'Test Co', payType:'lump', amount:42, account:'Holding', notes:'' });

  // go to Data view
  tabs.find(t=>t.dataset.view==='data').onclick();

  // ---- configure sync ----
  byId('syncUrl').value='https://mock.supabase.co';
  byId('syncAnon').value='anon-key';
  byId('syncEmail').value='u@example.com';
  byId('syncPassword').value='pw';
  byId('btnSyncSave').onclick();
  ok(JSON.parse(globalThis.localStorage._d['finance.sync.v2']).url === 'https://mock.supabase.co', 'sync config persisted to localStorage');

  // ---- push ----
  byId('btnSyncPush').onclick();
  byId('pp1').value = 'test-pass';      // user types passphrase
  byId('ppOk').onclick();               // confirms the prompt
  await waitFor(() => server.lastBody !== null);
  ok(server.signIns >= 1, 'sign-in called');
  ok(server.lastBody.id === 'primary', 'push sends id=primary');
  ok(server.lastBody.user_id === 'user-123', 'push sends user_id from sign-in');
  const env = JSON.parse(server.lastBody.payload);
  ok(env.enc==='AES-256-GCM' && env.ct && env.salt && env.iv, 'push payload is an AES envelope');
  ok(!String(server.lastBody.payload).includes('Test Co'), 'plaintext is NOT visible in the pushed payload');
  const dec = await T.decryptJSON(env, 'test-pass');
  ok(dec.currency === '€' && dec.incomes[0].source === 'Test Co', 'pushed ciphertext decrypts to original state');

  // ---- pull back ----
  server.rows = [{ id:'primary', user_id:'user-123', payload: server.lastBody.payload, updated_at: server.lastBody.updated_at }];
  // mutate local to prove the pull replaces it
  T.getState().currency = '$';
  byId('btnSyncPull').onclick();
  await waitFor(() => T.getState().currency === '€');
  ok(T.getState().currency === '€', 'pull replaced local state with cloud copy');

  // ---- wrong passphrase on pull ----
  T.setSessionPass(null);
  server.rows[0].updated_at = new Date(Date.now()+3600000).toISOString(); // newer
  byId('btnSyncPull').onclick();
  byId('pp1').value = 'WRONG';
  byId('ppOk').onclick();
  await new Promise(r=>setTimeout(r,150));
  ok(T.getState().currency === '€', 'wrong passphrase did not corrupt local state');

  console.log('\n'+passed+' passed, '+failed+' failed');
  process.exit(failed?1:0);
})().catch(e => { console.error('UNCAUGHT: '+e.message); process.exit(1); });