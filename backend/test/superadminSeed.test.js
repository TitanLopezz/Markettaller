const assert = require('node:assert/strict');
const test = require('node:test');
const { assertSuperAdminAccount } = require('../scripts/seed-superadmin');

test('the superadmin seed accepts a new email and existing superadmin only', () => {
  assert.doesNotThrow(() => assertSuperAdminAccount([]));
  assert.doesNotThrow(() => assertSuperAdminAccount([{ role: 'super_admin' }]));
});

test('the superadmin seed refuses to take over an email owned by another role', () => {
  assert.throws(
    () => assertSuperAdminAccount([{ role: 'proveedor' }]),
    { message: 'Ese email ya pertenece a otra cuenta; no se modificó su rol.' },
  );
});
