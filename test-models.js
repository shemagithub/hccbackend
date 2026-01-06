import pool, { testConnection } from './config/db.js';
import Department from './models/Department.js';
import Role from './models/Role.js';

async function testBackend() {
  console.log('🧪 Testing Backend Models...\n');

  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed');
      return;
    }
    console.log('✅ Database connection successful\n');

    // Test Department model
    console.log('📁 Testing Department Model...');
    await Department.createTable();
    
    const departments = await Department.findAll({ limit: 5 });
    console.log(`✅ Found ${departments.length} departments`);
    
    if (departments.length > 0) {
      const dept = departments[0];
      console.log(`   Sample: ${dept.name} (${dept.departmentCode})`);
    }

    // Test Role model
    console.log('\n👥 Testing Role Model...');
    await Role.createTable();
    
    const roles = await Role.findAll({ limit: 5 });
    console.log(`✅ Found ${roles.length} roles`);
    
    if (roles.length > 0) {
      const role = roles[0];
      console.log(`   Sample: ${role.name} (${role.departmentName || 'No Department'})`);
    }

    // Test stats
    console.log('\n📊 Testing Statistics...');
    const deptStats = await Department.getStats();
    const roleStats = await Role.getStats();
    
    console.log(`✅ Department Stats: ${deptStats.total} total, ${deptStats.active} active`);
    console.log(`✅ Role Stats: ${roleStats.total} total, ${roleStats.active} active`);

    console.log('\n🎉 All tests passed! Backend is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    // Close the connection
    await pool.end();
  }
}

testBackend();
