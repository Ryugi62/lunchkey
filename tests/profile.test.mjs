import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeProfile, decodeProfile } from '../src/adapters/profileStore.js';

test('AC-9 profile round-trips through the hash', () => {
  const p = { allergens: [2, 4, 18], lang: 'vi', name: 'Linh', school: { office: 'S10', code: '9022479', name: '의창초등학교' } };
  assert.deepEqual(decodeProfile(encodeProfile(p)), p);
});

test('AC-9 garbage hash gives an empty profile', () => {
  const p = decodeProfile('#p=@@@notbase64');
  assert.deepEqual(p.allergens, []);
  assert.equal(p.lang, 'en');
});

test('out-of-range allergen ids are dropped on decode', () => {
  const h = encodeProfile({ allergens: [2, 99], lang: 'zh', name: '' });
  assert.deepEqual(decodeProfile(h).allergens, [2]);
});

test('a malformed school in the hash is dropped, the rest kept', () => {
  const h = '#p=' + Buffer.from(JSON.stringify({ a: [2], l: 'en', n: '', s: ['XX', '1', 'x'] })).toString('base64url');
  const p = decodeProfile(h);
  assert.equal(p.school, null);
  assert.deepEqual(p.allergens, [2]);
});
