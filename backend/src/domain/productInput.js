const normalizeProductInput = (input = {}) => {
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  const descripcion = typeof input.descripcion === 'string' ? input.descripcion.trim() : '';
  const categoria = typeof input.categoria === 'string' ? input.categoria.trim() : '';
  let imagenUrl = typeof input.imagen_url === 'string' ? input.imagen_url.trim() : '';
  const precio = Number(input.precio);
  const stock = Number(input.stock);

  if (imagenUrl) {
    let parsedImageUrl;
    try {
      parsedImageUrl = new URL(imagenUrl);
      if (/^(www\.)?google\.[a-z.]+$/.test(parsedImageUrl.hostname) && parsedImageUrl.pathname === '/imgres') {
        const direct = parsedImageUrl.searchParams.get('imgurl');
        if (direct) {
          parsedImageUrl = new URL(direct);
          imagenUrl = parsedImageUrl.href;
        }
      }
    } catch {
      parsedImageUrl = null;
    }

    if (!parsedImageUrl || !['http:', 'https:'].includes(parsedImageUrl.protocol)) {
      const error = new Error('La URL de imagen debe usar HTTP o HTTPS.');
      error.code = 'VALIDATION';
      throw error;
    }
  }

  if (!nombre || !categoria || input.precio === '' || input.precio === undefined) {
    const error = new Error('Nombre, precio y categoría son obligatorios.');
    error.code = 'VALIDATION';
    throw error;
  }

  if (!Number.isFinite(precio) || precio < 0) {
    const error = new Error('El precio debe ser un número mayor o igual a cero.');
    error.code = 'VALIDATION';
    throw error;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    const error = new Error('El stock debe ser un entero mayor o igual a cero.');
    error.code = 'VALIDATION';
    throw error;
  }

  return {
    nombre,
    descripcion,
    precio,
    categoria,
    imagen_url: imagenUrl || null,
    stock,
  };
};

const parseProductId = (id) => {
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) {
    const error = new Error('El identificador de producto no es válido.');
    error.code = 'VALIDATION';
    throw error;
  }
  return productId;
};

module.exports = { normalizeProductInput, parseProductId };
