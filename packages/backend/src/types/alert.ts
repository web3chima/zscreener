// Alert types
export type AlertType = 'transaction' | 'threshold' | 'address' | 'network';
export type NotificationMethod = 'ui' | 'email' | 'webhook';

export interface AlertConditions {
  // Transaction alert conditions
  transactionType?: 'shielded_input' | 'shielded_output' | 'any';
  minAmount?: number;
  maxAmount?: number;
  
  // Address alert conditions
  watchAddress?: string;
  
  // Threshold alert conditions
  thresholdType?: 'pool_size' | 'transaction_count' | 'volume';
  thresholdValue?: number;
  thresholdOperator?: 'greater_than' | 'less_than' | 'equals';
  
  // Network alert conditions
  networkEvent?: 'new_block' | 'high_activity' | 'low_activity';
  
  // Time-based conditions
  timeWindow?: number; // in seconds
}

export interface AlertConfig {
  type: AlertType;
  conditions: AlertConditions;
  notificationMethod: NotificationMethod;
  webhookUrl?: string;
  email?: string;
}

export interface Alert {
  id: string;
  userId: string;
  alertType: AlertType;
  conditions: AlertConditions;
  notificationMethod: NotificationMethod;
  webhookUrl?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  triggeredAt: Date;
  notificationData: {
    message: string;
    details: any;
  };
}

export interface CreateAlertRequest {
  type: AlertType;
  conditions: AlertConditions;
  notificationMethod: NotificationMethod;
  webhookUrl?: string;
  email?: string;
}

export interface AlertValidationError {
  field: string;
  message: string;
}
