// Payment Model
const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
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
    total_heating: {
      type: Number,
      required: true,
    },
    total_elevator: {
      type: Number,
      required: true,
    },
    total_general: {
      type: Number,
      required: true,
    },
    payment_made: {
      type: Boolean,
      required: true,
    },
  });
  
  const Payment = mongoose.model('Payment', paymentSchema);
  module.exports = Payment;