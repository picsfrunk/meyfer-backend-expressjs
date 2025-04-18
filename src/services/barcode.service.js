const BARCODE_PREFIX = '779';
const BARCODE_PAD = '0';

function generateEAN13(code) {
  const baseCode = BARCODE_PREFIX + code.padEnd(9, BARCODE_PAD);
  const checksum = calculateEANChecksum(baseCode);
  return baseCode + checksum;
}

function calculateEANChecksum(code) {
  const sum = code.split('').reduce((acc, num, idx) =>
    acc + parseInt(num) * (idx % 2 === 0 ? 1 : 3), 0
  );
  return (10 - (sum % 10)) % 10;
}

module.exports = { generateEAN13 };