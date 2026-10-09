# Tienda: funcionamiento y configuración

La separación en dominio, aplicación, puertos, adaptadores y bootstrap se documenta en [ARQUITECTURA.md](ARQUITECTURA.md). Las pantallas React están en `frontend/src/presentation/`.

La portada es un catálogo público con búsqueda, categorías y orden por precio. El carrito se conserva en el navegador. Los visitantes pueden explorar y agregar productos; para confirmar una compra necesitan una cuenta **Cliente**.

## Cuentas y pantallas

- Cliente: registro inmediato, carrito, compra, direcciones guardadas, comprobante imprimible, historial y notificaciones.
- Gestor y proveedor: conservan su portal y las aprobaciones existentes. Sus pedidos anteriores siguen en `orders` y no se convierten en ventas.
- Super Admin: desde el catálogo interno, entrar a **Ventas y entregas** para ver compras, registrar pagos, preparar pedidos y registrar guía y transportista.
- El mismo flujo también está dentro de **Panel Super Admin → Compras y transacciones**, junto a las aprobaciones de usuarios, productos y pedidos de proveedores. **Aceptar pago / transacción** registra un pago que el administrador ya comprobó; no ejecuta un cobro bancario.
- Gestor de Productos: además de administrar el catálogo, entra a **Compras y despachos** para revisar ventas, cantidades, destinatario y dirección; guardar instrucciones internas e imprimirlas; confirmar, preparar, despachar y completar entregas. Los pagos, reembolsos y cancelaciones administrativas siguen a cargo del Super Admin.

Las cuentas de gestión requieren aprobación. El registro público nunca puede crear un Super Admin. Una contraseña debe tener al menos 8 caracteres y ocupar como máximo 72 bytes en UTF-8.

## Base de datos existente

Antes de arrancar el backend actualizado, desde backend ejecutar:

```powershell
npm run db:setup
```

La migración agrega el rol cliente y las tablas `user_security`, `customer_addresses`, `shop_orders`, `shop_order_items`, `shop_notifications` y `password_reset_tokens`. No borra pedidos anteriores. Hacer una copia antes de aplicarla a una base importante. Las pruebas nuevas crean una base temporal distinta y la eliminan al terminar.

## Compras e inventario

Cada compra guarda todos sus artículos y una copia de su nombre, imagen y precio. Los importes se calculan en el servidor en centavos MXN; el importe enviado por un navegador se ignora. El total del carrito es una estimación hasta confirmar la compra.

El stock se descuenta al confirmar el checkout, dentro de una transacción que bloquea los productos en orden. Si falla un artículo, toda la compra se revierte. La clave de idempotencia evita crear dos compras al repetir una solicitud. El cliente conserva esa clave al reintentar sin modificar su carrito ni dirección.

Límites: 50 productos distintos, hasta 100 unidades por artículo, subtotal máximo de 1,000,000 MXN y hasta 10 direcciones guardadas por cuenta.

Estados: recibido → confirmado → preparando → enviado → entregado. Para enviar se requiere transportista y número de guía. El cliente puede cancelar antes de preparar si no se ha registrado el pago; el administrador puede cancelar hasta antes de enviar. La cancelación devuelve stock una sola vez.

Antes de enviar también deben guardarse instrucciones de preparación y despacho. Son internas: solo las ve el gestor o Super Admin, y aparecen en su impresión del pedido; no se incluyen en la API ni en el comprobante del cliente. Se registra quién las actualizó y cuándo. Ya no se pueden editar después del envío o cierre. La tabla nueva `shop_fulfillment` se crea con la misma migración, sin cambiar las cuentas existentes.

Si ya hubo pago, el administrador debe devolver el dinero por el medio correspondiente y registrar conjuntamente **reembolso y cancelación**. La aplicación registra ese hecho; no mueve dinero. Las devoluciones después del envío y facturas fiscales no forman parte de esta versión.

## Pagos y envío

Configuración inicial: MXN, entregas en México, envío de 99 MXN y envío gratuito desde 1,500 MXN. Cambiar las reglas en el entorno del backend:

```dotenv
SHIPPING_FEE_CENTS=9900
FREE_SHIPPING_CENTS=150000
TRANSFER_INSTRUCTIONS=Banco, beneficiario, CLABE y referencia que deberá usar el cliente
```

Siempre existe pago contra entrega. Transferencia aparece únicamente cuando `TRANSFER_INSTRUCTIONS` está configurada. No se incluyen datos bancarios inventados. El administrador confirma manualmente que recibió el pago; una transferencia debe estar pagada antes de enviar y cualquier pedido debe estar pagado antes de marcarlo entregado.

El cálculo de envío es una tarifa fija configurable, no una cotización automática con paqueterías. Los precios guardados representan el importe de venta configurado; no se calcula un desglose fiscal adicional.

No hay cobros con tarjeta: para agregarlos hace falta seleccionar una pasarela, una cuenta de comercio y credenciales de prueba, además de sus webhooks. Nunca ingresar números de tarjeta en esta aplicación.

## Correo y recuperación de contraseña

Hay notificaciones persistentes dentro de **Mi cuenta**. Los correos de pedido y recuperación usan la API de Resend:

```dotenv
RESEND_API_KEY=
MAIL_FROM=Tienda <ventas@tu-dominio-verificado>
FRONTEND_ORIGIN=https://tu-dominio
```

Configurar un remitente autorizado y las credenciales en la instancia, nunca en Git ni en el chat. Ver [documentación de Resend](https://resend.com/docs/api-reference/emails/send-email). Sin esa configuración no se envían correos y la recuperación informa que el servicio no está disponible. Si falla un correo de pedido, el pedido se conserva y la notificación sigue en la cuenta; no hay cola automática de reenvío.

Los enlaces de recuperación caducan en 30 minutos, solo se usan una vez, y se guardan en MySQL como hashes. Cambiar contraseña invalida las sesiones anteriores, incluidas las del portal interno. Hay limitación de intentos por IP para registro, login y recuperación; el limitador es local al único proceso backend.

## AWS, HTTPS y copias

Ver [deploy/README.md](deploy/README.md). Los paquetes de release incluyen el nuevo esquema, backend, frontend y scripts de copia de MySQL y activación de HTTPS.

En el frontend, después de configurar DNS y abrir 443 en su Security Group:

```bash
bash deploy/enable-https.sh tienda.ejemplo.com tu-email@ejemplo.com
```

Actualizar `FRONTEND_ORIGIN=https://tienda.ejemplo.com` en el backend y repetir su script. Si se vuelve a ejecutar deploy-front.sh, se regenera la configuración HTTP: repetir también enable-https.sh. El certificado requiere un dominio real que apunte a la instancia. No está activado en AWS desde este entorno.

En la instancia MySQL:

```bash
export DB_NAME=nombre_bd
bash deploy/backup-db.sh
```

Descargar el `.sql.gz` fuera del laboratorio. El archivo contiene datos personales y debe protegerse. La copia es manual; no se ha creado una tarea programada ni se ha contratado almacenamiento externo. Para restaurarla en una base destino preparada, comprobar primero que sea la base correcta y usar `gunzip -c copia.sql.gz | sudo mysql nombre_bd`. La restauración requiere una decisión explícita del operador y no se ejecuta durante los despliegues.

## Validación local

```powershell
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend test
node deploy/build.mjs
```

Las pruebas de MySQL necesitan acceso local y permisos para crear/eliminar su base temporal. Los servicios Linux, DNS, certificados, recepción real de correo y entrega física deben comprobarse en el entorno final.
