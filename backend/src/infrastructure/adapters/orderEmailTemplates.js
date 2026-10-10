const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = cents => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(Number(cents) / 100);

function orderEmailTemplate(order, admin = false) {
  const subject = `${admin ? 'Nueva orden recibida' : 'Confirmación de compra'} #${order.id}`;
  const lines = order.items.map(item => `${item.product_name} · ${item.quantity} × ${money(item.unit_price_cents)} = ${money(item.quantity * Number(item.unit_price_cents))}`);
  const payment = order.payment_method === 'transferencia'
    ? `Transferencia bancaria:\n${order.transfer_instructions}\nReferencia: pedido #${order.id}. El pago se verificará manualmente.`
    : 'Forma de pago: contra entrega.';
  const paragraphs = [subject, admin ? `Cliente: ${order.customer.email}` : `Hola, ${order.customer.name || 'cliente'}. Recibimos tu compra.`,
    'Estado del pago: Pendiente de Pago', ...lines,
    `Subtotal: ${money(order.subtotal_cents)}`, `Envío: ${money(order.shipping_cents)}`, `Total: ${money(order.total_cents)}`, payment];
  return {subject, text:paragraphs.join('\n\n'), html:`<!doctype html><html lang="es"><body><h1>${escapeHtml(subject)}</h1>${paragraphs.slice(1).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}</body></html>`};
}
module.exports = { orderEmailTemplate };
