import dotenv from 'dotenv';
import { startContinuousSync, schedulePeriodicReindex } from '../workers/indexer-worker.js';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startWorker() {
  console.log('Starting Zscreener workers...');
  
  try {
    // 1. Start Indexer (Continuous Sync) - Runs in this process
    const pollInterval = parseInt(process.env.INDEXER_POLL_INTERVAL || '10000');
    await startContinuousSync(pollInterval);
    console.log(`Continuous sync started with ${pollInterval}ms poll interval`);
    
    // 2. Schedule Periodic Re-indexing
    const reindexInterval = parseInt(process.env.REINDEX_INTERVAL_HOURS || '24');
    await schedulePeriodicReindex(reindexInterval);
    console.log(`Periodic re-indexing scheduled every ${reindexInterval} hours`);

    // 3. Start Chain Synchronizer (Separate Process)
    // This handles block headers and advanced chain state logic independently

    // Determine correct file extension and location based on execution context
    const isCompiled = __filename.endsWith('.js');
    const workerExtension = isCompiled ? 'js' : 'ts';
    const chainSyncPath = path.resolve(__dirname, `../workers/chain-sync.${workerExtension}`);

    console.log(`Spawning Chain Sync Worker from ${chainSyncPath} (Compiled: ${isCompiled})...`);

    // In production/compiled mode, we don't need tsx loader
    const execArgv = isCompiled ? [] : ['--import', 'tsx'];

    const chainSyncWorker = fork(chainSyncPath, [], {
      execArgv,
      env: { ...process.env }
    });

    chainSyncWorker.on('error', (err) => console.error('[ChainSync Worker Error]:', err));
    chainSyncWorker.on('exit', (code) => {
        if (code !== 0) console.warn(`[ChainSync Worker] stopped with code ${code}`);
    });
    
    console.log('All workers initialized. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}

startWorker();
