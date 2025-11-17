-- Create shielded transactions table
CREATE TABLE IF NOT EXISTS shielded_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash VARCHAR(64) UNIQUE NOT NULL,
  block_height INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  shielded_inputs INTEGER,
  shielded_outputs INTEGER,
  proof_data JSONB,
  memo_data TEXT,
  indexed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_shielded_tx_block_height ON shielded_transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_shielded_tx_timestamp ON shielded_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_shielded_tx_hash ON shielded_transactions(tx_hash);
