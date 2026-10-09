$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:LOCAL_PG_HOST = Read-Host 'Host PostgreSQL (Enter = 127.0.0.1)'
if (-not $env:LOCAL_PG_HOST) { $env:LOCAL_PG_HOST = '127.0.0.1' }
$env:LOCAL_PG_USER = Read-Host 'Usuario PostgreSQL (Enter = postgres)'
if (-not $env:LOCAL_PG_USER) { $env:LOCAL_PG_USER = 'postgres' }
$securePassword = Read-Host 'Contraseña de PostgreSQL (no se muestra)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:LOCAL_PG_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    Push-Location $projectRoot
    try {
        @'
const fs = require('node:fs');
const dotenv = require('./backend/node_modules/dotenv');
const {Client} = require('./backend/node_modules/pg');
(async () => {
  const file = 'backend/.env';
  const original = fs.readFileSync(file, 'utf8');
  const config = dotenv.parse(original);
  const values = {DB_HOST:process.env.LOCAL_PG_HOST, DB_PORT:'5432', DB_USER:process.env.LOCAL_PG_USER, DB_PASSWORD:process.env.LOCAL_PG_PASSWORD};
  if (Object.values(values).some(v => /[\r\n]/.test(v))) throw Error('Los valores no pueden contener saltos de línea.');
  const client = new Client({host:values.DB_HOST, port:5432, user:values.DB_USER, password:values.DB_PASSWORD, database:config.DB_ADMIN_DATABASE || 'postgres', connectionTimeoutMillis:5000});
  await client.connect();
  try { await client.query('SELECT 1'); } finally { await client.end(); }
  let text = original;
  for (const [key,value] of Object.entries(values)) {
    // Single quotes preserve spaces, hashes, dollar signs and backslashes in dotenv.
    // Use double quotes only when needed; reject strings dotenv cannot represent exactly.
    const encoded = !value.includes("'") ? "'"+value+"'" : !value.includes('"') ? '"'+value+'"' : '`'+value+'`';
    if (dotenv.parse(key+'='+encoded)[key] !== value) throw Error('No se puede representar el valor de '+key+' en .env sin alterarlo.');
    const pattern = new RegExp('^'+key+'=.*$', 'm');
    const line = key+'='+encoded;
    text = pattern.test(text) ? text.replace(pattern, () => line) : text+'\n'+line+'\n';
  }
  fs.writeFileSync(file, text);
  console.log('Conexión PostgreSQL verificada y backend/.env actualizado. DB_NAME y JWT_SECRET se conservaron.');
})().catch(error => { console.error('No se guardaron las credenciales. Código: '+(error.code || 'CONFIGURACION_INVALIDA')); process.exitCode=1; });
'@ | node
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar PostgreSQL.' }
    } finally { Pop-Location }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    Remove-Item Env:LOCAL_PG_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:LOCAL_PG_USER -ErrorAction SilentlyContinue
    Remove-Item Env:LOCAL_PG_HOST -ErrorAction SilentlyContinue
}
