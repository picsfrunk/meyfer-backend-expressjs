const EXCEL_URL = "https://rhcomercial.com.ar/lista/listadepreciosrh.xls";
const DEFAULT_PROFIT = 10;

// Map para asginar manualmente ciertos productos que contengan la palabra
// de la clave 1 y lo asigne al rubro de la clave 2
const PRODUCT_SECTIONS_CORRECT_MAP
  = new Map([
  ["ABRAZADERA", "A"],
  ["PRECINTOS ", "F"],
  ["ANAFE", "R"],
  ["LUZ", "E"],
  ["CABO", "F"],
  ["BALDE", "F"],
  ["ARCO", "F"],
]);

const PRODUCT_SECTIONS_CORRECT_REGEX
  = new RegExp(
  `\\b(${Array.from(PRODUCT_SECTIONS_CORRECT_MAP.keys()).join("|")})\\b`,
  "gi"
);

// Array para que agrupe en una sola familia los productos que contengan esta palabra
const SPECIAL_NAME_CASES
  = [
  "GRIFERIA",
  "ALAMBRE",
  "ACOPLE",
  "BARRAL",
  "CABO",
  "BALDE",
  "CANILLA",
  "BASE DE TANQUE",
  "BOYA",
  "RODILLO",
  "CAJA DE LUZ",
  "LLUVIA",
  "ASIENTO",
  "BASE",
  "REGULADOR",
  "REJILLA",
  "CALEFON",
  "SIFON",
  "SOPORTE",
  "GRIFO",
  "VALVULA DESCARGA",
  "VALVULA CANILLA",
]


module.exports = {
  EXCEL_URL,
  PRODUCT_SECTIONS_CORRECT_REGEX,
  PRODUCT_SECTIONS_CORRECT_MAP,
  SPECIAL_NAME_CASES,
  DEFAULT_PROFIT
};