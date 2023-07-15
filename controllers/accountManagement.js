const Profile = require('../models/profile.js');
const jwt = require('jsonwebtoken');

const handleProfileUpdate = async (req, res) => {


  try{
    // Validate and sanitize the input data
    const { address, cellphone, role } = req.body;

    // Update the profile data with the new information
    profile.address = address;
    profile.cellphone = cellphone;
    profile.role = role;

    // Save the updated profile data2
    await profile.save();

    // Return a success response
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {handleProfileUpdate};