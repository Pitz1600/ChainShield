// Run the local backend with CAPTCHA_ENABLED=false (never in production),
// or supply a fresh route-specific CAPTCHA_TOKEN for this script.
const axios = require('axios');
require('dotenv').config({ path: '../.env' });

async function testProfile() {
  try {
    const api = axios.create({
      baseURL: 'http://localhost:5000/api',
      headers: { 'Content-Type': 'application/json' }
    });

    // 1. Login
    const loginRes = await api.post('/auth/login', {
      captchaToken: process.env.CAPTCHA_TOKEN,
      email: 'auditor@example.com',
      password: 'password123'
    });
    console.log('Login Response:', loginRes.data);

    // 2. Extract cookie
    const cookies = loginRes.headers['set-cookie'];
    console.log('Cookies:', cookies);

    // 3. Get profile
    const profileRes = await api.get('/auth/profile', {
      headers: { Cookie: cookies.join(';') }
    });
    console.log('Profile Response:', profileRes.data);
  } catch (err) {
    if (err.response) {
      console.error('Error Response:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

testProfile();
