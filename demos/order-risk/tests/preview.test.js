import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext, runInContext, createContext, Script } from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const html = readFileSync(resolve(root, '订单风险-本地预览.html'), 'utf8');
const code = html.match(/<script>\n([\s\S]*)\n<\/script>/)?.[1];

test('single-file preview loads and supports review, selection, and apply', () => {
  assert.ok(code);
  const elements = { app: { innerHTML: '', addEventListener() {} }, live: { textContent: '' }, 'reset-top': { addEventListener() {} } };
  const context = createContext({ document: { getElementById: id => elements[id] || null, activeElement: null }, window: { location: { search: '?scene=change-add-a0412' }, scrollY: 0, scrollTo() {} }, URLSearchParams, console });
  new Script(code).runInContext(context);
  assert.match(elements.app.innerHTML, /订单变化场景/);
  assert.match(elements.app.innerHTML, /晚 3 天/);
  assert.match(elements.app.innerHTML, /strategy-partial/);
  runInContext('dispatch({ type: "set-form", patch: { qty: "3000" } })', context);
  assert.match(elements.app.innerHTML, /请先重新评估/);
  runInContext('dispatch({ type: "apply" })', context);
  assert.equal(runInContext('state.applied', context), null);
  runInContext('dispatch({ type: "evaluate" }); dispatch({ type: "set-strategy", strategy: "partial" }); dispatch({ type: "apply" })', context);
  assert.equal(runInContext('state.applied.qty', context), 3000);
  assert.equal(runInContext('state.applied.strategy', context), 'partial');
  runInContext('dispatch({ type: "undo" }); dispatch({ type: "reset" })', context);
  assert.equal(runInContext('state.form.qty', context), '6000');
  assert.equal(runInContext('state.applied', context), null);
});
