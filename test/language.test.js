import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../public/language.js', import.meta.url), 'utf8');
function visit(languages, stored, blocked = false) {
  const storage = { value: stored };
  const context = { navigator: { languages }, document: { documentElement: {} }, window: {}, localStorage: {
    getItem() { if (blocked) throw new Error('blocked'); return storage.value; },
    setItem(key, value) { if (blocked) throw new Error('blocked'); storage.value = value; }
  }};
  vm.runInNewContext(code, context);
  return { ...context, storage };
}
test('browser languages choose first supported preference and fall back to English', () => {
  for (const [languages, expected] of [[['es-ES','en-US'],'es'], [['en-US','es-CL'],'en'], [['fr-FR','es-MX'],'es'], [['de-DE'],'en']]) {
    const page = visit(languages);
    assert.equal(page.window.AltumLanguage.get(), expected);
    assert.equal(page.document.documentElement.lang, expected);
  }
});
test('manual choice persists and overrides browser preference on another visit', () => {
  const first = visit(['es-ES']); first.window.AltumLanguage.set('en');
  assert.equal(first.storage.value, 'en');
  assert.equal(visit(['es-ES'], first.storage.value).window.AltumLanguage.get(), 'en');
  first.window.AltumLanguage.set('es');
  assert.equal(visit(['en-US'], first.storage.value).window.AltumLanguage.get(), 'es');
  first.window.AltumLanguage.set('fr'); assert.equal(first.storage.value, 'es');
});
test('invalid saved choice and unavailable storage do not break language switching', () => {
  assert.equal(visit(['es-ES'], 'fr').window.AltumLanguage.get(), 'es');
  const page = visit(['es-ES'], undefined, true);
  page.window.AltumLanguage.set('en');
  assert.equal(page.window.AltumLanguage.get(), 'en');
  assert.equal(page.document.documentElement.lang, 'en');
});
