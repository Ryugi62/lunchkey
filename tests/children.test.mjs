import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIncoming } from '../src/application/children.js';

const A = { allergens: [2], lang: 'vi', name: 'Linh', school: { office: 'S10', code: '9022479', name: '의창초' } };
const schoolB = { office: 'S10', code: '9010047', name: '마산고' };

test('family link for a second child adds a child, keeps the first', () => {
  const r = mergeIncoming([A], 0, { allergens: [4], lang: 'en', name: '', school: schoolB }, 'en');
  assert.equal(r.children.length, 2); assert.equal(r.active, 1); assert.equal(r.children[0].name, 'Linh'); assert.equal(r.children[1].lang, 'vi');
});
test('opening the same family link again just selects that child', () => {
  const r = mergeIncoming([A], 0, { ...A, name: '' }, 'en');
  assert.equal(r.children.length, 1); assert.equal(r.active, 0);
});
test('a school link for a different school starts a new child instead of overwriting', () => {
  const r = mergeIncoming([A], 0, { allergens: [], lang: 'en', name: '', school: schoolB }, 'en');
  assert.equal(r.children.length, 2); assert.equal(r.children[0].school.code, '9022479'); assert.deepEqual(r.children[1].allergens, []);
});
test('a school link on a fresh phone uses the parent\'s language, not the sender\'s', () => {
  const r = mergeIncoming([], 0, { allergens: [], lang: 'ko', name: '', school: schoolB }, 'vi');
  assert.equal(r.children[0].lang, 'vi');
});
