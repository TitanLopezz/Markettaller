const createListPendingUsers = ({ userRepository }) => async () => userRepository.findPending();

module.exports = { createListPendingUsers };
