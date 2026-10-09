const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeProductInput } = require('../src/domain/productInput');

test('product input stores the direct photo instead of a Google result page', () => {
  const photo = 'https://example.com/keyboard.jpg';
  const input = { nombre: 'Teclado', categoria: 'Tecnología', precio: 250, stock: 3 };
  assert.equal(normalizeProductInput({ ...input, imagen_url: `https://www.google.com/imgres?imgurl=${encodeURIComponent(photo)}` }).imagen_url, photo);
  assert.throws(() => normalizeProductInput({ ...input, imagen_url: 'https://www.google.com/imgres?imgurl=javascript%3Aalert(1)' }), { code: 'VALIDATION' });
});
