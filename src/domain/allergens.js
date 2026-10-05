// The 19 allergens numbered on Korean school-meal menus.
// Source: Korean school-meal allergen labeling (numbers 1–19), as printed on NEIS menus.
/** @typedef {{id:number, names:Record<string,string>}} Allergen */

/** @type {Allergen[]} */
export const ALLERGENS = [
  { id: 1, names: { ko: '난류(달걀)', en: 'Egg', vi: 'Trứng', zh: '鸡蛋', tl: 'Itlog', ja: '卵', ru: 'Яйца' } },
  { id: 2, names: { ko: '우유', en: 'Milk', vi: 'Sữa', zh: '牛奶', tl: 'Gatas', ja: '牛乳', ru: 'Молоко' } },
  { id: 3, names: { ko: '메밀', en: 'Buckwheat', vi: 'Kiều mạch', zh: '荞麦', tl: 'Bakwit (buckwheat)', ja: 'そば', ru: 'Гречиха' } },
  { id: 4, names: { ko: '땅콩', en: 'Peanut', vi: 'Đậu phộng', zh: '花生', tl: 'Mani', ja: '落花生', ru: 'Арахис' } },
  { id: 5, names: { ko: '대두', en: 'Soybean', vi: 'Đậu nành', zh: '大豆', tl: 'Soya', ja: '大豆', ru: 'Соя' } },
  { id: 6, names: { ko: '밀', en: 'Wheat', vi: 'Lúa mì', zh: '小麦', tl: 'Trigo', ja: '小麦', ru: 'Пшеница' } },
  { id: 7, names: { ko: '고등어', en: 'Mackerel', vi: 'Cá thu', zh: '鲭鱼', tl: 'Alumahan (mackerel)', ja: 'さば', ru: 'Скумбрия' } },
  { id: 8, names: { ko: '게', en: 'Crab', vi: 'Cua', zh: '螃蟹', tl: 'Alimango (crab)', ja: 'かに', ru: 'Краб' } },
  { id: 9, names: { ko: '새우', en: 'Shrimp', vi: 'Tôm', zh: '虾', tl: 'Hipon', ja: 'えび', ru: 'Креветки' } },
  { id: 10, names: { ko: '돼지고기', en: 'Pork', vi: 'Thịt heo', zh: '猪肉', tl: 'Baboy', ja: '豚肉', ru: 'Свинина' } },
  { id: 11, names: { ko: '복숭아', en: 'Peach', vi: 'Đào', zh: '桃子', tl: 'Peach (melokoton)', ja: 'もも', ru: 'Персик' } },
  { id: 12, names: { ko: '토마토', en: 'Tomato', vi: 'Cà chua', zh: '番茄', tl: 'Kamatis', ja: 'トマト', ru: 'Помидоры' } },
  { id: 13, names: { ko: '아황산류', en: 'Sulfites', vi: 'Sulfit', zh: '亚硫酸盐', tl: 'Sulfites', ja: '亜硫酸塩', ru: 'Сульфиты' } },
  { id: 14, names: { ko: '호두', en: 'Walnut', vi: 'Óc chó', zh: '核桃', tl: 'Walnut', ja: 'くるみ', ru: 'Грецкий орех' } },
  { id: 15, names: { ko: '닭고기', en: 'Chicken', vi: 'Thịt gà', zh: '鸡肉', tl: 'Manok', ja: '鶏肉', ru: 'Курица' } },
  { id: 16, names: { ko: '쇠고기', en: 'Beef', vi: 'Thịt bò', zh: '牛肉', tl: 'Baka', ja: '牛肉', ru: 'Говядина' } },
  { id: 17, names: { ko: '오징어', en: 'Squid', vi: 'Mực', zh: '鱿鱼', tl: 'Pusit', ja: 'いか', ru: 'Кальмар' } },
  { id: 18, names: { ko: '조개류(굴·전복·홍합 포함)', en: 'Shellfish (incl. oyster, abalone, mussel)', vi: 'Động vật có vỏ (gồm hàu, bào ngư, vẹm)', zh: '贝类（含牡蛎、鲍鱼、贻贝）', tl: 'Kabibe (kasama ang talaba, abalone, tahong)', ja: '貝類（かき・あわび・ムール貝を含む）', ru: 'Моллюски (вкл. устрицы, морское ушко, мидии)' } },
  { id: 19, names: { ko: '잣', en: 'Pine nut', vi: 'Hạt thông', zh: '松子', tl: 'Pine nut', ja: '松の実', ru: 'Кедровый орех' } },
];

export const MAX_CODE = ALLERGENS.length;

/** @param {number} id */
export const isAllergenCode = (id) => Number.isInteger(id) && id >= 1 && id <= MAX_CODE;

/** @param {number} id @param {string} lang */
export function allergenName(id, lang) {
  const a = ALLERGENS[id - 1];
  if (!a) return `#${id}`;
  return a.names[lang] ?? a.names.en;
}
