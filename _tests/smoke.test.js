// DOM smoke test: renders every view and exercises the add-income flow with a stubbed DOM.
// Run with:  node _tests/smoke.test.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('script block not found'); process.exit(1); }

const els = new Map();
function stubEl(id) {
  const el = {
    id, className: '', textContent: '', innerHTML: '', value: '', checked: false, disabled: false,
    onclick: null, onchange: null, oninput: null, title: '',
    classList: { add(){}, remove(){}, toggle(){} },
    appendChild(){}, removeChild(){}, click(){}, focus(){},
    files: [],
  };
  els.set(id, el);
  return el;
}
const byId = id => {
  if (!els.has(id)) els.set(id, stubEl(id));
  return els.get(id);
};
const tabs = [];

globalThis.document = {
  querySelector: s => {
    const id = (s.match(/^#(.+)/) || [])[1];
    return byId(id || s.replace(/[^a-zA-Z0-9_-]/g, ''));
  },
  querySelectorAll: s => {
    if (s === '.tab') return tabs;
    return [];
  },
  addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') globalThis.__init = fn; },
  removeEventListener(){},
  body: byId('__body'),
  createElement: () => stubEl('__created' + (els.size)),
};
globalThis.localStorage = {
  _d: {},
  getItem: k => globalThis.localStorage._d[k] || null,
  setItem: (k, v) => { globalThis.localStorage._d[k] = String(v); },
  removeItem: k => { delete globalThis.localStorage._d[k]; },
};
globalThis.confirm = () => true;
globalThis.alert = () => {};
globalThis.navigator = { serviceWorker: { register: () => new Promise(() => {}) } };
globalThis.window = { scrollTo(){}, addEventListener(){} };
globalThis.FileReader = class {};

for (let i = 0; i < 10; i++) tabs.push({ dataset: { view: ['dashboard','income','expenses','accounts','reports','data'][i % 6] }, classList: { toggle(){} } });

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.error('  FAIL  ' + name); }
}

try {
  eval(m[1]);
} catch (e) {
  console.error('FATAL: script failed to evaluate: ' + e.message);
  process.exit(1);
}

// run init
globalThis.__init && globalThis.__init();

try {
  byId('dashAddIncome').onclick();
  ok(true, 'openIncomeModal ran without error');
  byId('iSave').onclick();
  ok(els.size > 0, 'income save wiring ran without error');
} catch (e) {
  ok(false, 'income flow: ' + e.message);
}

const viewNames = ['dashboard','income','expenses','accounts','reports','data'];
for (const v of viewNames) {
  try {
    const tab = tabs.find(t => t.dataset.view === v);
    tab.onclick();
    ok(byId('main').innerHTML.length > 0, 'view ' + v + ' renders (' + byId('main').innerHTML.length + ' chars)');
  } catch (e) {
    ok(false, 'view ' + v + ' errored: ' + e.message);
  }
}

// switch back through setView for each view again to ensure afterX wiring is idempotent on re-render
for (const v of viewNames) {
  try {
    tabs.find(t => t.dataset.view === v).onclick();
  } catch (e) {
    ok(false, 're-render ' + v + ' errored: ' + e.message);
  }
}
ok(true, 'all views re-render');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);