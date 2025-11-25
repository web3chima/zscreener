# Alert System Documentation

## Overview

The Zscreener alert system provides real-time notifications for blockchain events, transaction activities, and network conditions. Users can configure custom alerts with various conditions and receive notifications through multiple channels.

## Architecture

The alert system consists of four main components:

1. **Alert Service** (`src/services/alert-service.ts`) - Manages alert configuration and storage
2. **Alert Worker** (`src/workers/alert-worker.ts`) - Monitors blockchain and evaluates alert conditions
3. **Notification Service** (`src/services/notification-service.ts`) - Delivers notifications via WebSocket, email, or webhook
4. **Alert Routes** (`src/routes/alerts.ts`) - REST API endpoints for alert management

## Alert Types

### 1. Transaction Alerts
Monitor shielded transactions based on specific criteria.

**Conditions:**
- `transactionType`: 'shielded_input' | 'shielded_output' | 'any'
- `minAmount`: Minimum transaction amount (optional)
- `maxAmount`: Maximum transaction amount (optional)

**Example:**
```json
{
  "type": "transaction",
  "conditions": {
    "transactionType": "shielded_input",
    "minAmount": 100
  },
  "notificationMethod": "ui"
}
```

### 2. Address Alerts
Monitor specific addresses for transaction activity.

**Conditions:**
- `watchAddress`: Address or viewing key hash to monitor

**Example:**
```json
{
  "type": "address",
  "conditions": {
    "watchAddress": "zs1abc..."
  },
  "notificationMethod": "webhook",
  "webhookUrl": "https://example.com/webhook"
}
```

### 3. Threshold Alerts
Trigger when network metrics cross specified thresholds.

**Conditions:**
- `thresholdType`: 'pool_size' | 'transaction_count' | 'volume'
- `thresholdValue`: Numeric threshold value
- `thresholdOperator`: 'greater_than' | 'less_than' | 'equals'

**Example:**
```json
{
  "type": "threshold",
  "conditions": {
    "thresholdType": "transaction_count",
    "thresholdValue": 1000,
    "thresholdOperator": "greater_than"
  },
  "notificationMethod": "email",
  "email": "user@example.com"
}
```

### 4. Network Alerts
Monitor network-wide events and activity levels.

**Conditions:**
- `networkEvent`: 'new_block' | 'high_activity' | 'low_activity'

**Example:**
```json
{
  "type": "network",
  "conditions": {
    "networkEvent": "new_block"
  },
  "notificationMethod": "ui"
}
```

## Notification Methods

### UI Notifications (WebSocket)
Real-time notifications delivered through WebSocket connection.

**Features:**
- Instant delivery to connected clients
- No configuration required
- Supports multiple simultaneous connections per user

**Client Connection:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('notification', (data) => {
  console.log('Alert triggered:', data);
});
```

### Email Notifications
Notifications sent via email (requires email service integration).

**Configuration:**
- Set `notificationMethod` to 'email'
- Provide `email` field with recipient address

**Note:** Email delivery requires integration with an email service provider (SendGrid, AWS SES, etc.)

### Webhook Notifications
HTTP POST requests sent to specified webhook URL.

**Configuration:**
- Set `notificationMethod` to 'webhook'
- Provide `webhookUrl` field with endpoint URL

**Payload Format:**
```json
{
  "id": "notification-id",
  "alertId": "alert-id",
  "message": "Alert message",
  "details": {
    "transactionHash": "...",
    "blockHeight": 12345
  },
  "triggeredAt": "2024-01-01T00:00:00.000Z",
  "timestamp": 1704067200000
}
```

## API Endpoints

### Create Alert
```
POST /api/alerts
Authorization: Bearer <token>

Body:
{
  "type": "transaction",
  "conditions": { ... },
  "notificationMethod": "ui"
}

Response:
{
  "success": true,
  "data": {
    "id": "alert-id",
    "userId": "user-id",
    "alertType": "transaction",
    "conditions": { ... },
    "notificationMethod": "ui",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get User Alerts
```
GET /api/alerts?active=true
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "alerts": [...],
    "count": 5
  }
}
```

### Get Alert by ID
```
GET /api/alerts/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": "alert-id",
    ...
  }
}
```

### Delete Alert
```
DELETE /api/alerts/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

### Update Alert Status
```
PATCH /api/alerts/:id/status
Authorization: Bearer <token>

Body:
{
  "isActive": false
}

Response:
{
  "success": true,
  "message": "Alert deactivated successfully"
}
```

### Get Notification History
```
GET /api/alerts/notifications/history?limit=50
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "notifications": [...],
    "count": 10
  }
}
```

### Test Alert
```
POST /api/alerts/:id/test
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Test notification sent",
  "data": {
    "id": "notification-id",
    ...
  }
}
```

## Alert Worker

The alert worker runs as a separate process and continuously monitors for alert conditions.

### Starting the Worker

**Development:**
```bash
npm run alert-worker:dev
```

**Production:**
```bash
npm run alert-worker
```

### Configuration

Environment variables:
- `ALERT_CHECK_INTERVAL`: Interval in minutes for periodic checks (default: 5)
- `REDIS_URL`: Redis connection URL for Bull queue
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection

### Worker Jobs

1. **check-alerts**: Triggered when new transactions are indexed
2. **evaluate-alert**: Evaluates a specific alert against context
3. **periodic-check**: Runs periodically to check threshold and network alerts

### Integration with Indexer

To trigger alerts when new transactions are indexed, add this to your indexer:

```typescript
import { scheduleAlertCheck } from './workers/alert-worker.js';

// After indexing a transaction
await scheduleAlertCheck(transactionId, blockHeight);
```

## WebSocket Events

### Client → Server

**Connect:**
```javascript
socket.on('connect', () => {
  console.log('Connected to notification service');
});
```

**Subscribe to Alert:**
```javascript
socket.emit('alert:subscribe', { alertId: 'alert-id' });
```

**Unsubscribe from Alert:**
```javascript
socket.emit('alert:unsubscribe', { alertId: 'alert-id' });
```

**Acknowledge Notification:**
```javascript
socket.emit('notification:ack', { notificationId: 'notification-id' });
```

### Server → Client

**Connection Success:**
```javascript
socket.on('connected', (data) => {
  console.log('Connected:', data.userId);
});
```

**Notification:**
```javascript
socket.on('notification', (data) => {
  console.log('Alert triggered:', data.message);
});
```

**Alert-Specific Notification:**
```javascript
socket.on('alert-notification', (data) => {
  console.log('Alert notification:', data);
});
```

**Broadcast:**
```javascript
socket.on('broadcast', (data) => {
  console.log('System broadcast:', data.message);
});
```

**Error:**
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Testing

### Run Alert System Tests
```bash
npm run alert:test
```

This will:
1. Create test alerts of different types
2. Validate alert configuration
3. Test notification creation
4. Verify alert retrieval and deletion
5. Test webhook configuration

### Manual Testing

1. Start the backend server:
```bash
npm run dev
```

2. Start the alert worker:
```bash
npm run alert-worker:dev
```

3. Create an alert via API:
```bash
curl -X POST http://localhost:4000/api/alerts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transaction",
    "conditions": { "transactionType": "any" },
    "notificationMethod": "ui"
  }'
```

4. Connect WebSocket client and wait for notifications

## Database Schema

### alerts table
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  alert_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  notification_method VARCHAR(50),
  webhook_url TEXT,
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### alert_notifications table
```sql
CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id),
  triggered_at TIMESTAMP DEFAULT NOW(),
  notification_data JSONB
);
```

## Best Practices

1. **Alert Limits**: Consider implementing per-user alert limits to prevent abuse
2. **Rate Limiting**: Implement rate limiting for alert creation endpoints
3. **Notification Throttling**: Avoid sending duplicate notifications for the same event
4. **Webhook Retries**: Implement retry logic for failed webhook deliveries
5. **Email Queuing**: Use a queue for email notifications to handle high volumes
6. **WebSocket Reconnection**: Implement automatic reconnection in client applications
7. **Alert Expiration**: Consider adding expiration dates for alerts
8. **Notification History**: Regularly archive old notifications to maintain performance

## Troubleshooting

### Alerts Not Triggering

1. Check if alert worker is running
2. Verify alert is active (`is_active = true`)
3. Check worker logs for evaluation errors
4. Verify alert conditions match actual data

### WebSocket Connection Issues

1. Verify JWT token is valid
2. Check CORS configuration
3. Ensure WebSocket server is initialized
4. Check firewall/proxy settings

### Webhook Delivery Failures

1. Verify webhook URL is accessible
2. Check webhook endpoint accepts POST requests
3. Review webhook timeout settings (default: 5s)
4. Check webhook endpoint logs for errors

## Future Enhancements

- [ ] Alert templates for common use cases
- [ ] Alert scheduling (time-based activation)
- [ ] Alert grouping and batching
- [ ] Advanced filtering with complex conditions
- [ ] Alert analytics and statistics
- [ ] Multi-channel notifications (SMS, push notifications)
- [ ] Alert sharing between users
- [ ] Conditional alert chains (if-then-else logic)
