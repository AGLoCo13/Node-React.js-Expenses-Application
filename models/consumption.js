// Consumption Model
const mongoose = require('mongoose')
const consumptionSchema = new mongoose.Schema({
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: true,
    },
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    consumption: {
      type: Number,
      required: true,
    },
  });
  
  const Consumption = mongoose.model('Consumption', consumptionSchema);
  module.exports = Consumption;