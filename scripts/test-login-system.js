import fetch from 'node-fetch';

async function testLoginSystem() {
  console.log('🧪 Testing Login System...\n');

  const testCases = [
    {
      name: 'Valid SuperAdmin Login',
      data: { email: 'superadmin@hcc.com', password: 'SuperAdmin123!' },
      expectedRole: 'SuperAdmin'
    },
    {
      name: 'Invalid Email',
      data: { email: 'invalid@example.com', password: 'SuperAdmin123!' },
      shouldFail: true
    },
    {
      name: 'Invalid Password',
      data: { email: 'superadmin@hcc.com', password: 'wrongpassword' },
      shouldFail: true
    },
    {
      name: 'Empty Credentials',
      data: { email: '', password: '' },
      shouldFail: true
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      const response = await fetch('http://localhost:5000/api/staff/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data)
      });

      const data = await response.json();
      
      if (testCase.shouldFail) {
        if (response.status === 401 || response.status === 400) {
          console.log(`✅ ${testCase.name}: Correctly failed with status ${response.status}`);
        } else {
          console.log(`❌ ${testCase.name}: Should have failed but got status ${response.status}`);
        }
      } else {
        if (response.status === 200 && data.success) {
          if (testCase.expectedRole && data.data.role === testCase.expectedRole) {
            console.log(`✅ ${testCase.name}: Success with correct role (${data.data.role})`);
          } else {
            console.log(`✅ ${testCase.name}: Success`);
          }
        } else {
          console.log(`❌ ${testCase.name}: Failed with status ${response.status}`);
        }
      }
    } catch (error) {
      if (testCase.shouldFail) {
        console.log(`✅ ${testCase.name}: Correctly failed with error`);
      } else {
        console.log(`❌ ${testCase.name}: Unexpected error: ${error.message}`);
      }
    }
    
    console.log('---');
  }

  console.log('\n🔍 Testing Database Connection...');
  try {
    const response = await fetch('http://localhost:5000/api/staff/stats');
    const data = await response.json();
    
    if (response.status === 200) {
      console.log('✅ Database connection working');
      console.log(`📊 Staff stats: ${JSON.stringify(data.data, null, 2)}`);
    } else {
      console.log('❌ Database connection failed');
    }
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
  }
}

// Wait a moment for server to start
setTimeout(testLoginSystem, 2000);
