const axios = require('axios');

async function testFlow() {
  const api = axios.create({ baseURL: 'http://localhost:5000/api' });
  
  const loginRes = await api.post('/auth/login', { email: 'auditor@example.com', password: 'password123' });
  console.log('Login Response:', loginRes.data);
  const cookies = loginRes.headers['set-cookie'];
  
  try {
    const profileRes = await api.get('/auth/profile', { headers: { Cookie: cookies.join(';') } });
    console.log('Profile Response:', profileRes.data);
    const userData = profileRes.data;
    
    if (userData.mustChangePassword) {
      console.log('App.jsx would navigate to /force-change-password');
    } else if (userData.mustSetup2FA) {
      console.log('App.jsx would navigate to /setup-2fa');
    } else if (!userData.isVerified) {
      console.log('App.jsx would navigate to /email-verify');
    } else {
      console.log('App.jsx would set isAuthenticated = true and navigate to dashboard');
    }
  } catch (err) {
    console.error('Profile fetch failed:', err.response?.status, err.response?.data);
  }
}

testFlow();
