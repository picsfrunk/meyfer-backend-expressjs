function getProductPrefix(description) {
  return description.replace(/\d+.*$/, '').trim();
}

function getProductPrefix1word(description) {
  return description.split(/\s+/)[0];
}

export default {
  getProductPrefix,
  getProductPrefix1word
};