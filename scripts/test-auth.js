import fetch from 'node-fetch';

async function testAuthentication() {
  try {
    console.log('Testing staff authentication endpoint...');

    // Test with SuperAdmin credentials
    const response = await fetch('http://localhost:5000/api/staff/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@hcc.com',
        password: 'SuperAdmin123!'
      })
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (data.success && data.data.role === 'SuperAdmin') {
      console.log('✅ SuperAdmin authentication successful!');
      console.log('User role:', data.data.role);
      console.log('User status:', data.data.status);
    } else {
      console.log('❌ Authentication failed');
    }

  } catch (error) {
    console.error('❌ Error testing authentication:', error);
  }
}

// Wait a moment for server to start
setTimeout(testAuthentication, 2000);
