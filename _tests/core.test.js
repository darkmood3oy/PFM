// Unit tests for the pure core of index.html (state, migrate, crypto).
// Run with:  node _tests/core.test.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\*==TESTABLE==start==\*\/([\s\S]*?)\/\*==TESTABLE==end==\*\//);
if (!m) { console.error('TESTABLE anchor block not found'); process.exit(1); }

// Evaluate the pure core in this scope so the functions are defined here.
eval(m[1]);

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.error('  FAIL  ' + name); }
}

(async () => {
  // --- defaultState / migrate ---
  const d = defaultState();
  ok(d.version === 2, 'defaultState has version 2');
  ok(Array.isArray(d.settings.accounts) && d.settings.accounts.length === 3, 'default accounts present');
  ok(Array.isArray(d.incomes) && Array.isArray(d.expenses) && Array.isArray(d.transfers), 'arrays initialised');

  const legacy = { version: 1, currency: '$', incomes: [{ id: 'a', amount: 10 }], openingBalances: { Holding: 0 } };
  const mig = migrate(legacy);
  ok(mig.currency === '$', 'migrate keeps currency');
  ok(mig.incomes.length === 1, 'migrate keeps incomes');
  ok(mig.transfers.length === 0, 'migrate fills missing arrays');
  ok(mig.settings.accounts.length === 3, 'migrate fills missing settings');
  ok(migrate(null).version === 2, 'migrate null -> default');
  ok(migrate('garbage').version === 2, 'migrate non-object -> default');

  // --- b64 roundtrip ---
  const bytes = new Uint8Array([0, 1, 2, 250, 255]);
  ok(b64dec(b64enc(bytes)).length === bytes.length, 'b64 roundtrip length');
  ok(b64dec(b64enc(bytes))[3] === 250, 'b64 roundtrip value');

  // --- crypto roundtrip ---
  const payload = { version: 2, currency: '£', incomes: [{ id: 'x1', amount: 12.5, date: '2026-01-01' }], expenses: [], transfers: [], settings: { accounts: ['a'] } };
  const env = await encryptJSON(payload, 'correct horse battery staple');
  ok(env.enc === 'AES-256-GCM' && env.iv && env.salt && env.ct, 'envelope fields present');
  ok(env.iter === 200000, 'envelope records iterations');
  ok(isEnvelope(env) === true, 'isEnvelope detects envelope');
  ok(isEnvelope({ enc: 'AES-256-GCM', ct: 'AAA', salt: 'BBB', iv: 'CCC' }) === true, 'isEnvelope true for minimal');
  ok(isEnvelope(payload) === false, 'isEnvelope false for plain object');

  const back = await decryptJSON(env, 'correct horse battery staple');
  ok(JSON.stringify(back) === JSON.stringify(payload), 'crypto roundtrip matches exactly');
  ok(back.currency === '£' && back.incomes[0].amount === 12.5, 'decrypted values intact');

  // wrong passphrase must fail
  let threw = false;
  try { await decryptJSON(env, 'wrong passphrase'); } catch (e) { threw = true; }
  ok(threw, 'wrong passphrase throws');

  // tampered ciphertext must fail
  const tampered = JSON.parse(JSON.stringify(env));
  let raw = atob(tampered.ct);
  raw = raw.slice(0, raw.length - 1) + (raw.endsWith('A') ? 'B' : 'A');
  tampered.ct = btoa(raw);
  threw = false;
  try { await decryptJSON(tampered, 'correct horse battery staple'); } catch (e) { threw = true; }
  ok(threw, 'tampered ciphertext throws');

  // forward compatibility: an envelope made with MORE iterations (e.g. a newer
  // app version) must still decrypt because decryptJSON uses env.iter.
  const saltBig = crypto.getRandomValues(new Uint8Array(16));
  const ivBig   = crypto.getRandomValues(new Uint8Array(12));
  const bitsBig = await deriveKey('pw', b64enc(saltBig), 300000);
  const aesBig  = await crypto.subtle.importKey('raw', bitsBig, 'AES-GCM', false, ['encrypt']);
  const ctBig   = await crypto.subtle.encrypt({name:'AES-GCM', iv:ivBig}, aesBig, new TextEncoder().encode(JSON.stringify(payload)));
  const envBig  = {enc:'AES-256-GCM', v:1, iter:300000, salt:b64enc(saltBig), iv:b64enc(ivBig), ct:b64enc(ctBig)};
  const backBig = await decryptJSON(envBig, 'pw');
  ok(JSON.stringify(backBig) === JSON.stringify(payload), 'decrypt honours envelope.iter (forward compat)');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();