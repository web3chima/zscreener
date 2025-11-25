import { crossChainService } from '../services/cross-chain-service.js';
import { nearService } from '../services/near-service.js';
import pool from '../config/database.js';

/**
 * Test script for cross-chain service
 */
async function testCrossChainService() {
  console.log('Testing Cross-Chain Service...\n');

  try {
    // Initialize NEAR service
    console.log('1. Initializing NEAR service...');
    await nearService.initialize();
    console.log('✓ NEAR service initialized\n');

    // Test with a known NEAR testnet account
    const testNearAddress = 'example.testnet';
    const testZcashAddress = 't1TestZcashAddress123';

    console.log('2. Fetching cross-chain data...');
    console.log(`   Zcash Address: ${testZcashAddress}`);
    console.log(`   NEAR Address: ${testNearAddress}\n`);

    const crossChainData = await crossChainService.fetchCrossChainData(
      testZcashAddress,
      testNearAddress
    );

    console.log('✓ Cross-chain data fetched successfully:');
    console.log(`   - Transactions: ${crossChainData.transactions.length}`);
    console.log(`   - DeFi Positions: ${crossChainData.defiPositions.length}`);
    console.log(`   - Bridge Activity: ${crossChainData.bridgeActivity.length}`);
    console.log(`   - Last Updated: ${new Date(crossChainData.lastUpdated).toISOString()}\n`);

    if (crossChainData.defiPositions.length > 0) {
      console.log('   DeFi Positions:');
      crossChainData.defiPositions.forEach((pos, idx) => {
        console.log(`   ${idx + 1}. ${pos.protocol} - ${pos.positionType}`);
        console.log(`      Amount: ${pos.amount} ${pos.tokenSymbol}`);
      });
      console.log('');
    }

    // Test cache retrieval
    console.log('3. Testing cache retrieval...');
    const cachedData = await crossChainService.fetchCrossChainData(testZcashAddress);
    console.log('✓ Cache retrieved successfully');
    console.log(`   Cache age: ${Date.now() - cachedData.lastUpdated}ms\n`);

    // Test getting all cached addresses
    console.log('4. Getting all cached addresses...');
    const cachedAddresses = await crossChainService.getCachedAddresses();
    console.log(`✓ Found ${cachedAddresses.length} cached addresses`);
    if (cachedAddresses.length > 0) {
      console.log(`   First address: ${cachedAddresses[0]}\n`);
    }

    // Test cache invalidation
    console.log('5. Testing cache invalidation...');
    await crossChainService.invalidateCache(testZcashAddress);
    console.log('✓ Cache invalidated successfully\n');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
    process.exit(0);
  }
}

// Run tests
testCrossChainService();
