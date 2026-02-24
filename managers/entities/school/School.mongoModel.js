const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100,
    },
    address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    phone: {
        type: String,
        trim: true,
        maxlength: 20,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 100,
    },
    website: {
        type: String,
        trim: true,
        maxlength: 200,
    },
    established: {
        type: Date,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 2000,
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
schoolSchema.index({ name: 1 });
schoolSchema.index({ createdBy: 1 });
schoolSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('School', schoolSchema);
