const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    building: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Building',
        required: false
    },
    apartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Apartment',
        required: false
    },
    type: {
        type: String,
        enum: ['low_fuel', 'high_temperature', 'battery_low', 'sensor_offline', 'general_alarm', 'other'],
        default: 'general_alarm'
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },
    message: {
        type: String,
        required: true
    },
    thingsboardData: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    isRead: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ user: 1, isRead: 1, timestamp: -1 });
notificationSchema.index({ building: 1, timestamp: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
