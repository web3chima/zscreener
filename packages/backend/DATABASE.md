# Database Setup Guide

## Overview

Zscreener uses PostgreSQL as its primary database for storing shielded transaction data, user information, NFT data, alerts, and cross-chain information.

## Prerequisites

- PostgreSQL 14 or higher installed and running
- Node.js 18 or higher

## Database Schema

The database consists of the following tables:

1. **users** - User accounts with privacy preferences
2. **shielded_transactions** - Indexed Zcash shielded transactions
3. **viewing_key_transactions** - Association between viewing keys and transactions
4. **nft_data** - ZSA and ZIP 231 NFT information
5. **alerts** - User-configured alert conditions
6. **alert_notifications** - History of triggered alerts
7. **cross_chain_data** - Cached NEAR cross-chain data

## Setup Instructions

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE zscreener_dev;

# Exit psql
\q
```

### 2. Configure Environment

Copy the example environment file and update with your database credentials:

```bash
cp .env.example .env.development
```

Update the following variables in `.env.development`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zscreener_dev
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Run Migrations

Apply all database migrations:

```bash
npm run migrate
```

This will create all necessary tables and indexes.

### 4. Seed Development Data (Optional)

Populate the database with sample data for development:

```bash
npm run db:seed
```

This creates:
- 3 sample users
- 5 shielded transactions
- 3 NFT records
- 2 alerts
- 2 cross-chain data records
- Viewing key associations

## Available Scripts

### Migration Commands

- `npm run migrate` - Run all pending migrations
- `npm run migrate:rollback` - Rollback the last migration
- `npm run db:seed` - Seed database with development data
- `npm run db:reset` - Drop all tables (destructive!)

## Migration Files

Migrations are located in the `migrations/` directory and are executed in order:

1. `1_create_users_table.sql`
2. `2_create_shielded_transactions_table.sql`
3. `3_create_viewing_key_transactions_table.sql`
4. `4_create_nft_data_table.sql`
5. `5_create_alerts_tables.sql`
6. `6_create_cross_chain_data_table.sql`

## Database Connection

The application uses the `pg` library with connection pooling. Configuration is in `src/config/database.ts`.

Connection pool settings:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

## Troubleshooting

### Connection Issues

If you encounter connection errors:

1. Verify PostgreSQL is running:
   ```bash
   # Windows
   pg_ctl status
   
   # Or check services
   services.msc
   ```

2. Check database exists:
   ```bash
   psql -U postgres -l
   ```

3. Verify credentials in `.env.development`

### Migration Errors

If a migration fails:

1. Check the error message for SQL syntax issues
2. Verify database user has necessary permissions
3. Use `npm run db:reset` to start fresh (development only!)

### Permission Issues

Grant necessary permissions to your database user:

```sql
GRANT ALL PRIVILEGES ON DATABASE zscreener_dev TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

## Production Considerations

For production deployments:

1. Use strong database passwords
2. Enable SSL connections
3. Configure connection pooling based on load
4. Set up automated backups
5. Monitor database performance
6. Use read replicas for analytics queries
7. Implement proper access controls

## Schema Diagram

```
users
├── id (UUID, PK)
├── wallet_address (VARCHAR, UNIQUE)
├── created_at (TIMESTAMP)
├── privacy_preferences (JSONB)
└── nillion_enabled (BOOLEAN)

shielded_transactions
├── id (UUID, PK)
├── tx_hash (VARCHAR, UNIQUE)
├── block_height (INTEGER)
├── timestamp (TIMESTAMP)
├── shielded_inputs (INTEGER)
├── shielded_outputs (INTEGER)
├── proof_data (JSONB)
├── memo_data (TEXT)
└── indexed_at (TIMESTAMP)

viewing_key_transactions
├── id (UUID, PK)
├── viewing_key_hash (VARCHAR)
├── transaction_id (UUID, FK -> shielded_transactions)
├── user_id (UUID, FK -> users)
└── created_at (TIMESTAMP)

nft_data
├── id (UUID, PK)
├── asset_id (VARCHAR, UNIQUE)
├── zsa_data (JSONB)
├── zip231_memo (TEXT)
├── metadata (JSONB)
├── is_shielded (BOOLEAN)
└── created_at (TIMESTAMP)

alerts
├── id (UUID, PK)
├── user_id (UUID, FK -> users)
├── alert_type (VARCHAR)
├── conditions (JSONB)
├── notification_method (VARCHAR)
├── is_active (BOOLEAN)
└── created_at (TIMESTAMP)

alert_notifications
├── id (UUID, PK)
├── alert_id (UUID, FK -> alerts)
├── triggered_at (TIMESTAMP)
└── notification_data (JSONB)

cross_chain_data
├── id (UUID, PK)
├── zcash_address (VARCHAR)
├── near_data (JSONB)
├── defi_positions (JSONB)
└── last_updated (TIMESTAMP)
```
