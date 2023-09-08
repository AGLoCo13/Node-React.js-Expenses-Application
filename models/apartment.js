// Apartment Model
const mongoose = require('mongoose');
const apartmentSchema = new mongoose.Schema({
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    name: {
      type: String,
      required : true,
    },
    floor: {
      type: Number,
      required: true,
    },
    square_meters: {
      type: Number,
      required: true,
    },
    owner: {
      type: Boolean,
      required: true,
    },
    fi: {
      type: Number,
      required: true,
    },
    heating: {
      type: Number,
      required: false,
    },
    elevator: {
      type: Number,
      required: false,
    },
    general_expenses: {
      type: Number,
      required: false,
    },
  });

  const Apartment = mongoose.model('Apartment', apartmentSchema);
  module.exports = Apartment;