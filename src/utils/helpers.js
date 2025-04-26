function getProductPrefix(description) {
  return description.replace(/\d+.*$/, '').trim();
}

function getProductPrefixSpecialCase(description) {
  return description.split(/\s+/)[0];
}

module.exports = {
  getProductPrefix,
  getProductPrefixSpecialCase: getProductPrefixSpecialCase
};