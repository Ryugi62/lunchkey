// Words in a Korean dish name that point to one of the 19 numbered allergens.
// Used only to ADD warnings: if the name suggests an allergen the printed numbers don't show, the dish is never "clear".
const WORDS = [
  [2, ['우유', '치즈', '요구르트', '요거트', '버터', '크림', '요플레', '밀크', '라떼', '카스테라', '케이크', '마늘빵', '피자']],
  [1, ['계란', '달걀', '메추리알', '에그', '마요', '난류', '오므라이스', '카스테라', '케이크', '머핀', '와플', '푸딩']],
  [3, ['메밀', '모밀']],
  [4, ['땅콩']],
  [5, ['두부', '두유', '된장', '간장', '콩', '대두']],
  [6, ['밀가루', '빵', '국수', '라면', '우동', '파스타', '스파게티', '만두', '피자', '돈까스', '돈가스', '까스']],
  [7, ['고등어']],
  [8, ['꽃게', '게맛살', '게살', '크래미', '대게', '게장']],
  [9, ['새우']],
  [10, ['돼지', '돈육', '제육', '삼겹', '목살', '햄', '소시지', '소세지', '베이컨', '스팸', '돈까스', '돈가스', '탕수육', '순대', '족발', '보쌈', '수육']],
  [11, ['복숭아']],
  [12, ['토마토', '케첩', '케찹']],
  [13, ['아황산']],
  [14, ['호두']],
  [15, ['닭', '치킨', '너겟']],
  [16, ['쇠고기', '소고기', '한우', '우삼겹', '불고기']],
  [17, ['오징어']],
  [18, ['조개', '바지락', '홍합', '전복', '꼬막', '굴소스']],
  [19, ['잣']],
];

/** @param {string} nameKo @returns {number[]} allergen ids the name suggests */
// Words that contain a hint word but mean something else.
const EXCEPT = {
  5: /강낭콩|완두콩|병아리콩|땅콩/g, // kidney bean, pea, chickpea, peanut are not soybean
  16: /(?:오리|돼지|돈육|제육|닭|돈|삼겹살|주꾸미|쭈꾸미|오징어)(?:고추장|간장|양념|매콤)?불고기/g,
  10: /돼지감자/g, // Jerusalem artichoke, not pork // duck/pork/chicken bulgogi is not beef
};

/** @param {string} nameKo @returns {number[]} allergen ids the name suggests */
export function nameHints(nameKo) {
  const name = String(nameKo ?? '');
  return WORDS.filter(([id, ws]) => {
    const n = EXCEPT[id] ? name.replace(EXCEPT[id], '') : name;
    return ws.some((w) => n.includes(w));
  }).map(([id]) => id);
}
