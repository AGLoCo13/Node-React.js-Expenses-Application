const Profile = require('../models/profile.js');
const User = require('../models/userModel.js');
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const handleNewUser = async (req, res) => {
  const { name, email, password , address, cellphone, role } = req.body;
  if (!name || !email || !password || !address || !cellphone || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

   // Validate email
   if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  // Validate password
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

    // Encrypt the password
    const hashedPwd = await bcrypt.hash(password, 10);

    //Create a new user instance
    const newUser = new User({
      name,
      email,
      password: hashedPwd,
    });

    //Save the new user to the database
    await newUser.save();

    try{
      // Check for duplicate usernames in the db
      const existingProfile = await Profile.findOne({ user: newUser._id }).exec();
      if (existingProfile) {
        return res.status(409).json({ message: 'Profile already exists for this user' });
      }

    //Create a new profile instance
    const newProfile = new Profile({
      user: newUser._id,
      address,
      cellphone,
      role,
    });


    // Save the new profile to the database
    await newProfile.save();

    //Generate a JWT token
    const token = jwt.sign({ userId: newUser._id} , 'yourSecretKey',{expiresIn: '1h'});

    // User registration successful
    res.status(200).json({ message: 'User registered successfully',token });
  } catch (error) {
    // Log the error for debugging purposes
    console.error(error);
    // Error occurred while saving the profile
    res.status(500).json({ error: 'Failed to register user' });
  }
};

module.exports = { handleNewUser };