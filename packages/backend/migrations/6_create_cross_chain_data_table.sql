-- Create cross-chain data cache table
CREATE TABLE IF NOT EXISTS cross_chain_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zcash_address VARCHAR(255) UNIQUE NOT NULL,
  near_data JSONB,
  defi_positions JSONB,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Create index for Zcash address lookups
CREATE INDEX IF NOT EXISTS idx_cross_chain_zcash_address ON cross_chain_data(zcash_address);
CREATE INDEX IF NOT EXISTS idx_cross_chain_last_updated ON cross_chain_data(last_updated);
