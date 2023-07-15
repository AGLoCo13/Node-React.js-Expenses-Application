const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const {handleNewUser} = require('../controllers/registerController');
const {handleUserLogin} = require('../controllers/loginController');
const {handleProfileUpdate}  = require('../controllers/accountManagement');
const updateController = require('../controllers/updateController.js');
const propertyController = require('../controllers/propertyController.js');
const { extractUserId, authenticateUser, authorizeAdmin } = require('../middleware/authMiddleware');
const app = express();

//Models import
const Profile = require('../models/profile.js');
const Building = require('../models/building.js');
const Apartment = require('../models/consumption.js');
const Expense = require('../models/expenses.js');
const Payment = require('../models/payment.js');
const Consumption = require('../models/consumption.js');
const { TopologyDescription } = require('mongodb');
const User = require('../models/userModel');
//Middleware
app.use(express.json());
//use the cors middleware
app.use(cors());
//API routes
app.get("/api", (req, res ) => {
    res.json({"users": ["userOne", "userTwo", "userThree"]});
})



//User registration route
app.post('/api/register', async(req,res) => {
    try{
        await handleNewUser(req,res);
    }catch (error) {
        res.status(500).json({error:'Failed to register user'});
    }
    
    
});

//user login route
app.post('/api/login', async(req,res) => {
    try {
        await handleUserLogin(req, res);
    }catch (error) {
        res.status(500).json({error: 'Failed to log in'});
    }
});

//account Management route
/*
app.put('/api/profile',extractUserId, async(req,res) => {
    try{
        await handleProfileUpdate(req, res);
    }catch (error){
        res.status(500).json({error: 'Failed to update profile'});
    }
    
});
*/

app.put('/api/users/:id' , updateController.updateUser);

//Retrieve the list of Users route
app.get('/api/users',async(req,res)=>{
    try {
        //Retrieve the list of users from the database
        const users = await User.find();
        //Return the list of users as a response
        res.status(200).json(users);
    }catch (error) {
        console.error(error);
        res.status(500).json({error:'Failed to retrieve users'});
    }
    });
// Admin Dashboard route
app.get('/api/dashboard', authorizeAdmin , async(req, res) => {
    // Retrieve the user ID from the request object
    const userId = req.user.userId;
  
    // Find the user by ID in the database
    User.findById(userId)
      .then((user) => {
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
  
        // Return the user's dashboard data
        res.json({ user });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve user dashboard' });
      });
  });

// Create an apartment building
app.post('/api/buildings', propertyController.createApartmentBuilding);

// Update an apartment building
app.put('/api/buildings/:id', propertyController.updateApartmentBuilding);

// Delete an apartment building
app.delete('/api/buildings/:id', propertyController.deleteApartmentBuilding);

// Create a new apartment
app.post('/api/apartments', propertyController.createApartment);

// Get all apartments
app.get('/api/apartments', propertyController.getAllApartments);

// Get a specific apartment by ID
app.get('/api/apartments/:id', propertyController.getApartmentById);

// Update an apartment
app.put('/api/apartments/:id', propertyController.updateApartment);

// Delete an apartment
app.delete('/api/apartments/:id', propertyController.deleteApartment);

app.get('/api/buildings' , async (req,res) => {
    try{
        const buildings = await Building.find();
        res.status(200).json(buildings);
    }catch (error) {
        console.error("Error retrieving buildings:" , error);
        res.status(500).json({error: 'Failed to retrieve buildings'});
    }
    }
        //find users with the rol
    );


//Retrieve the list of administrators
app.get('/api/administrators' , async (req,res) => {
    try{
        //Find users with the role "admin" in the database 
        const administrators = await Profile.find({role:'Administrator'});
        //Return the list of administrators as a response 
        res.status(200).json({administrators});
    }catch (error) {
        console.error(error);
        res.status(500).json({error:"Failed to retrieve administrators"});
    }
    
});
//connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/commons-db', {
    useNewUrlParser: true,
    useUnifiedTopology:true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((error) => console.error('Failed to connect to MongoDB:', error));

app.listen(5000, () => {console.log("Server started on port 5000")});
