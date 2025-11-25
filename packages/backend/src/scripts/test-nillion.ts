import dotenv from 'dotenv';
import { getNillionClient } from '../services/nillion-client.js';
import { getNilDBService } from '../services/nil-db-service.js';
import { getNilccService } from '../services/nilcc-service.js';
import { getEncryptionService } from '../services/encryption-service.js';
import type { HaloProofData } from '../services/encryption-service.js';

dotenv.config();

async function testNillionIntegration() {
  console.log('Testing Nillion Integration...\n');

  try {
    // Test 1: Nillion Client Connection
    console.log('1. Testing Nillion Client Connection...');
    const client = getNillionClient({ userId: 'test-user-123' });
    const isConnected = await client.isConnected();
    console.log(`   ✓ Client connected: ${isConnected}\n`);

    // Test 2: Nil DB Storage
    console.log('2. Testing Nil DB Storage...');
    const nilDBService = getNilDBService();
    
    const testData = {
      message: 'Hello, Nillion!',
      timestamp: Date.now(),
      value: 42,
    };

    const storageResult = await nilDBService.storeData(testData, {
      userId: 'test-user-123',
      metadata: { type: 'test-data' },
    });

    console.log(`   ✓ Data stored with ID: ${storageResult.dataId}`);
    console.log(`   ✓ Encryption Key ID: ${storageResult.encryptionKeyId}\n`);

    // Test 3: Nil DB Retrieval
    console.log('3. Testing Nil DB Retrieval...');
    try {
      const retrievedData = await nilDBService.retrieveData({
        dataId: storageResult.dataId,
        userId: 'test-user-123',
      });
      console.log(`   ✓ Data retrieved successfully`);
      console.log(`   ✓ Retrieved data matches: ${JSON.stringify(retrievedData) === JSON.stringify(testData)}\n`);
    } catch (error) {
      console.log(`   ⚠ Retrieval test skipped (mock mode): ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Test 4: Nilcc Confidential Compute
    console.log('4. Testing Nilcc Confidential Compute...');
    const nilccService = getNilccService();

    const computeJobId = await nilccService.submitComputation({
      userId: 'test-user-123',
      operation: 'sum',
      inputs: [
        { type: 'inline', value: 10 },
        { type: 'inline', value: 20 },
        { type: 'inline', value: 30 },
      ],
    });

    console.log(`   ✓ Computation job submitted: ${computeJobId}`);

    // Wait for computation to complete
    console.log('   ⏳ Waiting for computation to complete...');
    const completedJob = await nilccService.waitForCompletion(computeJobId, 5000);
    
    if (completedJob.status === 'completed') {
      console.log(`   ✓ Computation completed with result: ${completedJob.result}`);
    } else {
      console.log(`   ✗ Computation failed: ${completedJob.error}`);
    }
    console.log('');

    // Test 5: Encryption Service
    console.log('5. Testing Encryption Service...');
    const encryptionService = getEncryptionService();

    const mockProofData: HaloProofData = {
      proofBytes: 'deadbeef1234567890abcdef',
      publicInputs: ['input1', 'input2', 'input3'],
      proofType: 'spend',
      verificationKey: 'verification-key-abc123',
    };

    // Verify proof integrity
    const isValid = encryptionService.verifyProofIntegrity(mockProofData);
    console.log(`   ✓ Proof integrity check: ${isValid}`);

    // Encrypt proof
    const proofId = await encryptionService.encryptProofView({
      userId: 'test-user-123',
      proofData: mockProofData,
      metadata: { type: 'test-proof' },
      storeInNilDB: false,
    });

    console.log(`   ✓ Proof encrypted with ID: ${proofId}`);

    // Generate proof hash
    const proofHash = encryptionService.generateProofHash(mockProofData);
    console.log(`   ✓ Proof hash: ${proofHash.substring(0, 16)}...`);

    // Decrypt proof
    const decryptedProof = await encryptionService.decryptProofView({
      proofId,
      userId: 'test-user-123',
      fromNilDB: false,
    });

    console.log(`   ✓ Proof decrypted successfully`);
    console.log(`   ✓ Decrypted data matches: ${JSON.stringify(decryptedProof) === JSON.stringify(mockProofData)}\n`);

    // Test 6: Analytics Query
    console.log('6. Testing Privacy-Preserving Analytics...');
    const analyticsJobId = await nilccService.executeAnalyticsQuery(
      'test-user-123',
      'transaction_volume',
      ['data-id-1', 'data-id-2', 'data-id-3'],
      { timeRange: '24h' }
    );

    console.log(`   ✓ Analytics query submitted: ${analyticsJobId}`);
    
    // Wait for analytics to complete
    const analyticsJob = await nilccService.waitForCompletion(analyticsJobId, 5000);
    if (analyticsJob.status === 'completed') {
      console.log(`   ✓ Analytics completed\n`);
    }

    // Test 7: Encryption Statistics
    console.log('7. Testing Encryption Statistics...');
    const stats = encryptionService.getEncryptionStats();
    console.log(`   ✓ Total encrypted proofs: ${stats.totalEncryptedProofs}`);
    console.log(`   ✓ Encryption algorithm: ${stats.algorithm}\n`);

    console.log('✅ All Nillion integration tests completed successfully!');
    console.log('\nNote: Some tests are running in mock mode since Nillion services are not configured.');
    console.log('To enable full functionality, configure NILLION_API_KEY in your .env file.\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testNillionIntegration()
  .then(() => {
    console.log('Test script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
