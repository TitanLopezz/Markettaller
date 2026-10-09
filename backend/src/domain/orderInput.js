const parsePositiveId = (value, label) => {
  if (value === '' || value === null || value === undefined) {
    const error = new Error(`${label} no es válido.`);
    error.code = 'VALIDATION';
    throw error;
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    const error = new Error(`${label} no es válido.`);
    error.code = 'VALIDATION';
    throw error;
  }
  return id;
};

module.exports = { parsePositiveId };
