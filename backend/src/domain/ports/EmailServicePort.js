/** Puerto de salida: datos del pedido persistido, nunca precios del navegador. */
class EmailServicePort {
  async sendOrderConfirmationEmail(orderData) { throw new Error('Método no implementado.'); }
  async sendAdminNewOrderNotification(orderData) { throw new Error('Método no implementado.'); }
}
module.exports = { EmailServicePort };
