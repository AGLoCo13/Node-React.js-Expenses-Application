const mongoose = require('mongoose');
const User = require('../models/userModel.js');
const Building = require('../models/building.js');

const dbURI = "mongodb://root:rootpassword@127.0.0.1:27017/commons-db?authSource=admin&directConnection=true";

console.log("⏳ Testing MongoDB connection...");

mongoose.connect(dbURI, { 
    family: 4,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(async () => {
    console.log('✅ MongoDB Connected!');
    
    // Test 1: Count users
    const userCount = await User.countDocuments();
    console.log(`✅ Users in DB: ${userCount}`);
    
    // Test 2: Find one user
    const user = await User.findOne();
    console.log(`✅ Sample user: ${user ? user.name : 'No users found'}`);
    
    // Test 3: Count buildings
    const buildingCount = await Building.countDocuments();
    console.log(`✅ Buildings in DB: ${buildingCount}`);
    
    // Test 4: Find buildings
    const buildings = await Building.find();
    console.log(`✅ Retrieved ${buildings.length} buildings`);
    
    console.log('\n🎉 ALL TESTS PASSED! Backend can communicate with database!');
    
    await mongoose.connection.close();
    process.exit(0);
})
.catch((error) => {
    console.error('❌ CONNECTION ERROR:', error);
    process.exit(1);
});
