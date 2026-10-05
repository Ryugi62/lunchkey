import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T, LANG_NAMES } from '../src/ui/i18n.js';
import { ALLERGENS } from '../src/domain/allergens.js';
import { UI_LANGS } from '../src/adapters/profileStore.js';

test('every UI language has every string', () => {
  const keys = Object.keys(T.en).sort();
  for (const lang of UI_LANGS) {
    assert.ok(T[lang], lang);
    assert.deepEqual(Object.keys(T[lang]).sort(), keys, lang);
    assert.equal(T[lang].days.length, 5, lang);
    assert.ok(LANG_NAMES[lang], lang);
  }
});

test('every allergen is named in every UI language', () => {
  for (const a of ALLERGENS) for (const lang of UI_LANGS) assert.ok(a.names[lang], `${a.id} ${lang}`);
});
