# Despliegue en AWS Academy

Preparado para **tres EC2 Ubuntu 24.04**, PostgreSQL 16 (paquete de Ubuntu 24.04) y Node.js 24 LTS en el backend. No ejecutar estos scripts en Amazon Linux. Todos los comandos Linux parten del directorio del artefacto correspondiente. No se requieren ramas nuevas para subir los ZIP.

El backend permite también Ubuntu 26.04 con Node.js 24 instalado previamente. Esta combinación está pendiente de validación en EC2. Los scripts de frontend y base de datos siguen requiriendo Ubuntu 24.04; no se ha validado la instalación de PostgreSQL en 26.04.

## Adaptación al proyecto real

- Código completo: rama local `main`. No se han creado ni publicado ramas de despliegue.
- API: entrada `backend/server.js`, puerto 3000, rutas `/api/users`, `/api/products`, `/api/orders` y `/api/shop`.
- nginx y el proxy de Vite conservan `/api`: no añadir barra final al destino de `proxy_pass`, porque la API necesita ese prefijo.
- Base de datos: PostgreSQL, puerto 5432; esquema en `backend/src/infrastructure/database/schema.sql` y `commerce.sql`. No usar instrucciones de MySQL.
- Build: esbuild, objetivo Node 24, dependencias externas y lockfile de producción; instalar con `npm ci --omit=dev`.
- Proceso: systemd con ruta absoluta al ejecutable Node, compatible con Node instalado por nvm; configuración privada en `runtime-env.json`.
- Imágenes: enlaces externos, sin carpeta de uploads que deba persistirse.
- Cambios de IP: repetir los scripts con las nuevas IP privadas y actualizar `FRONTEND_ORIGIN`; no recompilar.
- Los bundles excluyen fuentes originales y sourcemaps, pero siguen siendo inspeccionables. Una rama compilada no oculta el código de otras ramas ni del historial accesible. Para entregar sin fuentes originales, usar los ZIP o un repositorio separado sin el historial de `main`.
- No compartir contraseñas, claves PEM ni tokens en el chat. No usar `git checkout -f` sobre este árbol con cambios pendientes.

## Generar artefactos en Windows

Desde la raíz del proyecto:

```powershell
npm --prefix backend ci
npm --prefix frontend ci
node deploy/build.mjs
Compress-Archive -Path release/backend/* -DestinationPath release/backend.zip -Force
Compress-Archive -Path release/frontend/* -DestinationPath release/frontend.zip -Force
Compress-Archive -Path release/database/* -DestinationPath release/database.zip -Force
```

`release/` no se versiona. Contiene solo bundles propios, dist del frontend, SQL, configuración y scripts; no contiene src, .env ni mapas de código fuente. JavaScript compilado sigue siendo inspeccionable. El historial de main conserva el código fuente.

## Red

Crear tres Security Groups: frontend con 80 público; backend con 3000 y base de datos con 5432. En esta práctica, los puertos de entrada y SSH 22 usan Anywhere-IPv4 por requisito del profesor. Usar IP privadas entre instancias. Verificar el CIDR real de la VPC. Las instancias necesitan salida a Internet para instalar paquetes. El acceso de PostgreSQL sigue requiriendo usuario, contraseña y un origen permitido en pg_hba.conf.

Subir cada ZIP a su instancia mediante SCP con tu clave SSH y descomprimirlo en una carpeta de tu usuario. Instalar unzip si hace falta. Los scripts se invocan con bash, por lo que no dependen de permisos ejecutables de Windows.

## 1. Base de datos

```bash
export DB_NAME=nombre_bd DB_USER=app VPC_CIDR=CIDR_REAL
read -rsp 'Contraseña PostgreSQL: ' DB_PASSWORD; echo
export DB_PASSWORD
bash deploy/deploy-db.sh
unset DB_PASSWORD
```

La contraseña se solicita de nuevo al repetir el script: usar la misma para conservar acceso del backend. El esquema no borra tablas ni carga datos personales locales. Para evidencias, ejecutar en esta instancia `sudo -u postgres psql -d nombre_bd -c '\dt'`. El usuario app tiene permisos de datos y secuencias. pg_hba.conf permite autenticación SCRAM desde el CIDR de la VPC. Para esta práctica el profesor pidió Anywhere-IPv4 en los puertos de los SG; el tráfico interno usa IPs privadas.

## 2. Backend

Instalar Node.js 24 LTS y npm antes de ejecutar el script. Comprobar `node --version` y `npm --version`. Ubuntu 24.04 no garantiza esa versión con su paquete nodejs predeterminado; utilizar una distribución de Node 24 apropiada para la arquitectura de EC2.

```bash
export DB_NAME=nombre_bd DB_USER=app
export FRONTEND_ORIGIN=http://IP_PUBLICA_FRONT
export SHIPPING_FEE_CENTS=9900 FREE_SHIPPING_CENTS=150000
# Opcional: export TRANSFER_INSTRUCTIONS='Tus instrucciones bancarias reales'
# Opcionales: export RESEND_API_KEY='...' MAIL_FROM='Tienda <ventas@tu-dominio>'
read -rsp 'Contraseña PostgreSQL: ' DB_PASSWORD; echo
read -rsp 'JWT_SECRET: ' JWT_SECRET; echo
export DB_PASSWORD JWT_SECRET
bash deploy/deploy-back.sh IP_PRIVADA_BD
curl --fail http://localhost:3000/api/health
```

El script escribe runtime-env.json con permisos 600. Mantener ese archivo fuera de Git y de los ZIP. El servicio systemd app-api usa su contenido y arranca automáticamente tras reinicios. Consultar logs con `sudo journalctl -u app-api -n 100 --no-pager`. Se usa systemd para evitar las dependencias vulnerables detectadas al evaluar PM2.

Crear el Super Admin una vez, desde el mismo directorio:

```bash
read -rp 'Email administrador: ' SUPERADMIN_EMAIL
read -rsp 'Contraseña administrador: ' SUPERADMIN_PASSWORD; echo
export SUPERADMIN_EMAIL SUPERADMIN_PASSWORD
node -e 'Object.assign(process.env, require("./runtime-env.json")); require("./dist/seed-superadmin.js")'
unset SUPERADMIN_PASSWORD DB_PASSWORD JWT_SECRET
```

El bundle de bootstrap ejecuta el seed. Repetirlo actualiza nombre, contraseña y estado de una cuenta Super Admin existente. No usar el email de otra cuenta.

## 3. Frontend

```bash
bash deploy/deploy-front.sh IP_PRIVADA_BACKEND
curl --fail http://localhost/api/health
```

Abrir `http://IP_PUBLICA_FRONT` y comprobar login, catálogo y pedidos. nginx conserva /api en el proxy y el frontend usa URLs relativas. Las imágenes son enlaces externos; no se distribuyen respaldos JSON locales ni uploads.

## Nuevo laboratorio o IPs diferentes

Reutilizar los mismos artefactos. Si las EC2 se recrean, repetir BD → backend → frontend. Si solo cambian direcciones, repetir backend con la IP privada de BD y FRONTEND_ORIGIN actualizado, y frontend con la IP privada del backend. No recompilar por cambios de IP. Conservar JWT_SECRET para mantener válidas las sesiones y la contraseña PostgreSQL para mantener la conexión. Verificar persistencia del laboratorio: este paquete no incluye copias de datos de producción.

## Ramas opcionales de entrega

No se han creado ramas, commits ni push. Para entregar solo artefactos, usar un directorio o repositorio separado a partir de release/backend o release/frontend; no hacer checkout forzado sobre el trabajo actual. Si se publican scripts en Git, registrar `git update-index --chmod=+x deploy/*.sh` y verificar `git ls-tree -r --name-only HEAD` antes del push. Un profesor con acceso a main o al historial puede ver el código original.

Los scripts deben validarse finalmente en EC2: este entorno Windows no ejecuta systemd, apt, nginx ni la instalación Linux de PostgreSQL.

## E-commerce

El ZIP de base de datos incluye las tablas de clientes, compras y recuperación. Aplicarlo antes de arrancar la nueva API. La portada pública contiene la tienda; los clientes se registran sin aprobación. El Super Admin administra ventas desde **Ventas y entregas**. Ver [ECOMMERCE.md](../ECOMMERCE.md) para reglas de stock, envío, pagos manuales, correo y recuperación.

Los scripts `deploy/enable-https.sh` (frontend) y `deploy/backup-db.sh` (base de datos) preparan HTTPS y copias manuales. HTTPS requiere dominio y DNS propios, y puerto 443 abierto en el SG frontend. Después de regenerar nginx con deploy-front.sh, repetir enable-https.sh si ya usabas certificado. Estos pasos no se han ejecutado en AWS.

## Migración desde la versión MySQL

El backend ahora usa pg y PostgreSQL (puerto 5432). Los ZIP anteriores deben reemplazarse. Los esquemas son para PostgreSQL; no ejecutarlos en MySQL. Esta adaptación no copia automáticamente los registros de la base MySQL local: dicha base se conserva intacta. El despliegue nuevo crea tablas vacías y el Super Admin se genera mediante el bootstrap. Si necesitas conservar el catálogo y las cuentas existentes, realiza una migración de datos separada antes de usar el sistema.

Para desarrollo, ajusta backend/.env a tu PostgreSQL local: DB_HOST, DB_PORT=5432, DB_USER, DB_PASSWORD y DB_NAME. No reutilices la conexión MySQL. npm run db:setup requiere un usuario con permiso CREATEDB y permisos de esquema; el usuario app de AWS tiene únicamente permisos de datos.

Pruebas de integración desde PowerShell, usando un PostgreSQL dedicado para pruebas:

```powershell
$env:PG_TEST_HOST='127.0.0.1'
$env:PG_TEST_PORT='5432'
$env:PG_TEST_USER='postgres'
# Define PG_TEST_PASSWORD localmente, sin pegarla en el chat.
npm --prefix backend test
```

Sin estas variables, las pruebas de integración se omiten. Se validó la migración con PostgreSQL 18 local; la instalación de Ubuntu 24.04 en EC2 debe comprobarse en el laboratorio.
