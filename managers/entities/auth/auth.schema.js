module.exports = {
    register: [
        { model: 'username', required: true },
        { model: 'email', required: true },
        { model: 'password', required: true },
    ],
    login: [
        { model: 'email', required: true },
        { model: 'password', required: true },
    ],
};
