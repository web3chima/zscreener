import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  id: number;
  name: string;
  applied_at: Date;
}

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await pool.query(query);
}

async function getAppliedMigrations(): Promise<Migration[]> {
  const result = await pool.query<Migration>(
    'SELECT * FROM migrations ORDER BY id ASC'
  );
  return result.rows;
}

async function applyMigration(migrationFile: string) {
  const migrationPath = path.join(__dirname, '../../migrations', migrationFile);
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Execute migration SQL
    await client.query(sql);
    
    // Record migration
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [migrationFile]
    );
    
    await client.query('COMMIT');
    console.log(`✓ Applied migration: ${migrationFile}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Failed to apply migration: ${migrationFile}`);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('Starting database migrations...\n');
    
    // Create migrations table if it doesn't exist
    await createMigrationsTable();
    
    // Get list of applied migrations
    const appliedMigrations = await getAppliedMigrations();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Apply pending migrations
    let appliedCount = 0;
    for (const file of migrationFiles) {
      if (!appliedNames.has(file)) {
        await applyMigration(file);
        appliedCount++;
      }
    }
    
    if (appliedCount === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`\n✓ Successfully applied ${appliedCount} migration(s).`);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
