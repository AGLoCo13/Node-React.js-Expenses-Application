// Expenses Model
const mongoose = require('mongoose');
const expenseSchema = new mongoose.Schema({
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    date_created: {
      type: Date,
      default: Date.now,
    },
    document: {
      type: String,
    },
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    type_expenses: {
      type: String,
      enum: ['Heating', 'Elevator', 'General'],
      required: true,
    },
  });

  const Expense = mongoose.model('Expense', expenseSchema);
  module.exports = Expense;