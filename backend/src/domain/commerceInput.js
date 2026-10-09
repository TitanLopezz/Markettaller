const {fail}=require('./errors');
const text = (value, label, max, min = 1) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(`${label}: longitud inválida.`);
  return value.trim();
};
const positiveId = (value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw fail('Identificador inválido.');
  return id;
};
const addressInput = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Dirección inválida.');
  const address = {
    recipient: text(input.recipient, 'Destinatario', 120),
    phone: text(input.phone, 'Teléfono', 20),
    street: text(input.street, 'Calle y número', 200),
    district: text(input.district, 'Colonia', 120),
    city: text(input.city, 'Ciudad', 120),
    state: text(input.state, 'Estado', 120),
    postal_code: text(input.postal_code, 'Código postal', 5, 5),
    country: 'MX',
  };
  if (!/^\d{5}$/.test(address.postal_code) || !/^\+?[\d\s()-]{10,20}$/.test(address.phone)) throw fail('Teléfono o código postal inválido.');
  return address;
};
const checkoutInput = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Pedido inválido.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) throw fail('El carrito debe tener entre 1 y 50 productos.');
  const ids = new Set();
  const items = input.items.map(item => {
    const product_id = positiveId(item?.product_id);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || ids.has(product_id)) throw fail('Cantidades inválidas o productos repetidos.');
    ids.add(product_id);
    return { product_id, quantity };
  }).sort((a,b)=>a.product_id-b.product_id);
  const address = addressInput(input.address);
  if (!['contra_entrega', 'transferencia'].includes(input.payment_method)) throw fail('Método de pago inválido.');
  const request_key = text(input.request_key, 'Clave del pedido', 64, 16);
  if (!/^[a-zA-Z0-9_-]+$/.test(request_key)) throw fail('Clave del pedido inválida.');
  const data = {items,address,payment_method:input.payment_method};
  return {...data,request_key};
};
const toCents = (price) => {
  const parts = String(price).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!parts) throw fail('Precio de producto inválido.', 'CONFLICT');
  const cents = Number(parts[1]) * 100 + Number((parts[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw fail('Precio fuera de rango.', 'CONFLICT');
  return cents;
};
module.exports = { fail, text, positiveId, addressInput, checkoutInput, toCents };
