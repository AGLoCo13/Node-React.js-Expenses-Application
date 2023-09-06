const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const {handleNewUser} = require('../controllers/registerController');
const {handleUserLogin} = require('../controllers/loginController');
const updateController = require('../controllers/updateController.js');
const propertyController = require('../controllers/propertyController.js');
const expensesController = require('../controllers/expensesController');
const { authenticateUser, authorizeAdmin } = require('../middleware/authMiddleware');
const accountManagement = require('../controllers/accountManagement.js');
const paymentController = require('../controllers/paymentController');
const app = express();

//Use of multer library for the app to be able to upload receipts
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function(req , file , cb){
        cb(null , 'receipts/'); //save file to receipts folder
    },
    filename: function(req , file , cb){
        cb(null , `${Date.now()} - ${file.originalname}`)
    }
});
const upload = multer({storage:storage});

//**************Models import
const User = require('../models/userModel.js');
const Profile = require('../models/profile.js');
const Building = require('../models/building.js');
const Consumption = require('../models/consumption.js');
const Expense = require('../models/expenses.js');
const Payment = require('../models/payment.js');
const { TopologyDescription } = require('mongodb');
const Apartment = require('../models/apartment.js');

//**************Middleware
app.use(express.json());
//use the cors middleware
app.use(cors());


//***************API routes

//Route to get the logged-in user's profile

app.get("/api/profile" ,authenticateUser ,  async(req, res ) => {
   try {
    // Retrieve the User ID from the req.user object (set by the authenticateUser middleware)
    const userId = req.user.userId;

    // Find the user's profile based on the User ID
    const user = await User.findOne({_id: userId});
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const userData = {
        name: user.name,
        email: user.email,
        profileId : profile._id,
        userId : profile.user,
        address: profile.address,
        cellphone: profile.cellphone,
        role: profile.role,
    }

    // Return the user's profile as a response
    res.status(200).json(userData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
   }
);



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
// Define a route for administrator login
app.post('/api/admin/login', async (req, res) => {
    try {
       await handleUserLogin(req , res);
    } catch (error) {
      res.status(500).json({ error: 'Failed to log in as administrator' });
    }
  });
//Update admin information route
app.put('/api/admin/profile', authenticateUser , accountManagement.handleEditAdmin);
//Update tenant information route
app.put('/api/tenant/profile' , authenticateUser , accountManagement.handleEditAdmin);
//Update existing user Info route 
app.put('/api/users/:id' , updateController.updateUser);
//Delete existing user Info route 
app.delete('/api/users/:id',updateController.deleteUser);
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
                        
                        {/*BUILDING APIS */}


// Create an apartment building
app.post('/api/buildings', propertyController.createApartmentBuilding);

// Update an apartment building
app.put('/api/buildings/:id', propertyController.updateApartmentBuilding);

// Delete an apartment building
app.delete('/api/buildings/:id', propertyController.deleteApartmentBuilding);

                        {/*APARTMENT APIS */}


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

                        {/*EXPENSES APIS */}

//Create a new expense 
app.post('/api/expenses', upload.single('document') , expensesController.createExpense);
//Retrieve all expenses 
app.get('/api/expenses' , expensesController.getAllExpenses);
//Update an expense 
app.put('/api/expenses/:id' , expensesController.updateExpense);
//Delete an expense
app.delete('/api/expenses/:id' , expensesController.deleteExpense);


//Retrieve expenses based on building-administrator's profile id
app.get('/api/expenses/:profId', async (req ,res ) => {
    try {
        const profileId = req.params.profId;
        const expenses = await Expense.find({profile: profileId});

        if(!expenses) {
            return res.status(404).json({message : 'Expenses not found'})
        }
        res.status(200).json(expenses);
    }catch(error){
        console.error('Error retrieving expenses' , error);
        res.status(500).json({error: 'Failed to retrieve expenses'});
    }
    
});
                        {/* Payments API */}
    //Create new Payment
    app.post('/api/payments' , paymentController.createPayment);
    //Delete Payment
    app.delete('/api/payments' , paymentController.deletePayment);


            {/* ________________________________________ */}


//Get specific Apartment by the building they're tied to 
app.get('/aps/Apartments/:buildId' , async (req, res) => {
    try {
        const buildingId = req.params.buildId;
        const apartments = await Apartment.find({ building : buildingId});
        if (!apartments || apartments.length === 0) {
            return res.status(404).json({message: 'apartment not found'});
        }
        res.status(200).json(apartments);
    }catch(error){
        console.error('Error retrieving apartments:' , error);
        res.status(500).json({error: 'Failed to retrieve Apartment'});
    }
    }
);

//Get specific building by logged in user's profile id
app.get('/api/buildings/:profId', async (req,res) => {
    try {
        const profileId = req.params.profId;
        const building = await Building.findOne({ profile: profileId})
        .populate({
            path:"profile",
            populate:{
                path:"user",
                select:"name",
            },
        });
        if (!building) {
            return res.status(404).json({ message : 'Building not found'});
        }
        res.status(200).json(building);
    }catch(error){
        console.error('Error retrieving building:' , error);
        res.status(500).json({error: 'Failed to retrieve building'});
    }
    
});


app.get('/api/buildings' , async (req,res) => {
    try{
        const buildings = await Building.find().populate({path:"profile",
        populate:{
            path:"user",
            select:"name",
        },
    });
        res.status(200).json(buildings);
    }catch (error) {
        console.error("Error retrieving buildings:" , error);
        res.status(500).json({error: 'Failed to retrieve buildings'});
    }
    }
        //find users with the rol
    );


//Retrieve the list of Building administrators
app.get('/api/administrators' , async (req,res) => {
    try{
        //Find users with the role "admin" in the database 
        const administrators = await Profile.find({role:'Administrator'}).populate("user","name");
        //Return the list of administrators as a response 
        res.status(200).json({administrators});
    }catch (error) {
        console.error(error);
        res.status(500).json({error:"Failed to retrieve administrators"});
    }
    
});

//Retrieve the list of Tenants
app.get('/api/tenants' , async (req,res) => {
    try{
        //Find users with the role "Tenant" in the database 
        const tenants = await Profile.find({role:'Tenant'}).populate("user","name");
        //Return the list of tenants as a response
        res.status(200).json({tenants});
    }catch(error) {
        console.error(error);
        res.status(500).json({error:"Failed to retrieve tenants"})
    }
    
});
                          {/*CONSUMPTIONS APIS */}
//Endpoint to handle the input from the building administrator
app.post('/api/consumption', async (req,res) => {
    try {
        const {apartment , month , year , consumption } = req.body;
        //Check if the consumption data for the given apartment , month and year already exists
         const existingConsumption = await Consumption.findOne({apartment , month , year});

         if (existingConsumption){
            return res.status(409).json({message: "Consumption data already exists for this apartment and month"});
         }
        //Create da new consumption entry 
        const newConsumption = new Consumption ({ apartment , month , year , consumption});
        await newConsumption.save();
        res.status(201).json({message: 'Consumption data saved succesfully!'});
    }catch(error){
        console.error(error);
        res.status(500).json({message: 'An error occured while saving consumption data '});
    }
});
//get all consumptions
app.get('/api/consumptions' , async (req, res) => {
    try {
        const consumptions = await Consumption.find().populate("apartment","name");
        res.status(200).json({consumptions});
    }catch (error) {
        console.error(error);
        res.status(500).json({error: 'Failed to retrieve consumptions'});
    }
});
//get consumptions based on apartment's Id
app.get('/api/consumptions/:apartmentId' , async (req, res) => {
    try {
        const apartmentId = req.params.apartmentId;
        const consumptions = await Consumption.find({apartment : apartmentId}).populate("apartment", "name");

        if (!consumptions){
            return res.status(404).json({message : 'Consumptions not found'});
        }
        res.status(200).json(consumptions);
    }catch(error){
        console.error('Error retrieving consumptions:' , error);
        res.status(500).json({error: 'Failed to retrieve consumptions'});
    }
})


//***************connection to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/commons-db', {
    useNewUrlParser: true,
    useUnifiedTopology:true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((error) => console.error('Failed to connect to MongoDB:', error));

app.listen(5000, () => {console.log("Server started on port 5000")});
