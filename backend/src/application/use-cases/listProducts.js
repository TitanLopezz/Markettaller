const createListProducts = ({ productRepository }) => async () => productRepository.findAll();

module.exports = { createListProducts };
