module.exports = {
    createSchool: [
        { model: 'longText', path: 'name', required: true },
        { model: 'longText', path: 'address', required: true },
    ],
    updateSchool: [
        { model: 'longText', path: 'name', required: false },
        { model: 'longText', path: 'address', required: false },
    ],
};
