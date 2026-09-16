/**
 * Idempotent Device seed (B3).
 * Run:  node backend/scripts/seedDevices.js
 * Ασφαλές να ξανατρέξει — upsert πάνω στο deviceId, ποτέ διπλότυπα.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/building');
const Apartment = require('../models/apartment');
const Device = require('../models/device');

// Προσάρμοσε το apartmentName ώστε να ταιριάζει με το πραγματικό Apartment.name
// στη βάση σου (αν δεν βρεθεί, το script σου λέει ποια names υπάρχουν).
const THERMOSTATS = [
  { apartmentName: 'B1', deviceId: 'Ap1 Thermostat', name: 'Θερμοστάτης Διαμ. B1' },
  { apartmentName: 'C1', deviceId: 'Ap2 Thermostat', name: 'Θερμοστάτης Διαμ. C1' },
  { apartmentName: 'Α1', deviceId: 'Ap3 Thermostat', name: 'Θερμοστάτης Διαμ. Α1' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const building = await Building.findOne();
  if (!building) {
    console.warn('⚠️  Κανένα Building δεν βρέθηκε — seed του fuel-tank παραλείπεται.');
  } else {
    await Device.findOneAndUpdate(
      { deviceId: 'Building A Fuel Tank' },
      { deviceId: 'Building A Fuel Tank', name: 'Δεξαμενή Καυσίμου Κτιρίου', kind: 'fuel-tank', building: building._id },
      { upsert: true, new: true }
    );
    console.log(`✅ Fuel tank device -> building ${building._id}`);
  }

  const allApartments = await Apartment.find({}, 'name');
  for (const t of THERMOSTATS) {
    const apartment = await Apartment.findOne({ name: t.apartmentName });
    if (!apartment) {
      console.warn(`⚠️  Apartment name="${t.apartmentName}" δεν βρέθηκε. Υπάρχοντα names: ${allApartments.map(a => a.name).join(', ')}`);
      continue;
    }
    await Device.findOneAndUpdate(
      { deviceId: t.deviceId },
      { deviceId: t.deviceId, name: t.name, kind: 'thermostat', apartment: apartment._id },
      { upsert: true, new: true }
    );
    console.log(`✅ ${t.deviceId} -> apartment ${apartment._id} (${t.apartmentName})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });