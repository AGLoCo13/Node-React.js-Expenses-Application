const mongoose = require('mongoose');

// Χρησιμοποιούμε 127.0.0.1 αντί για localhost
const uri = "mongodb://root:rootpassword@127.0.0.1:27017/urbansync?authSource=admin&directConnection=true";

console.log("⏳ Trying to connect to MongoDB...");

mongoose.connect(uri)
  .then(() => {
    console.log("✅ SUCCESS! Connected to MongoDB!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ FAILED:", err.message);
    process.exit(1);
  });
