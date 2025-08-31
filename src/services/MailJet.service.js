/**
 * @type {import('node-mailjet').Mailjet}
 */
let mailjet;

try {
    const Mailjet = require('node-mailjet');
    mailjet = Mailjet.apiConnect(
        process.env.MJ_APIKEY_PUBLIC,
        process.env.MJ_APIKEY_PRIVATE
    );
} catch (error) {
    console.error('Error inicializando Mailjet:', error.message);
    mailjet = null;
}

module.exports = { mailjet };
