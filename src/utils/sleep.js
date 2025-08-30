// Simula un delay de red.
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = sleep;