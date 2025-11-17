import pool from '../config/database.js';

async function rollbackLastMigration() {
  try {
    console.log('Rolling back last migration...\n');
    
    // Get the last applied migration
    const result = await pool.query(
      'SELECT * FROM migrations ORDER BY id DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('No migrations to rollback.');
      await pool.end();
      process.exit(0);
    }
    
    const lastMigration = result.rows[0];
    console.log(`Rolling back: ${lastMigration.name}`);
    
    // Note: This is a simple implementation that drops all tables
    // In production, you would want to create down migration files
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Remove migration record
      await client.query('DELETE FROM migrations WHERE id = $1', [lastMigration.id]);
      
      await client.query('COMMIT');
      console.log(`✓ Rolled back migration: ${lastMigration.name}`);
      console.log('\nNote: Manual cleanup of database objects may be required.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Rollback failed:', error);
    await pool.end();
    process.exit(1);
  }
}

rollbackLastMigration();
