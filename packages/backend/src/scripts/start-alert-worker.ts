import dotenv from 'dotenv';
import { startPeriodicAlertChecking } from '../workers/alert-worker.js';

dotenv.config();

async function main() {
  console.log('Starting alert worker...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);

  try {
    // Start periodic alert checking (every 5 minutes by default)
    const checkIntervalMinutes = parseInt(process.env.ALERT_CHECK_INTERVAL || '5');
    await startPeriodicAlertChecking(checkIntervalMinutes);

    console.log('Alert worker started successfully');
    console.log(`Periodic alert checking enabled (every ${checkIntervalMinutes} minutes)`);
    console.log('Worker is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Failed to start alert worker:', error);
    process.exit(1);
  }
}

main();
