const User = require('../models/userModel');
const Profile = require('../models/profile');

// Update user handler
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id; // Extract the user ID from the request parameters
    const { address, cellphone, role } = req.body; // Extract the updated fields from the request body

    // Find the user by ID
    console.log(userId);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user's information
    user.address = address;
    user.cellphone = cellphone;
    user.role = role;

    // Save the updated user
    await user.save();

    // Find the profile by User ID
    const profile = await Profile.findOne({ user: userId});
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Update the profile's information
    profile.address = address;
    profile.cellphone = cellphone;
    profile.role = role;

    // Save the updated profile
    await profile.save();

    res.json({ message: 'User and profile updated successfully', user, profile });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const deleteUser = async (req,res) => {
    try {
      const userId = req.params.id; 
      await User.findByIdAndDelete(userId);
      await Profile.findOneAndDelete({ user: userId });
  
      res.json({ message: 'User and profile deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
  updateUser,
  deleteUser,
};