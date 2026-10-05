import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLayerViolations } from '../scripts/check-layers.mjs';

test('AC-10 domain and application never import adapters or ui', () => {
  assert.deepEqual(findLayerViolations(), []);
});
