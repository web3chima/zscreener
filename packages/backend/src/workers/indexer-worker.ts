import Queue from 'bull';
import { blockIndexer } from '../services/block-indexer.js';
import { viewingKeyService } from '../services/viewing-key-service.js';
import { zcashRPCClient } from '../services/zcash-rpc-client.js';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Job data interfaces
interface IndexBlockJobData {
  blockHeight: number;
}

interface IndexRangeJobData {
  startHeight: number;
  endHeight: number;
}

interface ScanViewingKeyJobData {
  viewingKey: string;
  userId?: string;
  startBlock?: number;
  endBlock?: number;
}

interface ContinuousSyncJobData {
  pollInterval?: number;
}

// Create Bull queues
export const indexerQueue = new Queue('indexer', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const viewingKeyQueue = new Queue('viewing-key', redisUrl, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});

// Process indexer queue jobs
indexerQueue.process('index-block', async (job) => {
  const { blockHeight } = job.data as IndexBlockJobData;
  
  console.log(`Processing index-block job for block ${blockHeight}`);
  
  try {
    const count = await blockIndexer.indexBlock(blockHeight);
    return { blockHeight, indexedTransactions: count };
  } catch (error: any) {
    console.error(`Failed to index block ${blockHeight}:`, error.message);
    throw error;
  }
});

indexerQueue.process('index-range', async (job) => {
  const { startHeight, endHeight } = job.data as IndexRangeJobData;
  
  console.log(`Processing index-range job from ${startHeight} to ${endHeight}`);
  
  try {
    await blockIndexer.indexBlockRange(startHeight, endHeight);
    return { startHeight, endHeight, status: 'completed' };
  } catch (error: any) {
    console.error(`Failed to index range ${startHeight}-${endHeight}:`, error.message);
    throw error;
  }
});

indexerQueue.process('continuous-sync', async (job) => {
  const { pollInterval = 10000 } = job.data as ContinuousSyncJobData;
  
  console.log('Starting continuous blockchain sync');
  
  try {
    // This will run indefinitely until stopped
    await blockIndexer.startIndexing(pollInterval);
    return { status: 'stopped' };
  } catch (error: any) {
    console.error('Continuous sync error:', error.message);
    throw error;
  }
});

// Process viewing key queue jobs
viewingKeyQueue.process('scan-viewing-key', async (job) => {
  const { viewingKey, userId, startBlock, endBlock } = job.data as ScanViewingKeyJobData;
  
  console.log(`Processing scan-viewing-key job for user ${userId || 'anonymous'}`);
  
  try {
    const count = await viewingKeyService.scanAndAssociate(
      viewingKey,
      userId,
      startBlock,
      endBlock
    );
    return { associatedTransactions: count };
  } catch (error: any) {
    console.error('Failed to scan viewing key:', error.message);
    throw error;
  }
});

// Queue event handlers
indexerQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

indexerQueue.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

viewingKeyQueue.on('completed', (job, result) => {
  console.log(`Viewing key job ${job.id} completed:`, result);
});

viewingKeyQueue.on('failed', (job, err) => {
  console.error(`Viewing key job ${job?.id} failed:`, err.message);
});

// Helper functions to add jobs to queues
export async function scheduleBlockIndex(blockHeight: number): Promise<void> {
  await indexerQueue.add('index-block', { blockHeight });
}

export async function scheduleRangeIndex(
  startHeight: number,
  endHeight: number
): Promise<void> {
  await indexerQueue.add('index-range', { startHeight, endHeight });
}

export async function startContinuousSync(pollInterval?: number): Promise<void> {
  // Remove any existing continuous sync jobs
  const jobs = await indexerQueue.getJobs(['active', 'waiting', 'delayed']);
  for (const job of jobs) {
    if (job.name === 'continuous-sync') {
      await job.remove();
    }
  }
  
  // Add new continuous sync job
  await indexerQueue.add('continuous-sync', { pollInterval }, {
    repeat: {
      every: pollInterval || 10000,
    },
  });
}

export async function stopContinuousSync(): Promise<void> {
  blockIndexer.stopIndexing();
  
  // Remove continuous sync jobs
  const jobs = await indexerQueue.getJobs(['active', 'waiting', 'delayed']);
  for (const job of jobs) {
    if (job.name === 'continuous-sync') {
      await job.remove();
    }
  }
}

export async function scheduleViewingKeyScan(
  viewingKey: string,
  userId?: string,
  startBlock?: number,
  endBlock?: number
): Promise<void> {
  await viewingKeyQueue.add('scan-viewing-key', {
    viewingKey,
    userId,
    startBlock,
    endBlock,
  });
}

// Periodic re-indexing scheduler
export async function schedulePeriodicReindex(
  intervalHours: number = 24
): Promise<void> {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  // Schedule a job to re-index recent blocks periodically
  await indexerQueue.add(
    'periodic-reindex',
    {},
    {
      repeat: {
        every: intervalMs,
      },
    }
  );
}

// Process periodic re-index jobs
indexerQueue.process('periodic-reindex', async (_job) => {
  console.log('Running periodic re-index');
  
  try {
    // Get current blockchain height
    const currentHeight = await zcashRPCClient.getBlockCount();
    
    // Re-index last 100 blocks to catch any missed transactions
    const startHeight = Math.max(0, currentHeight - 100);
    
    await blockIndexer.indexBlockRange(startHeight, currentHeight);
    
    return { 
      status: 'completed',
      reindexedBlocks: currentHeight - startHeight + 1
    };
  } catch (error: any) {
    console.error('Periodic re-index failed:', error.message);
    throw error;
  }
});

// Graceful shutdown
export async function shutdownWorkers(): Promise<void> {
  console.log('Shutting down workers...');
  
  await stopContinuousSync();
  await indexerQueue.close();
  await viewingKeyQueue.close();
  
  console.log('Workers shut down successfully');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownWorkers();
  process.exit(0);
});

console.log('Indexer worker initialized');
