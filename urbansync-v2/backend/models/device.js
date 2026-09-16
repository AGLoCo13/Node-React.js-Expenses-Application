// Device Model (B3)
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
      type: String,        // ακριβές όνομα device στο ThingsBoard, π.χ. "Ap1 Thermostat"
      required: true,
      unique: true,
    },
    name: {
      type: String,        // ανθρώπινο label, π.χ. "Θερμοστάτης Διαμ. 101"
      required: true,
    },
    kind: {
      type: String,
      enum: ['thermostat', 'fuel-tank'],
      required: true,
    },
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
    },
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
    },
    lastSeenAt: {
      type: Date,           // ενημερώνεται σε κάθε επιτυχές telemetry read
    },
  });

const Device = mongoose.model('Device', deviceSchema);
module.exports = Device;