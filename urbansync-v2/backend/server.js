const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// ── Controllers & Middleware now live INSIDE backend/ ──────────────────────
const {handleNewUser} = require('./controllers/registerController');
const {handleUserLogin} = require('./controllers/loginController');
const updateController = require('./controllers/updateController.js');
const propertyController = require('./controllers/propertyController.js');
const expensesController = require('./controllers/expensesController');
const { authenticateUser, authorizeAdmin } = require('./middleware/authMiddleware');
const accountManagement = require('./controllers/accountManagement.js');
const paymentController = require('./controllers/paymentController');
const rabbitMQConsumer = require('./services/rabbitmq-consumer');
// Design Patterns
const {withRetry} = require('./resilience/retryHelper.js');
const app = express();
require('dotenv').config();
//Use of multer library for the app to be able to upload receipts
const multer = require('multer');
const multerS3 = require('multer-s3');
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

// MinIO storage configuration for direct cloud uploads
const {s3Client} = require('./config/minio.config.js');
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
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Models now live INSIDE backend/ ───────────────────────────────────────
const User = require('./models/userModel.js');
const Profile = require('./models/profile.js');
const Building = require('./models/building.js');
const Consumption = require('./models/consumption.js');
const Expense = require('./models/expenses.js');
const Payment = require('./models/payment.js');
const { TopologyDescription } = require('mongodb');
const Apartment = require('./models/apartment.js');

app.use(express.json());
//use the cors middleware

// CORS origin
app.use(cors({
    origin: process.env.CORS_ORIGIN
}));

// ═══════════════════════════════════════════════════════════════════════════
// KUBERNETES PROBES
// These routes are registered BEFORE all auth middleware so they are always
// reachable — even while the DB or message broker is still starting up.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LIVENESS PROBE  →  GET /health
 * Kubernetes uses this to decide whether to RESTART the container.
 * Question: "Is the Node.js process alive and the Express event-loop running?"
 * Answer:   Always 200 as long as the process hasn't crashed.
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

/**
 * READINESS PROBE  →  GET /ready
 * Kubernetes uses this to decide whether to SEND TRAFFIC to this pod.
 * Question: "Are ALL external dependencies reachable?"
 * Checks:
 *   1. MongoDB   — mongoose.connection.readyState === 1 (synchronous flag)
 *   2. RabbitMQ  — rabbitMQConsumer.isConnected getter (synchronous flag)
 *   3. MinIO     — bucketExists() lightweight async ping
 *
 * Returns 200 when all checks pass, 503 with a per-service breakdown otherwise.
 */
app.get('/ready', async (req, res) => {
    const checks = {};
    let allHealthy = true;

    // ── 1. MongoDB ────────────────────────────────────────────────────────
    // readyState values: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const mongoReady = mongoose.connection.readyState === 1;
    checks.mongodb = mongoReady ? 'UP' : 'DOWN';
    if (!mongoReady) allHealthy = false;

    // ── 2. RabbitMQ ───────────────────────────────────────────────────────
    // Reads the isConnected getter added to RabbitMQConsumer (no async call).
    // Returns false during reconnection windows (connection.on('close') fired).
    const mqReady = rabbitMQConsumer.isConnected;
    checks.rabbitmq = mqReady ? 'UP' : 'DOWN';
    if (!mqReady) allHealthy = false;

    // ── 3. MinIO ──────────────────────────────────────────────────────────
    // bucketExists() is the lightest call available — no data transfer,
    // just a HEAD request to the MinIO API. Times out fast on failure.
    try {
        await cloudService.minioClient.bucketExists(process.env.MINIO_BUCKET || 'receipts');
        checks.minio = 'UP';
    } catch (minioErr) {
        checks.minio = 'DOWN';
        allHealthy = false;
    }

    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'READY' : 'NOT_READY',
        timestamp: new Date().toISOString(),
        checks
    });
});

// ═══════════════════════════════════════════════════════════════════════════

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

/* Expenses Endpoint for AI data extraction from receipt — legacy path (kept for backward-compat) */
app.post('/api/expenses/extract-receipt-data', uploadMemory.single('receipt'), expensesController.extractDataFromReceipt);

/* Knative proxy endpoint — canonical path used by the frontend */
app.post('/api/expenses/knative-extract', authenticateUser, uploadMemory.single('receipt'), expensesController.extractDataFromReceipt);

//Create a new expense with MinIO upload
app.post('/api/expenses', uploadToMinio.single('document') , expensesController.createExpense);

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
        // Guard: reject non-ObjectId path segments (e.g. "knative-extract")
        if (!mongoose.Types.ObjectId.isValid(profileId)) {
            return res.status(400).json({ error: 'Invalid profile ID' });
        }
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
        
        // Authorization: Check if user has permission to view this receipt
        const userId = req.user.userId;
        const userProfile = await Profile.findOne({ user: userId });
        
        // Allow if: Admin, Building Administrator of the same building, or Tenant of same building
        const isAuthorized = 
            userProfile.role === 'Admin' || 
            expense.profile.user._id.toString() === userId.toString();
        
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to view this receipt' });
        }
        
        // Generate presigned URL for MinIO object (expires in 1 hour)
        const bucket = expense.documentBucket || 'receipts';
        const fileName = expense.document;
        
        try {
            const presignedUrl = await cloudService.getPresignedUrl(bucket, fileName, 3600);
            res.status(200).json({
            url:      presignedUrl,
            filename: expense.documentMetadata?.originalName || fileName,
            mimeType: expense.documentMetadata?.mimeType,
            size:     expense.documentMetadata?.size
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


// ============================================================
// MongoDB connection — Pattern: RETRY
// ============================================================
// Replaces the crude for-loop with withRetry() exponential
// back-off + jitter. Behaviour is identical but more robust:
//   - Jitter prevents thundering-herd after a cluster restart
//   - Back-off grows: 3s → 6s → 12s → 16s (capped)
//   - process.exit(1) on final failure (same as before)
// ============================================================
const dbURI = process.env.MONGODB_URI;

const connectWithRetry = async () => {
    await withRetry(async (bail) => {
        try {
            await mongoose.connect(dbURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                family: 4,
                serverSelectionTimeoutMS: 30000, // 5s timeout for initial connection
                socketTimeoutMS: 45000,          // 45s for all operations (queries, etc.)
            });
        } catch (err) {
            // Non-retryable: config error (bad URI, auth failure)
                if (err.name === 'MongoParseError' ||
                    err.message.includes('Authentication failed')) {
                    bail(err); // Stop retrying immediately
                    return;
                }
                throw err;   // Retryable: network errors, timeouts
        }
    },{
        retries: 10,
        minTimeout: 3000,  // 3s initial wait
        maxTimeout: 16000, // 16s cap
        factor: 2,         // Exponential back-off multiplier
        randomize: true,   // Add jitter to prevent thundering-herd
    }, 'MongoDB'
).then(() => {
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Server started on port ${PORT} (Database is Ready)`);
            console.log("🐰 Starting RabbitMQ Consumers...");
            rabbitMQConsumer.consumeAlarms(async (alarmData) => {
                console.log("🔥 ALARM RECEIVED IN BACKEND:", alarmData);
            });
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
    }).catch((err) => {
        console.error("💀 CRITICAL: Failed to connect to MongoDB after all retries:", err.message);
        process.exit(1);
    });
};

connectWithRetry();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await cloudService.shutdown();
    await mongoose.connection.close();
    process.exit(0);
});
