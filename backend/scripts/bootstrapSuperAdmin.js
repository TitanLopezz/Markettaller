const { run } = require('./seed-superadmin');

run().catch((error) => {
  console.error('No se pudo crear o actualizar Super Admin:', error.message);
  process.exitCode = 1;
});
