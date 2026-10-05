// Words in a Korean dish name that point to one of the 19 numbered allergens.
// Used only to ADD warnings: if the name suggests an allergen the printed numbers don't show, the dish is never "clear".
const WORDS = [
  [2, ['우유', '치즈', '요구르트', '요거트', '버터', '크림', '요플레', '밀크', '라떼']],
  [1, ['계란', '달걀', '메추리알', '에그', '마요']],
  [3, ['메밀', '모밀']],
  [4, ['땅콩']],
  [5, ['두부', '두유', '된장', '간장', '콩']],
  [6, ['밀가루', '빵', '국수', '라면', '우동', '파스타', '스파게티', '만두', '피자', '돈까스', '돈가스', '까스']],
  [7, ['고등어']],
  [8, ['꽃게', '게맛살', '크래미', '대게']],
  [9, ['새우']],
  [10, ['돼지', '돈육', '제육', '삼겹', '목살', '햄', '소시지', '소세지', '베이컨', '스팸', '돈까스', '돈가스']],
  [11, ['복숭아']],
  [12, ['토마토', '케첩', '케찹']],
  [14, ['호두']],
  [15, ['닭', '치킨', '너겟']],
  [16, ['쇠고기', '소고기', '한우', '불고기', '우삼겹']],
  [17, ['오징어']],
  [18, ['조개', '바지락', '홍합', '전복', '꼬막', '굴소스']],
  [19, ['잣']],
];

/** @param {string} nameKo @returns {number[]} allergen ids the name suggests */
export function nameHints(nameKo) {
  const name = String(nameKo ?? '');
  return WORDS.filter(([, ws]) => ws.some((w) => name.includes(w))).map(([id]) => id);
}
