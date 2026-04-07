const Profile = require('../models/profile.js');
const jwt = require('jsonwebtoken');
const User = require ('../models/userModel.js');


const handleEditAdmin = async (req, res) => {
  try{

    // Get the user ID from the JWT token
    const userId = req.user.id;


    //Validate and sanitize the input data
    const {name , email , address , cellphone } = req.body;
    
       //update the user and profile data with the new info
      const user = await User.findByIdAndUpdate(
        userId,
        {name, email },
        {new: true}
      );

      //Update the profile data with the new information 
      const profile = await Profile.findOneAndUpdate(
        {user: userId},
        {address, cellphone},
        {new: true}  // This option returns the updated profile after the update
      );
      //Return a success response with the updated user and profile
      res.status(200).json({message: 'Admin updated succesfully', user , profile});
  }catch (error){
    console.error(error);
    res.status(500).json({error: "Failed to update admin"});
  }

}

module.exports = {handleEditAdmin};