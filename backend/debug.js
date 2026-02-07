const mongoose = require('mongoose');

// Το connection string σου
const uri = "mongodb://root:rootpassword@127.0.0.1:27017/commons-db?authSource=admin&directConnection=true";

// Φτιάχνουμε ένα πρόχειρο μοντέλο για να τραβήξουμε δεδομένα
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');

console.log("⏳ Προσπάθεια σύνδεσης και ανάγνωσης...");

mongoose.connect(uri, { family: 4 }) // <--- ΠΡΟΣΘΕΣΑΜΕ ΤΟ family: 4 ΓΙΑ ΝΑ FORCAROYME IPv4
  .then(async () => {
    console.log("✅ Σύνδεση ΟΚ. Προσπάθεια εύρεσης χρήστη...");
    
    // Προσπάθεια να φέρουμε δεδομένα (εδώ τρώμε το timeout συνήθως)
    const user = await User.findOne({});
    
    console.log("🔎 Αποτέλεσμα Query:", user ? "Βρέθηκε χρήστης!" : "Δεν βρέθηκε χρήστης (αλλά η βάση δουλεύει)");
    console.log("🎉 ΤΕΛΟΣ. Η βάση και το Mongoose δουλεύουν άψογα.");
    process.exit(0);
  })
  .catch(err => {
    console.log("❌ ΣΦΑΛΜΑ:");
    console.log(err);
    process.exit(1);
  });