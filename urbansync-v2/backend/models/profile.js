// Profile Model
const mongoose = require('mongoose');
const profileSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    cellphone: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['Administrator', 'Tenant', 'Site-admin'],
      required: true,
    },
  });
  
  const Profile = mongoose.model('Profile', profileSchema);
  module.exports = Profile;