import { nearService } from '../services/near-service.js';
import { getNEARConfig } from '../config/near.js';

/**
 * Test NEAR connection and basic operations
 */
async function testNEARConnection() {
  console.log('Testing NEAR connection...\n');

  try {
    // Display configuration
    const config = getNEARConfig();
    console.log('NEAR Configuration:');
    console.log(`  Network: ${config.networkId}`);
    console.log(`  Node URL: ${config.nodeUrl}`);
    console.log('');

    // Initialize NEAR service
    console.log('Initializing NEAR service...');
    await nearService.initialize();
    console.log('✓ NEAR service initialized\n');

    // Get network status
    console.log('Fetching network status...');
    const status = await nearService.getNetworkStatus();
    console.log('✓ Network Status:');
    console.log(`  Chain ID: ${status.chain_id}`);
    console.log(`  Latest Block Height: ${status.sync_info.latest_block_height}`);
    console.log(`  Latest Block Hash: ${status.sync_info.latest_block_hash}`);
    console.log('');

    // Test with a known testnet account (NEAR foundation account)
    const testAccount = config.networkId === 'testnet' 
      ? 'test.near' 
      : 'near';

    console.log(`Testing account operations with: ${testAccount}`);
    
    // Check if account exists
    const exists = await nearService.accountExists(testAccount);
    console.log(`✓ Account exists: ${exists}\n`);

    if (exists) {
      // Get account info
      console.log('Fetching account information...');
      const accountInfo = await nearService.getAccountInfo(testAccount);
      console.log('✓ Account Info:');
      console.log(`  Account ID: ${accountInfo.accountId}`);
      console.log(`  Balance: ${accountInfo.balanceFormatted} NEAR`);
      console.log(`  Storage Usage: ${accountInfo.storageUsage} bytes`);
      console.log(`  Block Height: ${accountInfo.blockHeight}`);
      console.log('');
    }

    // Get latest block
    console.log('Fetching latest block...');
    const latestBlock = await nearService.getBlock(status.sync_info.latest_block_height);
    console.log('✓ Latest Block:');
    console.log(`  Height: ${latestBlock.header.height}`);
    console.log(`  Timestamp: ${new Date(latestBlock.header.timestamp / 1000000).toISOString()}`);
    console.log(`  Transactions: ${latestBlock.chunks.reduce((sum: number, chunk: any) => sum + chunk.tx_root, 0)}`);
    console.log('');

    console.log('✅ All NEAR connection tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ NEAR connection test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testNEARConnection();
