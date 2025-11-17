-- Create viewing key transactions association table
CREATE TABLE IF NOT EXISTS viewing_key_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_key_hash VARCHAR(64) NOT NULL,
  transaction_id UUID REFERENCES shielded_transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for viewing key lookups
CREATE INDEX IF NOT EXISTS idx_viewing_key_hash ON viewing_key_transactions(viewing_key_hash);
CREATE INDEX IF NOT EXISTS idx_viewing_key_transaction_id ON viewing_key_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_viewing_key_user_id ON viewing_key_transactions(user_id);

-- Create unique constraint to prevent duplicate associations
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_viewing_key_transaction 
  ON viewing_key_transactions(viewing_key_hash, transaction_id);
