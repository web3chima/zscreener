import dotenv from 'dotenv';
import { startContinuousSync, schedulePeriodicReindex } from '../workers/indexer-worker.js';

dotenv.config();

async function startWorker() {
  console.log('Starting Zscreener indexer worker...');
  
  try {
    // Start continuous blockchain sync
    const pollInterval = parseInt(process.env.INDEXER_POLL_INTERVAL || '10000');
    await startContinuousSync(pollInterval);
    console.log(`Continuous sync started with ${pollInterval}ms poll interval`);
    
    // Schedule periodic re-indexing (every 24 hours by default)
    const reindexInterval = parseInt(process.env.REINDEX_INTERVAL_HOURS || '24');
    await schedulePeriodicReindex(reindexInterval);
    console.log(`Periodic re-indexing scheduled every ${reindexInterval} hours`);
    
    console.log('Worker is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
