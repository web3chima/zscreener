import pool from '../config/database.js';

async function testConnection() {
  try {
    console.log('Testing database connection...\n');
    
    const client = await pool.connect();
    
    try {
      // Test basic query
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      
      console.log('✓ Database connection successful!');
      console.log(`  Current time: ${result.rows[0].current_time}`);
      console.log(`  PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}`);
      
      // Check if migrations table exists
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      
      if (tablesResult.rows.length > 0) {
        console.log('\n✓ Existing tables:');
        tablesResult.rows.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
      } else {
        console.log('\n⚠ No tables found. Run "npm run migrate" to create tables.');
      }
      
    } finally {
      client.release();
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    console.error('\nPlease check:');
    console.error('  1. PostgreSQL is running');
    console.error('  2. Database exists (create with: CREATE DATABASE zscreener_dev;)');
    console.error('  3. Credentials in .env.development are correct');
    await pool.end();
    process.exit(1);
  }
}

testConnection();
