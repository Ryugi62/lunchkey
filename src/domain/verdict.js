import { nameHints } from './hints.js';

/** @typedef {'contains'|'clear'|'nonumbers'|'unreadable'} Verdict */

/**
 * Judge one dish for one child.
 * contains   = a printed code matches the child's allergens (always wins)
 * unreadable = code-like text we could not read, a number that might be one of the child's codes,
 *              or a dish name that suggests one of the child's allergens the numbers don't show
 * nonumbers  = nothing code-like printed at all
 * clear      = codes were printed, read cleanly, and none match
 * Only `clear` is ever shown in green.
 * @param {import('./menu.js').DishLine} dish
 * @param {Set<number>} avoid
 * @returns {{verdict: Verdict, matched: number[], maybe: number[], reason: 'code'|'number'|'name'|'malformed'|'none'}}
 */
export function judgeDish(dish, avoid) {
  const matched = dish.codes.filter((c) => avoid.has(c));
  if (matched.length) return { verdict: 'contains', matched, maybe: [], reason: 'code' };
  const byNumber = (dish.ambiguousCodes ?? []).filter((c) => avoid.has(c));
  const byName = nameHints(dish.nameKo).filter((c) => avoid.has(c) && !dish.codes.includes(c));
  if (byNumber.length) return { verdict: 'unreadable', matched: [], maybe: byNumber, reason: 'number' };
  if (byName.length) return { verdict: 'unreadable', matched: [], maybe: byName, reason: 'name' };
  if (dish.parseStatus === 'malformed') return { verdict: 'unreadable', matched: [], maybe: [], reason: 'malformed' };
  if (dish.parseStatus === 'uncoded') return { verdict: 'nonumbers', matched: [], maybe: [], reason: 'none' };
  return { verdict: 'clear', matched: [], maybe: [], reason: 'code' };
}
