const { EmailServicePort } = require('../../domain/ports/EmailServicePort');
const { orderEmailTemplate } = require('./orderEmailTemplates');

/** SMTP funciona tanto con Mailtrap Sandbox como con una cuenta Ethereal. */
class NodemailAdapter extends EmailServicePort {
  constructor({transport, from, adminEmail}) {
    super();
    this.transport = transport;
    this.from = from;
    this.adminEmail = adminEmail;
  }
  async deliver(to, order, admin) {
    if (!this.transport || !this.from || !to) return false;
    const result = await this.transport.sendMail({from:this.from, to, ...orderEmailTemplate(order, admin)});
    return Boolean(result.accepted?.length) && !result.rejected?.length;
  }
  sendOrderConfirmationEmail(order) { return this.deliver(order.customer.email, order, false); }
  sendAdminNewOrderNotification(order) { return this.deliver(this.adminEmail, order, true); }
}
module.exports = { NodemailAdapter };
