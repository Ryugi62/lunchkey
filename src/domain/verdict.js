/** @typedef {'contains'|'clear'|'unlabeled'} Verdict */

/**
 * Judge one dish for one child.
 * contains  = a printed code matches the child's allergens (always wins)
 * clear     = codes were printed and none match
 * unlabeled = no codes printed, or a code we could not read — we cannot say it is clear
 * @param {import('./menu.js').DishLine} dish
 * @param {Set<number>} avoid
 * @returns {{verdict: Verdict, matched: number[]}}
 */
export function judgeDish(dish, avoid) {
  const matched = dish.codes.filter((c) => avoid.has(c));
  if (matched.length) return { verdict: 'contains', matched };
  if (dish.parseStatus === 'coded') return { verdict: 'clear', matched: [] };
  return { verdict: 'unlabeled', matched: [] };
}
