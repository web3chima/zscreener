import pool from '../config/database.js';
import crypto from 'crypto';

function hashViewingKey(viewingKey: string): string {
  return crypto.createHash('sha256').update(viewingKey).digest('hex');
}

async function seedDatabase() {
  try {
    console.log('Seeding database with development data...\n');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Seed users
      console.log('Seeding users...');
      const userResult = await client.query(`
        INSERT INTO users (wallet_address, privacy_preferences, nillion_enabled)
        VALUES 
          ('t1abc123def456ghi789jkl012mno345pqr678', '{"shareAnalytics": true, "encryptProofViews": false}', false),
          ('t1xyz987wvu654tsr321qpo098nml876kji543', '{"shareAnalytics": false, "encryptProofViews": true}', true),
          ('t1test111test222test333test444test555', '{"shareAnalytics": true, "encryptProofViews": true}', true)
        ON CONFLICT (wallet_address) DO NOTHING
        RETURNING id, wallet_address;
      `);
      console.log(`✓ Seeded ${userResult.rows.length} users`);
      
      // Seed shielded transactions
      console.log('Seeding shielded transactions...');
      const txResult = await client.query(`
        INSERT INTO shielded_transactions (
          tx_hash, 
          block_height, 
          timestamp, 
          shielded_inputs, 
          shielded_outputs, 
          proof_data,
          memo_data
        )
        VALUES 
          (
            'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
            1500000,
            NOW() - INTERVAL '2 hours',
            2,
            2,
            '{"proofType": "spend", "proofBytes": "0x1234567890abcdef", "publicInputs": ["0xabc", "0xdef"]}',
            'Test transaction memo'
          ),
          (
            'f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1',
            1500001,
            NOW() - INTERVAL '1 hour',
            1,
            3,
            '{"proofType": "output", "proofBytes": "0xfedcba0987654321", "publicInputs": ["0x123", "0x456"]}',
            NULL
          ),
          (
            'b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4',
            1500002,
            NOW() - INTERVAL '30 minutes',
            3,
            1,
            '{"proofType": "binding", "proofBytes": "0xabcdef1234567890", "publicInputs": ["0x789", "0xabc"]}',
            'Another test memo'
          ),
          (
            'c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5',
            1500003,
            NOW() - INTERVAL '15 minutes',
            2,
            2,
            '{"proofType": "spend", "proofBytes": "0x9876543210fedcba", "publicInputs": ["0xdef", "0x012"]}',
            NULL
          ),
          (
            'd5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6',
            1500004,
            NOW() - INTERVAL '5 minutes',
            1,
            1,
            '{"proofType": "output", "proofBytes": "0x1122334455667788", "publicInputs": ["0x345", "0x678"]}',
            'Recent transaction'
          )
        ON CONFLICT (tx_hash) DO NOTHING
        RETURNING id, tx_hash;
      `);
      console.log(`✓ Seeded ${txResult.rows.length} shielded transactions`);
      
      // Seed viewing key transactions (associate some transactions with users)
      if (userResult.rows.length > 0 && txResult.rows.length > 0) {
        console.log('Seeding viewing key transactions...');
        const viewingKeyHash = hashViewingKey('test-viewing-key-123');
        const vkResult = await client.query(`
          INSERT INTO viewing_key_transactions (viewing_key_hash, transaction_id, user_id)
          VALUES 
            ($1, $2, $3),
            ($1, $4, $3)
          ON CONFLICT DO NOTHING
          RETURNING id;
        `, [
          viewingKeyHash,
          txResult.rows[0].id,
          userResult.rows[0].id,
          txResult.rows[1].id
        ]);
        console.log(`✓ Seeded ${vkResult.rows.length} viewing key associations`);
      }
      
      // Seed NFT data
      console.log('Seeding NFT data...');
      const nftResult = await client.query(`
        INSERT INTO nft_data (asset_id, zsa_data, zip231_memo, metadata, is_shielded)
        VALUES 
          (
            'zsa_asset_001',
            '{"assetType": "ZSA", "name": "Shielded NFT #1", "supply": 1}',
            'NFT metadata in ZIP 231 format',
            '{"name": "Shielded Art #1", "description": "A private NFT", "image": "ipfs://QmExample1"}',
            true
          ),
          (
            'zsa_asset_002',
            '{"assetType": "ZSA", "name": "Public NFT #2", "supply": 1}',
            'Public NFT memo data',
            '{"name": "Public Art #2", "description": "A public NFT", "image": "ipfs://QmExample2"}',
            false
          ),
          (
            'zsa_asset_003',
            '{"assetType": "ZSA", "name": "Shielded Collectible", "supply": 100}',
            'Collectible series memo',
            '{"name": "Collectible #3", "description": "Limited edition", "image": "ipfs://QmExample3"}',
            true
          )
        ON CONFLICT (asset_id) DO NOTHING
        RETURNING id, asset_id;
      `);
      console.log(`✓ Seeded ${nftResult.rows.length} NFT records`);
      
      // Seed alerts
      if (userResult.rows.length > 0) {
        console.log('Seeding alerts...');
        const alertResult = await client.query(`
          INSERT INTO alerts (user_id, alert_type, conditions, notification_method, is_active)
          VALUES 
            (
              $1,
              'transaction',
              '{"threshold": 1000, "currency": "ZEC"}',
              'ui',
              true
            ),
            (
              $1,
              'address',
              '{"address": "t1test111test222test333test444test555", "direction": "incoming"}',
              'ui',
              true
            )
          RETURNING id;
        `, [userResult.rows[0].id]);
        console.log(`✓ Seeded ${alertResult.rows.length} alerts`);
      }
      
      // Seed cross-chain data
      console.log('Seeding cross-chain data...');
      const crossChainResult = await client.query(`
        INSERT INTO cross_chain_data (zcash_address, near_data, defi_positions)
        VALUES 
          (
            't1abc123def456ghi789jkl012mno345pqr678',
            '{"nearAccount": "user1.near", "transactions": [{"hash": "near_tx_1", "amount": "100"}]}',
            '{"positions": [{"protocol": "ref.finance", "value": 5000}]}'
          ),
          (
            't1xyz987wvu654tsr321qpo098nml876kji543',
            '{"nearAccount": "user2.near", "transactions": [{"hash": "near_tx_2", "amount": "250"}]}',
            '{"positions": [{"protocol": "burrow.finance", "value": 12000}]}'
          )
        RETURNING id;
      `);
      console.log(`✓ Seeded ${crossChainResult.rows.length} cross-chain data records`);
      
      await client.query('COMMIT');
      console.log('\n✓ Database seeding completed successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    await pool.end();
    process.exit(1);
  }
}

seedDatabase();
