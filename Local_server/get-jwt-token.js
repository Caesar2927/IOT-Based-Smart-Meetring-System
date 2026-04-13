/**
 * Get JWT Token Script
 * Run this to register a test user and get a JWT token for Local Server
 * 
 * Usage: node get-jwt-token.js
 */

const axios = require('axios');

const GLOBAL_SERVER_URL = 'http://localhost:5000';

// Test user credentials
const testUser = {
  name: 'Smart Meter',
  email: 'localsensor@example.com',
  password: 'smartmeter123',
  localServerURL: 'http://localhost:3000'
};

async function getJWTToken() {
  try {
    console.log('🔐 Attempting to register/login user...\n');

    // Try to login first
    console.log('📝 Trying to login existing user...');
    try {
      const loginRes = await axios.post(`${GLOBAL_SERVER_URL}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });

      console.log('✅ Login successful!\n');
      console.log('JWT Token:');
      console.log('━'.repeat(60));
      console.log(loginRes.data.token);
      console.log('━'.repeat(60));
      console.log('\n📋 Add this to Local_server/.env:\n');
      console.log(`USER_JWT=${loginRes.data.token}`);
      return loginRes.data.token;
    } catch (loginErr) {
      if (loginErr.response?.status === 400) {
        // User doesn't exist, register new one
        console.log('⚠️ User not found, registering new user...\n');

        const registerRes = await axios.post(`${GLOBAL_SERVER_URL}/api/auth/register`, testUser);

        console.log('✅ Registration successful!\n');
        console.log('JWT Token:');
        console.log('━'.repeat(60));
        console.log(registerRes.data.token);
        console.log('━'.repeat(60));
        console.log('\n📋 Add this to Local_server/.env:\n');
        console.log(`USER_JWT=${registerRes.data.token}`);
        return registerRes.data.token;
      } else {
        throw loginErr;
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('\n⚠️ Make sure Global Server is running on port 5000');
    process.exit(1);
  }
}

getJWTToken();
