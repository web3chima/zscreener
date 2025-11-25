import { pool } from '../config/database.js';
import {
  Alert,
  AlertConfig,
  AlertNotification,
  AlertConditions,
  AlertValidationError,
  AlertType,
  NotificationMethod,
} from '../types/alert.js';

export class AlertService {
  /**
   * Create a new alert for a user
   * Validates the alert configuration before storing
   */
  async createAlert(userId: string, config: AlertConfig): Promise<Alert> {
    // Validate alert configuration
    const validationErrors = this.validateAlertConfig(config);
    if (validationErrors.length > 0) {
      throw new Error(
        `Alert validation failed: ${validationErrors.map((e) => e.message).join(', ')}`
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO alerts (user_id, alert_type, conditions, notification_method, webhook_url, email, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, alert_type, conditions, notification_method, webhook_url, email, is_active, created_at`,
        [
          userId,
          config.type,
          JSON.stringify(config.conditions),
          config.notificationMethod,
          config.webhookUrl || null,
          config.email || null,
          true,
        ]
      );

      const row = result.rows[0];
      return this.mapRowToAlert(row);
    } finally {
      client.release();
    }
  }

  /**
   * Validate alert configuration
   * Returns array of validation errors (empty if valid)
   */
  validateAlertConfig(config: AlertConfig): AlertValidationError[] {
    const errors: AlertValidationError[] = [];

    // Validate alert type
    const validTypes: AlertType[] = ['transaction', 'threshold', 'address', 'network'];
    if (!validTypes.includes(config.type)) {
      errors.push({
        field: 'type',
        message: `Invalid alert type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Validate notification method
    const validMethods: NotificationMethod[] = ['ui', 'email', 'webhook'];
    if (!validMethods.includes(config.notificationMethod)) {
      errors.push({
        field: 'notificationMethod',
        message: `Invalid notification method. Must be one of: ${validMethods.join(', ')}`,
      });
    }

    // Validate webhook URL if webhook method is selected
    if (config.notificationMethod === 'webhook' && !config.webhookUrl) {
      errors.push({
        field: 'webhookUrl',
        message: 'Webhook URL is required when notification method is webhook',
      });
    }

    // Validate email if email method is selected
    if (config.notificationMethod === 'email' && !config.email) {
      errors.push({
        field: 'email',
        message: 'Email is required when notification method is email',
      });
    }

    // Validate conditions based on alert type
    errors.push(...this.validateAlertConditions(config.type, config.conditions));

    return errors;
  }

  /**
   * Validate alert conditions based on alert type
   */
  private validateAlertConditions(
    type: AlertType,
    conditions: AlertConditions
  ): AlertValidationError[] {
    const errors: AlertValidationError[] = [];

    switch (type) {
      case 'transaction':
        if (conditions.minAmount !== undefined && conditions.minAmount < 0) {
          errors.push({
            field: 'conditions.minAmount',
            message: 'Minimum amount must be non-negative',
          });
        }
        if (conditions.maxAmount !== undefined && conditions.maxAmount < 0) {
          errors.push({
            field: 'conditions.maxAmount',
            message: 'Maximum amount must be non-negative',
          });
        }
        if (
          conditions.minAmount !== undefined &&
          conditions.maxAmount !== undefined &&
          conditions.minAmount > conditions.maxAmount
        ) {
          errors.push({
            field: 'conditions',
            message: 'Minimum amount cannot be greater than maximum amount',
          });
        }
        break;

      case 'address':
        if (!conditions.watchAddress) {
          errors.push({
            field: 'conditions.watchAddress',
            message: 'Watch address is required for address alerts',
          });
        }
        break;

      case 'threshold':
        if (!conditions.thresholdType) {
          errors.push({
            field: 'conditions.thresholdType',
            message: 'Threshold type is required for threshold alerts',
          });
        }
        if (conditions.thresholdValue === undefined) {
          errors.push({
            field: 'conditions.thresholdValue',
            message: 'Threshold value is required for threshold alerts',
          });
        }
        if (!conditions.thresholdOperator) {
          errors.push({
            field: 'conditions.thresholdOperator',
            message: 'Threshold operator is required for threshold alerts',
          });
        }
        break;

      case 'network':
        if (!conditions.networkEvent) {
          errors.push({
            field: 'conditions.networkEvent',
            message: 'Network event is required for network alerts',
          });
        }
        break;
    }

    return errors;
  }

  /**
   * Get all alerts for a user
   */
  async getUserAlerts(userId: string, activeOnly: boolean = false): Promise<Alert[]> {
    const client = await pool.connect();
    try {
      const query = activeOnly
        ? `SELECT * FROM alerts WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`
        : `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`;

      const result = await client.query(query, [userId]);
      return result.rows.map((row) => this.mapRowToAlert(row));
    } finally {
      client.release();
    }
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId: string, userId: string): Promise<Alert | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
        [alertId, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAlert(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string, userId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING id',
        [alertId, userId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Update alert active status
   */
  async updateAlertStatus(
    alertId: string,
    userId: string,
    isActive: boolean
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE alerts SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
        [isActive, alertId, userId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Get all active alerts (for monitoring worker)
   */
  async getAllActiveAlerts(): Promise<Alert[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM alerts WHERE is_active = true ORDER BY created_at DESC'
      );

      return result.rows.map((row) => this.mapRowToAlert(row));
    } finally {
      client.release();
    }
  }

  /**
   * Store triggered alert notification
   */
  async storeAlertNotification(
    alertId: string,
    message: string,
    details: any
  ): Promise<AlertNotification> {
    const client = await pool.connect();
    try {
      const notificationData = {
        message,
        details,
      };

      const result = await client.query(
        `INSERT INTO alert_notifications (alert_id, notification_data)
         VALUES ($1, $2)
         RETURNING id, alert_id, triggered_at, notification_data`,
        [alertId, JSON.stringify(notificationData)]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        alertId: row.alert_id,
        triggeredAt: row.triggered_at,
        notificationData: row.notification_data,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get alert notifications for a user
   */
  async getUserAlertNotifications(
    userId: string,
    limit: number = 50
  ): Promise<AlertNotification[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT an.id, an.alert_id, an.triggered_at, an.notification_data
         FROM alert_notifications an
         JOIN alerts a ON an.alert_id = a.id
         WHERE a.user_id = $1
         ORDER BY an.triggered_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        alertId: row.alert_id,
        triggeredAt: row.triggered_at,
        notificationData: row.notification_data,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Alert object
   */
  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      userId: row.user_id,
      alertType: row.alert_type,
      conditions: row.conditions,
      notificationMethod: row.notification_method,
      webhookUrl: row.webhook_url,
      email: row.email,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}

export const alertService = new AlertService();
