/**
 * @type {import('node-mailjet').Mailjet | null}
 */
let mailjet = null;

const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;

if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) {
    console.warn('[mail] Credenciales Mailjet incompletas. Definir MJ_APIKEY_PUBLIC y MJ_APIKEY_PRIVATE.');
} else {
    try {
        const Mailjet = require('node-mailjet');
        mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);
    } catch (error) {
        console.error('Error inicializando Mailjet:', error.message);
        mailjet = null;
    }
}

module.exports = { mailjet };
