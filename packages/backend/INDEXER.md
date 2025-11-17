# Zcash Indexer Service

This document describes the Zcash blockchain indexer service and how to use it.

## Overview

The indexer service consists of three main components:

1. **Zcash RPC Client** - Connects to a Zcash node and fetches blockchain data
2. **Block Indexer** - Processes blocks and extracts shielded transaction data
3. **Viewing Key Service** - Associates transactions with viewing keys for user-specific queries
4. **Indexer Worker** - Background job queue for continuous blockchain synchronization

## Components

### Zcash RPC Client

The RPC client provides methods to interact with a Zcash node:

- `getBlock(hashOrHeight)` - Get block information
- `getRawTransaction(txid)` - Get transaction details
- `getBlockchainInfo()` - Get blockchain status
- `getBlockCount()` - Get current block height
- `testConnection()` - Test connection to Zcash node

**Features:**
- Automatic retry logic with exponential backoff
- Connection error handling
- Configurable timeout and retry settings

### Block Indexer

The block indexer processes Zcash blocks and extracts shielded transaction data:

- Parses Halo ECC zero-knowledge proofs
- Extracts shielded inputs and outputs
- Stores transaction data in PostgreSQL
- Tracks indexing progress

**Methods:**
- `indexBlock(blockHeight)` - Index a single block
- `indexBlockRange(start, end)` - Index a range of blocks
- `startIndexing(pollInterval)` - Start continuous indexing
- `stopIndexing()` - Stop continuous indexing
- `getProgress()` - Get current indexing status

### Viewing Key Service

The viewing key service manages associations between viewing keys and transactions:

- Validates viewing key format
- Hashes viewing keys for secure storage
- Associates transactions with viewing keys
- Provides transaction lookup by viewing key

**Methods:**
- `findTransactionsByViewingKey(viewingKey, userId)` - Find transactions for a viewing key
- `associateTransaction(viewingKey, transactionId, userId)` - Associate a transaction
- `scanAndAssociate(viewingKey, userId, startBlock, endBlock)` - Scan and associate transactions
- `getViewingKeyStats(viewingKey)` - Get statistics for a viewing key

### Indexer Worker

The worker uses Bull queue for background job processing:

**Job Types:**
- `index-block` - Index a single block
- `index-range` - Index a range of blocks
- `continuous-sync` - Continuously sync with blockchain
- `scan-viewing-key` - Scan transactions for a viewing key
- `periodic-reindex` - Periodically re-index recent blocks

## Configuration

Add these environment variables to your `.env` file:

```bash
# Zcash Node Configuration
ZCASH_RPC_URL=http://localhost:8232
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_password

# Redis Configuration (for Bull queue)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Indexer Worker Configuration
INDEXER_POLL_INTERVAL=10000
REINDEX_INTERVAL_HOURS=24
```

## Usage

### Starting the Worker

To start the indexer worker:

```bash
npm run worker
```

For development with auto-reload:

```bash
npm run worker:dev
```

### Programmatic Usage

```typescript
import { 
  zcashRPCClient, 
  blockIndexer, 
  viewingKeyService 
} from './services';

// Test connection to Zcash node
const connected = await zcashRPCClient.testConnection();

// Index a specific block
await blockIndexer.indexBlock(1000000);

// Index a range of blocks
await blockIndexer.indexBlockRange(1000000, 1000100);

// Find transactions for a viewing key
const transactions = await viewingKeyService.findTransactionsByViewingKey(
  'your_viewing_key_here',
  'user_id'
);

// Get indexing progress
const progress = await blockIndexer.getProgress();
console.log(`Indexed ${progress.lastIndexedBlock} of ${progress.totalBlocks} blocks`);
```

### Using the Job Queue

```typescript
import {
  scheduleBlockIndex,
  scheduleRangeIndex,
  scheduleViewingKeyScan,
  startContinuousSync,
  stopContinuousSync
} from './workers/indexer-worker';

// Schedule a single block to be indexed
await scheduleBlockIndex(1000000);

// Schedule a range of blocks
await scheduleRangeIndex(1000000, 1000100);

// Start continuous sync
await startContinuousSync(10000); // Poll every 10 seconds

// Schedule viewing key scan
await scheduleViewingKeyScan('viewing_key', 'user_id', 1000000, 1000100);

// Stop continuous sync
await stopContinuousSync();
```

## Data Storage

### Shielded Transactions Table

The indexer stores shielded transaction data in the `shielded_transactions` table:

- `tx_hash` - Transaction hash (unique)
- `block_height` - Block height
- `timestamp` - Block timestamp
- `shielded_inputs` - Number of shielded inputs
- `shielded_outputs` - Number of shielded outputs
- `proof_data` - Halo ECC proof data (JSON)
- `memo_data` - Memo field data (JSON)

### Viewing Key Associations

Viewing key associations are stored in the `viewing_key_transactions` table:

- `viewing_key_hash` - SHA-256 hash of viewing key
- `transaction_id` - Reference to shielded transaction
- `user_id` - Optional user reference

## Error Handling

All services throw custom error classes:

- `ZcashRPCError` - RPC connection or request errors
- `BlockIndexerError` - Block indexing errors
- `ViewingKeyServiceError` - Viewing key operation errors

Example error handling:

```typescript
try {
  await blockIndexer.indexBlock(height);
} catch (error) {
  if (error instanceof BlockIndexerError) {
    console.error(`Indexer error: ${error.code}`, error.details);
  }
}
```

## Performance Considerations

- The indexer processes blocks sequentially to maintain data consistency
- Use the job queue for parallel processing of independent tasks
- Redis caching is used for frequently accessed data
- Database indexes are optimized for common queries

## Monitoring

Monitor the indexer using:

1. **Queue Dashboard** - Bull provides a web UI for monitoring jobs
2. **Database Queries** - Check `shielded_transactions` table for progress
3. **Logs** - Worker logs all indexing activities
4. **Progress API** - Use `blockIndexer.getProgress()` for status

## Troubleshooting

### Connection Issues

If the indexer can't connect to the Zcash node:

1. Verify `ZCASH_RPC_URL` is correct
2. Check Zcash node is running and RPC is enabled
3. Verify RPC credentials are correct
4. Check firewall settings

### Slow Indexing

If indexing is slow:

1. Reduce `INDEXER_POLL_INTERVAL` for faster polling
2. Use `indexBlockRange` for batch processing
3. Check database performance and indexes
4. Monitor network latency to Zcash node

### Missing Transactions

If transactions are missing:

1. Run periodic re-indexing
2. Check for errors in worker logs
3. Verify block range is correct
4. Re-index specific blocks manually

## Future Enhancements

- Support for multiple Zcash nodes (failover)
- Parallel block processing
- Real-time WebSocket updates
- Advanced caching strategies
- Metrics and monitoring dashboard
