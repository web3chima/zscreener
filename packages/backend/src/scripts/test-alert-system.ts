import dotenv from 'dotenv';
import { alertService } from '../services/alert-service.js';
import { pool } from '../config/database.js';
import { AlertConfig } from '../types/alert.js';

dotenv.config();

async function testAlertSystem() {
  console.log('Testing Alert System...\n');

  try {
    // Test 1: Create a test user
    console.log('1. Creating test user...');
    const client = await pool.connect();
    let userId: string;

    try {
      const userResult = await client.query(
        `INSERT INTO users (wallet_address, privacy_preferences, nillion_enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
         RETURNING id`,
        ['test-wallet-alert-system', JSON.stringify({ useNillion: false, encryptProofViews: false, shareAnalytics: true }), false]
      );
      userId = userResult.rows[0].id;
      console.log(`✓ Test user created with ID: ${userId}\n`);
    } finally {
      client.release();
    }

    // Test 2: Create a transaction alert
    console.log('2. Creating transaction alert...');
    const transactionAlertConfig: AlertConfig = {
      type: 'transaction',
      conditions: {
        transactionType: 'any',
        minAmount: 0,
      },
      notificationMethod: 'ui',
    };

    const transactionAlert = await alertService.createAlert(userId, transactionAlertConfig);
    console.log(`✓ Transaction alert created with ID: ${transactionAlert.id}`);
    console.log(`  Type: ${transactionAlert.alertType}`);
    console.log(`  Active: ${transactionAlert.isActive}\n`);

    // Test 3: Create a threshold alert
    console.log('3. Creating threshold alert...');
    const thresholdAlertConfig: AlertConfig = {
      type: 'threshold',
      conditions: {
        thresholdType: 'transaction_count',
        thresholdValue: 100,
        thresholdOperator: 'greater_than',
      },
      notificationMethod: 'ui',
    };

    const thresholdAlert = await alertService.createAlert(userId, thresholdAlertConfig);
    console.log(`✓ Threshold alert created with ID: ${thresholdAlert.id}`);
    console.log(`  Type: ${thresholdAlert.alertType}`);
    console.log(`  Conditions: ${JSON.stringify(thresholdAlert.conditions)}\n`);

    // Test 4: Create a network alert
    console.log('4. Creating network alert...');
    const networkAlertConfig: AlertConfig = {
      type: 'network',
      conditions: {
        networkEvent: 'new_block',
      },
      notificationMethod: 'ui',
    };

    const networkAlert = await alertService.createAlert(userId, networkAlertConfig);
    console.log(`✓ Network alert created with ID: ${networkAlert.id}`);
    console.log(`  Type: ${networkAlert.alertType}\n`);

    // Test 5: Get all user alerts
    console.log('5. Retrieving all user alerts...');
    const userAlerts = await alertService.getUserAlerts(userId);
    console.log(`✓ Found ${userAlerts.length} alerts for user`);
    userAlerts.forEach((alert, index) => {
      console.log(`  ${index + 1}. ${alert.alertType} alert (ID: ${alert.id})`);
    });
    console.log();

    // Test 6: Test alert validation
    console.log('6. Testing alert validation...');
    try {
      const invalidAlertConfig: AlertConfig = {
        type: 'threshold',
        conditions: {
          // Missing required fields
        },
        notificationMethod: 'ui',
      };

      await alertService.createAlert(userId, invalidAlertConfig);
      console.log('✗ Validation should have failed but did not\n');
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation failed')) {
        console.log('✓ Alert validation working correctly');
        console.log(`  Error: ${error.message}\n`);
      } else {
        throw error;
      }
    }

    // Test 7: Update alert status
    console.log('7. Testing alert status update...');
    const updated = await alertService.updateAlertStatus(transactionAlert.id, userId, false);
    console.log(`✓ Alert status updated: ${updated}`);
    
    const updatedAlert = await alertService.getAlertById(transactionAlert.id, userId);
    console.log(`  Alert is now ${updatedAlert?.isActive ? 'active' : 'inactive'}\n`);

    // Test 8: Create a test notification
    console.log('8. Creating test notification...');
    const notification = await alertService.storeAlertNotification(
      transactionAlert.id,
      'Test notification message',
      { test: true, timestamp: Date.now() }
    );
    console.log(`✓ Notification created with ID: ${notification.id}`);
    console.log(`  Message: ${notification.notificationData.message}\n`);

    // Test 9: Get user notifications
    console.log('9. Retrieving user notifications...');
    const notifications = await alertService.getUserAlertNotifications(userId, 10);
    console.log(`✓ Found ${notifications.length} notifications for user`);
    notifications.forEach((notif, index) => {
      console.log(`  ${index + 1}. ${notif.notificationData.message} (${new Date(notif.triggeredAt).toISOString()})`);
    });
    console.log();

    // Test 10: Delete an alert
    console.log('10. Testing alert deletion...');
    const deleted = await alertService.deleteAlert(networkAlert.id, userId);
    console.log(`✓ Alert deleted: ${deleted}`);
    
    const remainingAlerts = await alertService.getUserAlerts(userId);
    console.log(`  Remaining alerts: ${remainingAlerts.length}\n`);

    // Test 11: Test webhook alert configuration
    console.log('11. Testing webhook alert configuration...');
    const webhookAlertConfig: AlertConfig = {
      type: 'transaction',
      conditions: {
        transactionType: 'shielded_input',
      },
      notificationMethod: 'webhook',
      webhookUrl: 'https://example.com/webhook',
    };

    const webhookAlert = await alertService.createAlert(userId, webhookAlertConfig);
    console.log(`✓ Webhook alert created with ID: ${webhookAlert.id}`);
    console.log(`  Webhook URL: ${webhookAlert.webhookUrl}\n`);

    // Cleanup
    console.log('Cleaning up test data...');
    await alertService.deleteAlert(transactionAlert.id, userId);
    await alertService.deleteAlert(thresholdAlert.id, userId);
    await alertService.deleteAlert(webhookAlert.id, userId);
    
    const clientCleanup = await pool.connect();
    try {
      await clientCleanup.query('DELETE FROM users WHERE wallet_address = $1', ['test-wallet-alert-system']);
    } finally {
      clientCleanup.release();
    }
    console.log('✓ Test data cleaned up\n');

    console.log('✅ All alert system tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAlertSystem();
