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
const rabbitMQConsumer = require('./services/rabbitmq-consumer');
const app = express();
require('dotenv').config();
//Use of multer library for the app to be able to upload receipts
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const cloudService = require('./services/cloudService');

const storage = multer.diskStorage({
    destination: function(req , file , cb){
        cb(null , 'receipts/'); //save file to receipts folder
    },
    filename: function(req , file , cb){
        cb(null , `${Date.now()} - ${file.originalname}`)
    }
});
const upload = multer({storage:storage});

// Create AWS SDK v3 S3Client for MinIO (for multer-s3 compatibility)
const s3Client = new S3Client({
    endpoint: `http://${process.env.MINIO_ENDPOINT || 'minio'}:${process.env.MINIO_PORT || '9000'}`,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'password123'
    },
    forcePathStyle: true // Required for MinIO
});

// MinIO storage configuration for direct cloud uploads
const minioStorage = multerS3({
    s3: s3Client,
    bucket: process.env.MINIO_BUCKET || 'receipts',
    metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, fileName);
    }
});
const uploadToMinio = multer({ storage: minioStorage });

const User = require('../models/userModel.js');
const Profile = require('../models/profile.js');
const Building = require('../models/building.js');
const Consumption = require('../models/consumption.js');
const Expense = require('../models/expenses.js');
const Payment = require('../models/payment.js');
const { TopologyDescription } = require('mongodb');
const Apartment = require('../models/apartment.js');

app.use(express.json());
//use the cors middleware

// CORS origin
app.use(cors({
    origin: process.env.CORS_ORIGIN
}));

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

//Fetch apartment details based on the Tenant's id :
app.get('/api/apartment/:tenantId' , async (req , res) => {
    try {
        const tenantId = req.params.tenantId;
        const apartment = await Apartment.findOne({ tenant : tenantId});

        if ( !apartment) {
            return res.status(404).json({message: "Apartment not found."})
        }
        res.status(200).json(apartment);
    }catch(error) {
        console.error("Error fetching apartment data:" , error);
        res.status(500).json({error: "Failed to retrieve apartment data."})
    }    

})

                        {/*EXPENSES APIS */}

//Create a new expense with MinIO upload
app.post('/api/expenses', uploadToMinio.single('document') , expensesController.createExpense);
//Retrieve all expenses 
app.get('/api/expenses' , expensesController.getAllExpenses);
//Update an expense 
app.put('/api/expenses/:id' , expensesController.updateExpense);
//Delete an expense
app.delete('/api/expenses/:id' , expensesController.deleteExpense);

//Upload receipt directly to MinIO
app.post('/api/upload-receipt', authenticateUser, uploadToMinio.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = req.file.location || 
            `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${req.file.bucket}/${req.file.key}`;

        res.status(200).json({
            message: 'Receipt uploaded successfully to MinIO',
            file: {
                filename: req.file.key,
                bucket: req.file.bucket,
                size: req.file.size,
                url: fileUrl,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('Error uploading receipt to MinIO:', error);
        res.status(500).json({ error: 'Failed to upload receipt' });
    }
});

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

// Get building expenses for tenant
app.get('/api/tenant/building-expenses', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userProfile = await Profile.findOne({ user: userId });
        
        if (!userProfile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        // Check if user is a tenant
        if (userProfile.role !== 'Tenant') {
            return res.status(403).json({ error: 'Only tenants can access this endpoint' });
        }
        
        // Find tenant's apartment
        const apartment = await Apartment.findOne({ tenant: userProfile._id }).populate('building');
        
        if (!apartment || !apartment.building) {
            return res.status(404).json({ error: 'Apartment or building not found' });
        }
        
        // Get building details
        const building = await Building.findById(apartment.building._id);
        
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        
        // Find all expenses for this building's administrator
        const expenses = await Expense.find({ profile: building.profile }).sort({ date_created: -1 });
        
        res.status(200).json(expenses);
        
    } catch (error) {
        console.error('Error retrieving building expenses:', error);
        res.status(500).json({ error: 'Failed to retrieve building expenses' });
    }
});

// Get receipt file from MinIO for a specific expense
app.get('/api/expenses/:expenseId/receipt', authenticateUser, async (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        
        // Find the expense
        const expense = await Expense.findById(expenseId).populate({
            path: 'profile',
            populate: { path: 'user' }
        });
        
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        
        if (!expense.document) {
            return res.status(404).json({ error: 'No receipt attached to this expense' });
        }
        
        // Get current user info
        const userId = req.user.userId;
        const userProfile = await Profile.findOne({ user: userId });
        
        // Authorization check with null safety
        let isAuthorized = false;
        
        if (userProfile && userProfile.role === 'Admin') {
            // Admins can always view receipts
            isAuthorized = true;
        } else if (userProfile && userProfile.role === 'Tenant') {
            // Tenants can view receipts from their building's administrator
            try {
                const apartment = await Apartment.findOne({ tenant: userProfile._id }).populate('building');
                if (apartment && apartment.building) {
                    const building = await Building.findById(apartment.building._id);
                    if (building && expense.profile && building.profile.toString() === expense.profile._id.toString()) {
                        isAuthorized = true;
                    }
                }
            } catch (err) {
                console.error('Error checking tenant authorization:', err);
            }
        } else if (expense.profile && expense.profile.user) {
            // Check if user is the expense owner (Building Administrator)
            isAuthorized = expense.profile.user._id.toString() === userId.toString();
        } else {
            // If expense has no profile/user, allow viewing (orphaned expense)
            console.warn(`Expense ${expenseId} has missing profile/user - allowing access`);
            isAuthorized = true;
        }
        
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to view this receipt' });
        }
        
        // Generate presigned URL for MinIO object (expires in 1 hour)
        const bucket = expense.documentBucket || 'receipts';
        const fileName = expense.document;
        
        try {
            // Use external client so the presigned URL signature matches the external endpoint
            const presignedUrl = await cloudService.minioClientExternal.presignedGetObject(bucket, fileName, 3600);
            
            res.status(200).json({
                url: presignedUrl,
                filename: expense.documentMetadata?.originalName || fileName,
                mimeType: expense.documentMetadata?.mimeType,
                size: expense.documentMetadata?.size
            });
        } catch (minioError) {
            console.error('MinIO presigned URL error:', minioError);
            res.status(500).json({ error: 'Failed to generate receipt access link' });
        }
        
    } catch (error) {
        console.error('Error retrieving receipt:', error);
        res.status(500).json({ error: 'Failed to retrieve receipt' });
    }
});
                        {/* Payments API */}
    //Create new Payment
    app.post('/api/payments' , paymentController.createPayment);
    //Delete Payment
    app.delete('/api/payments/:paymentId' , paymentController.deletePayment);
    //Get payments tied to specific apartment
    app.get('/api/payments/:apartmentId' , paymentController.getPaymentById);
    //Update payment as Completed 
    app.put('/api/payments/:paymentId', paymentController.markPaymentAsCompleted);


            {/* ________________________________________ */}


//Get specific Apartment by the building they're tied to 
app.get('/api/apartments/building/:buildId' , async (req, res) => {
    try {
        const buildingId = req.params.buildId;
        const apartments = await Apartment.find({ building : buildingId})
            .populate({
                path: 'tenant',
                populate: {
                    path: 'user',
                    select: 'name'
                }
            });
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

//Retrieve buildings that are stored
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


// ========================================================
// ΤΕΛΙΚΗ ΔΙΟΡΘΩΣΗ ΣΥΓΧΡΟΝΙΣΜΟΥ
// ============================================================
// MongoDB connection with Retry Logic
// ============================================================
// ΛΥΣΗ ΓΙΑ PM2/DOCKER TIMING ISSUES
// ============================================================
const dbURI = "mongodb://mongodb:27017/urbansync";

const connectWithRetry = async () => {
    const connect = async (dbURI) => {
        return mongoose.connect(dbURI, {
	    useNewUrlParser: true,
	    useUnifiedTopology:true,	
            family: 4,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
    };

    const maxRetries = 10;
    const retryDelay = 3000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`⏳ Προσπάθεια σύνδεσης MongoDB (${i + 1}/${maxRetries})...`);
            await connect(dbURI);
            const PORT = process.env.PORT || 5000;
            app.listen(PORT, () => {
                console.log(`🚀 Server started on port ${PORT} (Database is Ready)`);
		console.log("🐰 Starting RabbitMQ Consumers...");
                
                // Consume IoT alarms from Thingsboard
                rabbitMQConsumer.consumeAlarms(async (alarmData) => {
                    console.log("🔥 ALARM RECEIVED IN BACKEND:", alarmData);
		});
                
                // Consume MinIO receipt events
                rabbitMQConsumer.consumeReceipts(async (event) => {
                    const record = event.Records?.[0];
                    const fileName = record?.s3?.object?.key;
                    const bucket = record?.s3?.bucket?.name;
                    const eventName = record?.eventName;
                    console.log("📄 RECEIPT EVENT FROM MINIO:", {
                        bucket,
                        file: fileName,
                        event: eventName,
                        timestamp: new Date().toISOString()
                    });
                });
            });
            return;
        } catch (error) {
            console.error(`❌ Αποτυχία σύνδεσης (${i + 1}/${maxRetries}):`, error.message);
            if (i === maxRetries - 1) {
                console.error("💀 CRITICAL: Αποτυχία σύνδεσης μετά από όλες τις προσπάθειες");
                console.error("Βεβαιώσου ότι το MongoDB container τρέχει: docker ps | grep mongodb");
                process.exit(1);
            }
            console.log(`⏰ Αναμονή ${retryDelay/1000} δευτερόλεπτα...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

// Start connection with retry logic
connectWithRetry();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await cloudService.shutdown();
    await mongoose.connection.close();
    process.exit(0);
});

