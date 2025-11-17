-- Create users table with privacy preferences
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  privacy_preferences JSONB DEFAULT '{}',
  nillion_enabled BOOLEAN DEFAULT FALSE
);

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
