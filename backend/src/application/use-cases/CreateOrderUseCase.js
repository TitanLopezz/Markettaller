/** Ejecutar únicamente después del commit. Un fallo SMTP no revierte la compra. */
class CreateOrderUseCase {
  constructor({emailService, logger}) {
    this.emailService = emailService;
    this.logger = logger;
  }
  async run({saveOrder, loadCustomer, transferInstructions}) {
    // saveOrder coordina repositorio y unidad de trabajo; resuelve tras el commit.
    const {order, repeated} = await saveOrder();
    if (!repeated) {
      try {
        const customer = await loadCustomer(order.user_id);
        order.email_notification = await this.notify({...order, customer, transfer_instructions:transferInstructions});
      } catch {
        this.logger.error('No se pudo preparar el correo del pedido.');
        order.email_notification = {customer:'unavailable', admin:'unavailable'};
      }
    }
    return order;
  }
  async notify(orderData) {
    const results = await Promise.allSettled([
      Promise.resolve().then(() => this.emailService.sendOrderConfirmationEmail(orderData)),
      Promise.resolve().then(() => this.emailService.sendAdminNewOrderNotification(orderData)),
    ]);
    if (results.some(result => result.status === 'rejected')) {
      this.logger.error('Falló una notificación por correo del pedido.');
    }
    const status = result => result.status === 'fulfilled' && result.value === true ? 'accepted' : 'unavailable';
    return {customer:status(results[0]), admin:status(results[1])};
  }
}
module.exports = { CreateOrderUseCase };
