const User = require('../models/userModel.js');
const Profile = require('../models/profile.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const handleUserLogin = async (req,res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email in the database
    const user = await User.findOne({ email });

    // If the user does not exist, return an error
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If passwords do not match, return an error
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    //Find the user's profile to access the role
    const userProfile = await Profile.findOne({ user : user._id});

    // Generate a JWT token with the userId and isAdmin flag
    const tokenPayload = {
      userId: user._id,
      role: userProfile.role, //Include user's role in the token
    };
    const token = jwt.sign(tokenPayload, 'your-secret-key', { expiresIn: '1h' });

    // Return the token to the client
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

module.exports = {handleUserLogin};


