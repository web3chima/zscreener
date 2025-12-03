import { chainSynchronizer } from '../services/chain-synchronizer.js';

async function runChainSync() {
  console.log('Initializing chain sync worker...');

  // Handle graceful shutdown
  const shutdown = () => {
    chainSynchronizer.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await chainSynchronizer.start();
  } catch (error) {
    console.error('Chain sync worker crashed:', error);
    process.exit(1);
  }
}

// Start the worker
runChainSync();
