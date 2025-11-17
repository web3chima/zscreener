-- Create NFT data table for ZSA and ZIP 231 data
CREATE TABLE IF NOT EXISTS nft_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id VARCHAR(255) UNIQUE NOT NULL,
  zsa_data JSONB,
  zip231_memo TEXT,
  metadata JSONB,
  is_shielded BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for NFT queries
CREATE INDEX IF NOT EXISTS idx_nft_asset_id ON nft_data(asset_id);
CREATE INDEX IF NOT EXISTS idx_nft_is_shielded ON nft_data(is_shielded);
