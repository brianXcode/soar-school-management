module.exports = {
    createClassroom: [
        { model: 'longText', path: 'name', required: true },
        { model: 'number', path: 'capacity', required: true },
    ],
    updateClassroom: [
        { model: 'longText', path: 'name', required: false },
        { model: 'number', path: 'capacity', required: false },
    ],
};
