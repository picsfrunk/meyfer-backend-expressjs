const {
  PRODUCT_SECTIONS_CORRECT_REGEX,
  PRODUCT_SECTIONS_CORRECT_MAP,
  SPECIAL_NAME_CASES,
  DEFAULT_PROFIT
} = require('../utils/constants');
const { sectionsData } = require("../utils/sectionsData");

const { getProductPrefix, getProductPrefix1word } = require('../utils/helpers');
const { generateEAN13 } = require('./barcode.service');

function processSheetItems(sheetItems) {
  const sectionMap = new Map(sectionsData.map(section => [section.title[0], { ...section, products: [] }]));
  const productMap = new Map();

  for (const item of sheetItems) {
    const { CODIGO, DESCRIPCIÓN, RUBRO, PRECIO } = item;
    let section = sectionMap.get(RUBRO);
    if (!section) continue;

    const matches = [...DESCRIPCIÓN.matchAll(PRODUCT_SECTIONS_CORRECT_REGEX)];
    if (matches.length > 0) {
      const lastMatch = matches.at(-1)[0].toUpperCase();
      const correctedSection = PRODUCT_SECTIONS_CORRECT_MAP.get(lastMatch);
      if (correctedSection) section = sectionMap.get(correctedSection[0]);
    }

    if (!section) continue;

    const specialCase = SPECIAL_NAME_CASES.some(word =>
      DESCRIPCIÓN.toUpperCase().includes(word.toUpperCase())
    );

    const productName = specialCase
      ? getProductPrefix1word(DESCRIPCIÓN)
      : getProductPrefix(DESCRIPCIÓN);

    if (!productMap.has(productName)) {
      productMap.set(productName, {
        name: productName,
        items: []
      });
      section.products.push(productMap.get(productName));
    }

    const product = productMap.get(productName);
    const codeStr = String(CODIGO).padStart(9, '0');

    const newItem = {
      code: CODIGO,
      description: DESCRIPCIÓN,
      price: PRECIO * (1 + (DEFAULT_PROFIT / 100) ),
      barcode: generateEAN13(codeStr)
    };

    product.items.push(newItem);
    product.items.sort((a, b) => a.code - b.code);
  }
  console.log('Productos procesados:', productMap.size);
  
  const result = Array.from(sectionMap.values());
  console.log(result.map(s => ({ title: s.title, image: s.image })));
  return result;
}

module.exports = { processSheetItems };