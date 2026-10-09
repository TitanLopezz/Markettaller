import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeImageUrl, validateImageUrl } from './imageUrl.js'

test('extracts the photo from Google results and preserves direct image URLs', () => {
  const photo = 'https://example.com/keyboard.jpg?size=800'
  assert.equal(normalizeImageUrl(`https://www.google.com/imgres?imgurl=${encodeURIComponent(photo)}`), photo)
  assert.equal(normalizeImageUrl(`  ${photo}  `), photo)
  assert.equal(normalizeImageUrl('https://other.com/imgres?imgurl=x'), 'https://other.com/imgres?imgurl=x')
})

test('checks image loading before allowing a URL to be saved', async () => {
  const previous = globalThis.Image
  try {
    globalThis.Image = class {
      naturalWidth = 100
      set src(value) {
        queueMicrotask(() => value.endsWith('.jpg') ? this.onload() : this.onerror())
      }
    }
    assert.equal(await validateImageUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg')
    await assert.rejects(validateImageUrl('https://example.com/page'), /No se pudo cargar/)
    await assert.rejects(validateImageUrl('javascript:alert(1)'), /HTTP o HTTPS/)
    assert.equal(await validateImageUrl(''), '')
  } finally {
    if (previous === undefined) delete globalThis.Image
    else globalThis.Image = previous
  }
})
