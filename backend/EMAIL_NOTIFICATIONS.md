# Notificaciones de compras

El checkout de clientes usa `CreateOrderUseCase.run`: primero ejecuta la
persistencia transaccional existente y después invoca el puerto de dominio
`EmailServicePort`. `NodemailAdapter` implementa ese puerto y recibe un transporte
SMTP creado exclusivamente en el composition root `bootstrap/createCommerce.js`.
El flujo de pedidos de proveedores conserva su caso de uso independiente.

## Configuración

En `backend/.env`, configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, `MAIL_FROM` y `ADMIN_NOTIFICATION_EMAIL`. No publiques credenciales.
Para Mailtrap Sandbox, copia los valores de la sección SMTP de tu sandbox.
Para Ethereal, copia las credenciales de una cuenta de prueba; usa
`SMTP_HOST=smtp.ethereal.email`, `SMTP_PORT=587`, `SMTP_SECURE=false`.
Ambos entornos capturan mensajes de prueba; consulta sus bandejas web.

Configura `TRANSFER_INSTRUCTIONS` con banco, beneficiario y CLABE/cuenta, por ejemplo:
`Banco: BANCO DE LA TIENDA; Beneficiario: RAZÓN SOCIAL; CLABE: CLABE REAL`.
Esta variable también habilita transferencia en el checkout. El correo agrega el
número del pedido como referencia. Los precios y totales provienen del servidor.

## Flujo y límites

React llama al servicio existente `store.checkout`, que usa el gateway autenticado
del backend. La respuesta mantiene el pedido y agrega `email_notification` para
una compra nueva. `customer: accepted` significa aceptación SMTP, no entrega al
destinatario. La pantalla conserva el comprobante y las instrucciones de pago.

Los destinatarios se notifican de manera independiente. Un fallo de SMTP se
registra sin revertir una compra confirmada. Los reintentos con la misma clave
idempotente no envían nuevamente los mensajes. No hay cola ni reintentos durables:
si el proceso termina después del commit, puede perderse la notificación; para
entrega eventual garantizada, se requiere un outbox transaccional y un worker.
La recuperación de contraseñas y cambios posteriores de estado mantienen Resend.

## Verificación

`npm test --prefix backend`, `npm test --prefix frontend` y
`npm run build --prefix frontend`. Las pruebas de correo usan un transporte falso;
la comprobación de SMTP real requiere credenciales del entorno de prueba.
