// Δημιουργήστε ένα test-endpoint.js στον backend φάκελο
const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:5000/api/users/login', {
      email: 'admin@example.com',
      password: 'password123' // Η πραγματική κωδική πρόσβαση που αντιστοιχεί στο hash
    });
    console.log('✅ Login successful:', response.data);
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
  }
}

testLogin();
