import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glossDish } from '../src/domain/gloss.js';
import { romanize } from '../src/domain/romanize.js';

test('AC-7 compound dish is glossed from parts', () => {
  const g = glossDish('돼지고기김치찌개', 'en');
  assert.match(g.text.toLowerCase(), /pork/);
  assert.match(g.text.toLowerCase(), /kimchi/);
  assert.match(g.text.toLowerCase(), /stew/);
  assert.equal(g.coverage, 1);
  assert.equal(g.status, 'full');
});

test('AC-7 unknown name falls back to romanization, marked not translated', () => {
  const g = glossDish('뀨뀨뀨', 'en');
  assert.equal(g.status, 'none');
  assert.equal(g.text, romanize('뀨뀨뀨'));
});

test('partial gloss keeps the unknown part romanized', () => {
  const g = glossDish('뀨뀨볶음밥', 'en');
  assert.equal(g.status, 'partial');
  assert.match(g.text.toLowerCase(), /fried rice/);
  assert.ok(g.coverage > 0 && g.coverage < 1);
});

test('vietnamese and chinese glosses exist for core words', () => {
  assert.match(glossDish('배추김치', 'vi').text.toLowerCase(), /kim chi/);
  assert.match(glossDish('쌀밥', 'zh').text, /米饭/);
});

test('unsupported dish-gloss language falls back to English', () => {
  assert.equal(glossDish('쌀밥', 'ru').text, glossDish('쌀밥', 'en').text);
});

test('romanize follows Revised Romanization basics', () => {
  assert.equal(romanize('김치'), 'gimchi');
  assert.equal(romanize('밥'), 'bap');
  assert.equal(romanize('불고기'), 'bulgogi');
});

test('hand-check findings: mis-segmentations fixed', () => {
  const en = (k) => glossDish(k, 'en').text;
  assert.equal(en('과일화채'), 'fruit punch');
  assert.match(en('중국식볶음밥'), /^Chinese-style fried rice$/);
  assert.match(en('무지개별떡국'), /^rainbow/);
  assert.match(en('맛있는 쌀밥'), /^tasty rice$/);
  assert.match(en('조갯살아욱된장국'), /^clam meat mallow/);
});
