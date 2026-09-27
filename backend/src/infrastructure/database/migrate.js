const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const run = async () => {
  const database = process.env.DB_NAME;
  if (!database || !/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error('DB_NAME debe contener solo letras, números y guion bajo.');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.changeUser({ database });
    const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log(`Base de datos ${database} y tabla users listas.`);
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('No se pudo preparar MySQL:', error.message);
  process.exitCode = 1;
});
