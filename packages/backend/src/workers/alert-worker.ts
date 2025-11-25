import Queue from 'bull';
import { alertService } from '../services/alert-service.js';
import { notificationService } from '../services/notification-service.js';
import { pool } from '../config/database.js';
import { Alert, AlertConditions } from '../types/alert.js';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Job data interfaces
interface CheckAlertsJobData {
  transactionId?: string;
  blockHeight?: number;
}

interface EvaluateAlertJobData {
  alertId: string;
  context: {
    transactionId?: string;
    blockHeight?: number;
    networkStats?: any;
  };
}

// Create Bull queue for alert monitoring
export const alertQueue = new Queue('alerts', redisUrl, {
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

/**
 * Process check-alerts job
 * Triggered when new transactions are indexed or periodically
 */
alertQueue.process('check-alerts', async (job) => {
  const { transactionId, blockHeight } = job.data as CheckAlertsJobData;

  console.log(`Checking alerts for transaction ${transactionId || 'all'}, block ${blockHeight || 'N/A'}`);

  try {
    // Get all active alerts
    const alerts = await alertService.getAllActiveAlerts();

    if (alerts.length === 0) {
      return { checked: 0, triggered: 0 };
    }

    let triggeredCount = 0;

    // Evaluate each alert
    for (const alert of alerts) {
      const triggered = await evaluateAlert(alert, { transactionId, blockHeight });
      if (triggered) {
        triggeredCount++;
      }
    }

    return { checked: alerts.length, triggered: triggeredCount };
  } catch (error: any) {
    console.error('Failed to check alerts:', error.message);
    throw error;
  }
});

/**
 * Process evaluate-alert job
 * Evaluates a specific alert against given context
 */
alertQueue.process('evaluate-alert', async (job) => {
  const { alertId, context } = job.data as EvaluateAlertJobData;

  console.log(`Evaluating alert ${alertId}`);

  try {
    // Get alert details
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM alerts WHERE id = $1 AND is_active = true', [
        alertId,
      ]);

      if (result.rows.length === 0) {
        return { evaluated: false, reason: 'Alert not found or inactive' };
      }

      const alert: Alert = {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        alertType: result.rows[0].alert_type,
        conditions: result.rows[0].conditions,
        notificationMethod: result.rows[0].notification_method,
        webhookUrl: result.rows[0].webhook_url,
        email: result.rows[0].email,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at,
      };

      const triggered = await evaluateAlert(alert, context);

      return { evaluated: true, triggered };
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error(`Failed to evaluate alert ${alertId}:`, error.message);
    throw error;
  }
});

/**
 * Evaluate alert conditions
 * Returns true if alert should be triggered
 */
async function evaluateAlert(
  alert: Alert,
  context: { transactionId?: string; blockHeight?: number; networkStats?: any }
): Promise<boolean> {
  try {
    switch (alert.alertType) {
      case 'transaction':
        return await evaluateTransactionAlert(alert, context);
      case 'address':
        return await evaluateAddressAlert(alert, context);
      case 'threshold':
        return await evaluateThresholdAlert(alert, context);
      case 'network':
        return await evaluateNetworkAlert(alert, context);
      default:
        console.warn(`Unknown alert type: ${alert.alertType}`);
        return false;
    }
  } catch (error: any) {
    console.error(`Error evaluating alert ${alert.id}:`, error.message);
    return false;
  }
}

/**
 * Evaluate transaction alert
 */
async function evaluateTransactionAlert(
  alert: Alert,
  context: { transactionId?: string }
): Promise<boolean> {
  if (!context.transactionId) {
    return false;
  }

  const client = await pool.connect();
  try {
    const conditions = alert.conditions as AlertConditions;

    // Get transaction details
    const result = await client.query(
      'SELECT * FROM shielded_transactions WHERE id = $1',
      [context.transactionId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const transaction = result.rows[0];

    // Check transaction type
    if (conditions.transactionType) {
      if (conditions.transactionType === 'shielded_input' && transaction.shielded_inputs === 0) {
        return false;
      }
      if (conditions.transactionType === 'shielded_output' && transaction.shielded_outputs === 0) {
        return false;
      }
    }

    // For amount checks, we would need to parse the transaction value
    // This is a simplified check - in production, extract actual amounts
    const hasShieldedActivity = transaction.shielded_inputs > 0 || transaction.shielded_outputs > 0;

    if (hasShieldedActivity) {
      // Trigger notification
      const notification = await alertService.storeAlertNotification(
        alert.id,
        'New shielded transaction detected',
        {
          transactionHash: transaction.tx_hash,
          blockHeight: transaction.block_height,
          shieldedInputs: transaction.shielded_inputs,
          shieldedOutputs: transaction.shielded_outputs,
        }
      );

      // Deliver notification
      await notificationService.deliverNotification(alert.id, notification);

      return true;
    }

    return false;
  } finally {
    client.release();
  }
}

/**
 * Evaluate address alert
 */
async function evaluateAddressAlert(
  alert: Alert,
  context: { transactionId?: string }
): Promise<boolean> {
  if (!context.transactionId) {
    return false;
  }

  const client = await pool.connect();
  try {
    const conditions = alert.conditions as AlertConditions;

    if (!conditions.watchAddress) {
      return false;
    }

    // Check if transaction involves the watched address
    // This would require parsing transaction data for addresses
    // For now, we'll check viewing key associations
    const result = await client.query(
      `SELECT st.* FROM shielded_transactions st
       JOIN viewing_key_transactions vkt ON st.id = vkt.transaction_id
       WHERE st.id = $1 AND vkt.viewing_key_hash = $2`,
      [context.transactionId, conditions.watchAddress]
    );

    if (result.rows.length > 0) {
      const transaction = result.rows[0];

      const notification = await alertService.storeAlertNotification(
        alert.id,
        'Transaction detected for watched address',
        {
          transactionHash: transaction.tx_hash,
          blockHeight: transaction.block_height,
          watchAddress: conditions.watchAddress,
        }
      );

      // Deliver notification
      await notificationService.deliverNotification(alert.id, notification);

      return true;
    }

    return false;
  } finally {
    client.release();
  }
}

/**
 * Evaluate threshold alert
 */
async function evaluateThresholdAlert(
  alert: Alert,
  _context: { networkStats?: any }
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const conditions = alert.conditions as AlertConditions;

    if (!conditions.thresholdType || conditions.thresholdValue === undefined) {
      return false;
    }

    let currentValue: number = 0;

    // Get current value based on threshold type
    switch (conditions.thresholdType) {
      case 'transaction_count': {
        const result = await client.query('SELECT COUNT(*) as count FROM shielded_transactions');
        currentValue = parseInt(result.rows[0].count);
        break;
      }
      case 'pool_size': {
        // Calculate shielded pool size (simplified)
        const result = await client.query(
          'SELECT SUM(shielded_outputs) as pool_size FROM shielded_transactions'
        );
        currentValue = parseInt(result.rows[0].pool_size || '0');
        break;
      }
      case 'volume': {
        // Calculate 24h volume (simplified)
        const result = await client.query(
          `SELECT COUNT(*) as volume FROM shielded_transactions
           WHERE timestamp > NOW() - INTERVAL '24 hours'`
        );
        currentValue = parseInt(result.rows[0].volume);
        break;
      }
    }

    // Check threshold condition
    let triggered = false;
    switch (conditions.thresholdOperator) {
      case 'greater_than':
        triggered = currentValue > conditions.thresholdValue;
        break;
      case 'less_than':
        triggered = currentValue < conditions.thresholdValue;
        break;
      case 'equals':
        triggered = currentValue === conditions.thresholdValue;
        break;
    }

    if (triggered) {
      const notification = await alertService.storeAlertNotification(
        alert.id,
        `Threshold alert triggered: ${conditions.thresholdType}`,
        {
          thresholdType: conditions.thresholdType,
          thresholdValue: conditions.thresholdValue,
          currentValue,
          operator: conditions.thresholdOperator,
        }
      );

      // Deliver notification
      await notificationService.deliverNotification(alert.id, notification);

      return true;
    }

    return false;
  } finally {
    client.release();
  }
}

/**
 * Evaluate network alert
 */
async function evaluateNetworkAlert(
  alert: Alert,
  context: { blockHeight?: number }
): Promise<boolean> {
  const conditions = alert.conditions as AlertConditions;

  if (!conditions.networkEvent) {
    return false;
  }

  // Check network event
  switch (conditions.networkEvent) {
    case 'new_block':
      if (context.blockHeight) {
        const notification = await alertService.storeAlertNotification(
          alert.id,
          'New block detected',
          {
            blockHeight: context.blockHeight,
          }
        );
        
        // Deliver notification
        await notificationService.deliverNotification(alert.id, notification);
        
        return true;
      }
      break;

    case 'high_activity':
    case 'low_activity': {
      // Check recent transaction activity
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT COUNT(*) as count FROM shielded_transactions
           WHERE timestamp > NOW() - INTERVAL '1 hour'`
        );
        const recentCount = parseInt(result.rows[0].count);

        const isHighActivity = recentCount > 100; // Threshold for high activity
        const isLowActivity = recentCount < 10; // Threshold for low activity

        if (
          (conditions.networkEvent === 'high_activity' && isHighActivity) ||
          (conditions.networkEvent === 'low_activity' && isLowActivity)
        ) {
          const notification = await alertService.storeAlertNotification(
            alert.id,
            `Network ${conditions.networkEvent} detected`,
            {
              recentTransactionCount: recentCount,
              timeWindow: '1 hour',
            }
          );
          
          // Deliver notification
          await notificationService.deliverNotification(alert.id, notification);
          
          return true;
        }
      } finally {
        client.release();
      }
      break;
    }
  }

  return false;
}

// Queue event handlers
alertQueue.on('completed', (job, result) => {
  console.log(`Alert job ${job.id} completed:`, result);
});

alertQueue.on('failed', (job, err) => {
  console.error(`Alert job ${job?.id} failed:`, err.message);
});

// Helper functions to add jobs to queue
export async function scheduleAlertCheck(
  transactionId?: string,
  blockHeight?: number
): Promise<void> {
  await alertQueue.add('check-alerts', { transactionId, blockHeight });
}

export async function scheduleAlertEvaluation(
  alertId: string,
  context: { transactionId?: string; blockHeight?: number; networkStats?: any }
): Promise<void> {
  await alertQueue.add('evaluate-alert', { alertId, context });
}

/**
 * Start periodic alert checking
 */
export async function startPeriodicAlertChecking(intervalMinutes: number = 5): Promise<void> {
  const intervalMs = intervalMinutes * 60 * 1000;

  // Remove any existing periodic check jobs
  const jobs = await alertQueue.getJobs(['active', 'waiting', 'delayed']);
  for (const job of jobs) {
    if (job.name === 'periodic-check') {
      await job.remove();
    }
  }

  // Add new periodic check job
  await alertQueue.add(
    'periodic-check',
    {},
    {
      repeat: {
        every: intervalMs,
      },
    }
  );

  console.log(`Periodic alert checking started (every ${intervalMinutes} minutes)`);
}

// Process periodic check jobs
alertQueue.process('periodic-check', async (_job) => {
  console.log('Running periodic alert check');

  try {
    // Check all threshold and network alerts
    const alerts = await alertService.getAllActiveAlerts();

    let triggeredCount = 0;

    for (const alert of alerts) {
      if (alert.alertType === 'threshold' || alert.alertType === 'network') {
        const triggered = await evaluateAlert(alert, {});
        if (triggered) {
          triggeredCount++;
        }
      }
    }

    return { checked: alerts.length, triggered: triggeredCount };
  } catch (error: any) {
    console.error('Periodic alert check failed:', error.message);
    throw error;
  }
});

/**
 * Stop periodic alert checking
 */
export async function stopPeriodicAlertChecking(): Promise<void> {
  const jobs = await alertQueue.getJobs(['active', 'waiting', 'delayed']);
  for (const job of jobs) {
    if (job.name === 'periodic-check') {
      await job.remove();
    }
  }

  console.log('Periodic alert checking stopped');
}

// Graceful shutdown
export async function shutdownAlertWorker(): Promise<void> {
  console.log('Shutting down alert worker...');

  await stopPeriodicAlertChecking();
  await alertQueue.close();

  console.log('Alert worker shut down successfully');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownAlertWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownAlertWorker();
  process.exit(0);
});

console.log('Alert worker initialized');
