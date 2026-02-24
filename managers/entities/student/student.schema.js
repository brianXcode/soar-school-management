module.exports = {
    createStudent: [
        { model: 'text', path: 'firstName', required: true },
        { model: 'text', path: 'lastName', required: true },
        { model: 'email', path: 'email', required: true },
    ],
    updateStudent: [
        { model: 'text', path: 'firstName', required: false },
        { model: 'text', path: 'lastName', required: false },
    ],
};
