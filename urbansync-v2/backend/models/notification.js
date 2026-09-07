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
    // A6 - dedupe handle. One alarm transition (or one time window of raw
    // telemetry) yields at most one notification per user, even when RabbitMQ
    // redelivers the message or a second backend replica consumes it.
    // See services/alarmIngestion.js for how the key is built.
    dedupeKey: {
        type: String,
        required: false
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
// Unique per (user, dedupeKey): the insert IS the deduplication, so two
// concurrent consumers cannot both win. Sparse, so notifications without a key
// (e.g. future in-app messages) are unaffected.
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, sparse: true });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
