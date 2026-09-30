const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('../src/models/customer.model');
const CustomersService = require('../src/services/customers.service');
const emailService = require('../src/services/email.service');
const { buildCustomerWelcomeEmail } = require('../src/utils/buildCustomerWelcomeEmail');

const originalSave = Customer.prototype.save;
const originalFindByIdAndUpdate = Customer.findByIdAndUpdate;
const originalSendCustomerWelcomeEmail = emailService.sendCustomerWelcomeEmail;
const originalSendNewCustomerAdminNotification = emailService.sendNewCustomerAdminNotification;

let saveCalls;
let savedCustomers;
let welcomeEmails;
let adminEmails;
let saveMock;

function resetMocks() {
    saveCalls = 0;
    savedCustomers = [];
    welcomeEmails = [];
    adminEmails = [];
    saveMock = async function save() {
        saveCalls += 1;
        this.createdAt = new Date('2026-06-23T12:00:00.000Z');
        savedCustomers.push(this);
        return this;
    };

    Customer.prototype.save = function save() {
        return saveMock.call(this);
    };

    Customer.findByIdAndUpdate = () => ({
        lean: async () => ({
            _id: 'customer-1',
            cliente: 'Cliente Actualizado',
            email: 'actualizado@example.com',
            customerCode: 'AC1234',
        }),
    });

    emailService.sendCustomerWelcomeEmail = async (customer) => {
        welcomeEmails.push(customer);
        return { success: true };
    };

    emailService.sendNewCustomerAdminNotification = async (payload) => {
        adminEmails.push(payload);
        return { success: true };
    };
}

test.beforeEach(resetMocks);

test.afterEach(() => {
    Customer.prototype.save = originalSave;
    Customer.findByIdAndUpdate = originalFindByIdAndUpdate;
    emailService.sendCustomerWelcomeEmail = originalSendCustomerWelcomeEmail;
    emailService.sendNewCustomerAdminNotification = originalSendNewCustomerAdminNotification;
});

test('alta de cliente con email envía bienvenida al cliente', async () => {
    const customer = await CustomersService.createCustomer({
        cliente: 'Ferretería Centro',
        email: 'CLIENTE@EXAMPLE.COM',
        cuit: '20-12345678-9',
    });

    assert.equal(customer.email, 'cliente@example.com');
    assert.equal(welcomeEmails.length, 1);
    assert.equal(welcomeEmails[0].email, 'cliente@example.com');
    assert.equal(welcomeEmails[0].customerCode, customer.customerCode);
});

test('alta de cliente envía aviso al admin con usuario creador', async () => {
    const customer = await CustomersService.createCustomer(
        {
            cliente: 'Meyfer Test',
            email: 'cliente@example.com',
            telefono1: '11-1234-5678',
            cuit: '20-12345678-9',
        },
        { createdBy: 'admin' }
    );

    assert.equal(adminEmails.length, 1);
    assert.equal(adminEmails[0].createdBy, 'admin');
    assert.equal(adminEmails[0].customer.email, 'cliente@example.com');
    assert.equal(adminEmails[0].customer.telefono1, '11-1234-5678');
    assert.equal(adminEmails[0].customer.customerCode, customer.customerCode);
});

test('cliente sin email no rompe la creación ni envía bienvenida', async () => {
    const customer = await CustomersService.createCustomer({
        cliente: 'Sin Email',
        cuit: '20-12345678-9',
    });

    assert.equal(customer.email, '');
    assert.equal(welcomeEmails.length, 0);
    assert.equal(adminEmails.length, 1);
});

test('fallo de mail no revierte la creación del cliente', async () => {
    emailService.sendCustomerWelcomeEmail = async () => {
        throw new Error('mail unavailable');
    };

    const customer = await CustomersService.createCustomer({
        cliente: 'Mail Falla',
        email: 'cliente@example.com',
        cuit: '20-12345678-9',
    });

    assert.equal(savedCustomers.length, 1);
    assert.equal(customer.cliente, 'Mail Falla');
    assert.equal(adminEmails.length, 1);
});

test('actualización de cliente existente no dispara bienvenida', async () => {
    const updated = await CustomersService.updateCustomer('customer-1', {
        cliente: 'Cliente Actualizado',
        email: 'actualizado@example.com',
    });

    assert.equal(updated.customerCode, 'AC1234');
    assert.equal(welcomeEmails.length, 0);
    assert.equal(adminEmails.length, 0);
});

test('duplicado existente no dispara emails', async () => {
    saveMock = async function saveDuplicate() {
        saveCalls += 1;
        const error = new Error('duplicate key');
        error.code = 11000;
        error.keyPattern = { email: 1 };
        throw error;
    };

    await assert.rejects(
        () => CustomersService.createCustomer({
            cliente: 'Duplicado',
            email: 'duplicado@example.com',
        }),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.message, 'Ya existe un cliente con ese CUIT o email');
            return true;
        }
    );

    assert.equal(saveCalls, 1);
    assert.equal(welcomeEmails.length, 0);
    assert.equal(adminEmails.length, 0);
});

test('reintento por código duplicado no dispara emails duplicados', async () => {
    saveMock = async function saveWithCodeRetry() {
        saveCalls += 1;
        if (saveCalls === 1) {
            const error = new Error('duplicate customerCode');
            error.code = 11000;
            error.keyPattern = { customerCode: 1 };
            throw error;
        }
        this.createdAt = new Date('2026-06-23T12:00:00.000Z');
        savedCustomers.push(this);
        return this;
    };

    await CustomersService.createCustomer({
        cliente: 'Reintento Código',
        email: 'reintento@example.com',
    });

    assert.equal(saveCalls, 2);
    assert.equal(savedCustomers.length, 1);
    assert.equal(welcomeEmails.length, 1);
    assert.equal(adminEmails.length, 1);
});

test('email de bienvenida incluye código de cliente y storeUrl', () => {
    const html = buildCustomerWelcomeEmail({
        customer: {
            cliente: 'Cliente HTML',
            customerCode: 'CH1234',
        },
        storeUrl: 'https://tienda.meyfer.example',
    });

    assert.match(html, /Cliente HTML/);
    assert.match(html, /CH1234/);
    assert.match(html, /https:\/\/tienda\.meyfer\.example/);
});
