const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 1000,
    },
    resources: [{
        type: String,
        trim: true,
    }],
    grade: {
        type: String,
        trim: true,
        maxlength: 20,
    },
    section: {
        type: String,
        trim: true,
        maxlength: 10,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

// Indexes
classroomSchema.index({ school: 1 });
classroomSchema.index({ school: 1, name: 1 }, { unique: true });
classroomSchema.index({ createdBy: 1 });
classroomSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
