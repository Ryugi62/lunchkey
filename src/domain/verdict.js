/** @typedef {'contains'|'clear'|'nonumbers'|'unreadable'} Verdict */

/**
 * Judge one dish for one child.
 * contains   = a printed code matches the child's allergens (always wins)
 * unreadable = code-like text we could not read, or a number that might be one of the child's codes
 * nonumbers  = nothing code-like printed at all
 * clear      = codes were printed, read cleanly, and none match
 * Only `clear` is ever shown in green.
 * @param {import('./menu.js').DishLine} dish
 * @param {Set<number>} avoid
 * @returns {{verdict: Verdict, matched: number[]}}
 */
export function judgeDish(dish, avoid) {
  const matched = dish.codes.filter((c) => avoid.has(c));
  if (matched.length) return { verdict: 'contains', matched };
  if (dish.parseStatus === 'malformed' || (dish.ambiguousCodes ?? []).some((c) => avoid.has(c))) return { verdict: 'unreadable', matched: [] };
  if (dish.parseStatus === 'uncoded') return { verdict: 'nonumbers', matched: [] };
  return { verdict: 'clear', matched: [] };
}
