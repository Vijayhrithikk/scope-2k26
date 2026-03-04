const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    name: String,
    year: String,
    branch: String,
    phone: String,
    rollNumber: String
});

const registrationSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    teamLead: { type: String, required: true },
    teamSize: { type: Number, required: true },
    email: { type: String, required: true },
    transactionId: { type: String, required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
    teamId: { type: String, default: '' },
    members: [memberSchema],
    registeredAt: { type: Date, default: Date.now },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null }
});

module.exports = mongoose.model('Registration', registrationSchema);
