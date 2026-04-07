// Building Model
const mongoose = require('mongoose');
const buildingSchema = new mongoose.Schema({
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    floors:  {
      type: Number,
      required: true,
    },
    apartments: {
      type: Number,
      required: true,
    },
    reserve: {
      type: String,
      required: true,
    },
  });
  
  const Building = mongoose.model('Building', buildingSchema);
  module.exports = Building;