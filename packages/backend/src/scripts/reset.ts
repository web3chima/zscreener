import pool from '../config/database.js';

async function resetDatabase() {
  try {
    console.log('Resetting database...\n');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('Dropping all tables...');
      
      // Drop tables in reverse order of dependencies
      await client.query('DROP TABLE IF EXISTS alert_notifications CASCADE');
      await client.query('DROP TABLE IF EXISTS alerts CASCADE');
      await client.query('DROP TABLE IF EXISTS cross_chain_data CASCADE');
      await client.query('DROP TABLE IF EXISTS nft_data CASCADE');
      await client.query('DROP TABLE IF EXISTS viewing_key_transactions CASCADE');
      await client.query('DROP TABLE IF EXISTS shielded_transactions CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      await client.query('DROP TABLE IF EXISTS migrations CASCADE');
      
      await client.query('COMMIT');
      console.log('✓ All tables dropped successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    console.log('\n✓ Database reset completed!');
    console.log('Run "npm run migrate" to recreate tables.');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Reset failed:', error);
    await pool.end();
    process.exit(1);
  }
}

resetDatabase();
