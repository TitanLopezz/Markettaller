# Solicitud mejorada

Quiero ampliar las funciones del rol existente **Gestor de Productos** en mi e-commerce React/Vite, Node/Express y MySQL. Además de administrar los productos, debe coordinar la preparación y el despacho de las compras realizadas por los clientes.

Agregar una sección **Compras y despachos** donde el gestor pueda:

1. Consultar pedidos y sus artículos, cantidades, importes, estado de pago, destinatario, teléfono y dirección de entrega.
2. Confirmar la recepción del pedido y avanzar por los estados recibido, confirmado, preparando, enviado y entregado, respetando el orden permitido.
3. Redactar y guardar instrucciones internas para quien prepara y entrega el paquete: revisar cantidades, proteger artículos frágiles, separar productos o indicar cómo entregarlos al transportista.
4. Imprimir el detalle del pedido con esas instrucciones para usarlo como hoja de preparación y despacho.
5. Registrar transportista y número de guía al enviar. Exigir instrucciones guardadas antes del despacho y conservar su autor y fecha de actualización.

Mantener las instrucciones fuera de las respuestas y comprobantes del cliente. El gestor no debe poder registrar pagos, reembolsos ni cancelaciones administrativas: esas funciones corresponden al **Super Admin**, que conserva acceso completo. Los clientes y proveedores no deben acceder a la gestión de despachos, incluso llamando directamente a la API.

Conservar los usuarios, productos y pedidos existentes. Aplicar una migración repetible sin borrar datos. Mantener las reglas de stock y pago: no descontar inventario otra vez al despachar; exigir transferencia confirmada antes del envío y pago confirmado antes de completar la entrega. Bloquear cambios de instrucciones después del despacho o cierre.

Validar permisos, privacidad de instrucciones y transiciones con pruebas de integración. Actualizar los paquetes compilados y scripts de AWS con el nuevo esquema. Explicar dónde encuentra la función cada rol y qué se verificó.
