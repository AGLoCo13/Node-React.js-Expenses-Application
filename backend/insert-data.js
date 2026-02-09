// insert-data.js
const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017';
const dbName = 'urbansync';

async function main() {
  const client = new MongoClient(url);
  try {
    await client.connect();
    console.log('Connected successfully to server');
    const db = client.db(dbName);
    const collection = db.collection('users');

    // Διαγραφή υπαρχόντων εγγραφών (προαιρετικά)
    await collection.deleteMany({});

    // Εισαγωγή των χρηστών
    const users = [
      {
        name: 'SiteAdmin',
        email: 'admin@example.com',
        password: '$2b$10$n6h1QKxzOatjFUVoSbUP1.RjUGkIao/bzrkAjVkprK03RciO3PSYu',
        isAdmin: true
      },
      {
        name: 'Θωμάς Κ.',
        email: 'thkam@example.com',
        password: '$2b$10$rne6TR6wajfB21IOvHdN1.5xkw1KZxJGmARhNh9vE5GdSTINNLMJe',
        isAdmin: false
      },
      {
        name: 'Χρήστος Μιχαλακέλης',
        email: 'chmix@example.com',
        password: '$2b$10$rmlb0moOXfPLx1mT89GjhOatS9jYDMaMxYtNSeKP/gopEW4HL8k6u',
        isAdmin: false
      },
      {
        name: 'Ανάργυρος Τσαδήμας',
        email: 'anargyrosts@gmail.com',
        password: '$2b$10$OX0hmEsx3eVr6mvoChe/EukGBdLZ5GkNpxXA1gBvLJeqloOL0mMEy',
        isAdmin: false
      },
      {
        name: 'Αντώνης Γ.',
        email: 'tonyGeo@gmail.com',
        password: '$2b$10$UHZDvBlklGxh6LED7XFpHeWWrSeTQyKb1l9j4BnNSW3y5/fumcfDS',
        isAdmin: false
      }
    ];

    const result = await collection.insertMany(users);
    console.log(`${result.insertedCount} users inserted`);

    // Εμφάνιση των εγγραφών
    const allUsers = await collection.find({}).toArray();
    console.log('All users:', JSON.stringify(allUsers, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
