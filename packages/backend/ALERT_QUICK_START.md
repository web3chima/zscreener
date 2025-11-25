# Alert System Quick Start Guide

## Setup

### 1. Install Dependencies
```bash
cd packages/backend
npm install
```

### 2. Configure Environment
Ensure these variables are set in your `.env` file:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zscreener
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379

# Alert Worker
ALERT_CHECK_INTERVAL=5  # Minutes between periodic checks

# Server
PORT=4000
JWT_SECRET=your-secret-key
```

### 3. Run Database Migrations
```bash
npm run migrate
```

## Running the System

### Start Backend Server (with WebSocket)
```bash
npm run dev
```

### Start Alert Worker
```bash
npm run alert-worker:dev
```

## Quick API Examples

### 1. Create a Transaction Alert
```bash
curl -X POST http://localhost:4000/api/alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transaction",
    "conditions": {
      "transactionType": "any"
    },
    "notificationMethod": "ui"
  }'
```

### 2. Create a Threshold Alert
```bash
curl -X POST http://localhost:4000/api/alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "threshold",
    "conditions": {
      "thresholdType": "transaction_count",
      "thresholdValue": 1000,
      "thresholdOperator": "greater_than"
    },
    "notificationMethod": "ui"
  }'
```

### 3. Get All Alerts
```bash
curl http://localhost:4000/api/alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Test an Alert
```bash
curl -X POST http://localhost:4000/api/alerts/ALERT_ID/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## WebSocket Client Example

### JavaScript/TypeScript
```javascript
import io from 'socket.io-client';

// Connect to WebSocket server
const socket = io('http://localhost:4000', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Listen for connection
socket.on('connected', (data) => {
  console.log('Connected:', data);
});

// Listen for notifications
socket.on('notification', (notification) => {
  console.log('Alert triggered!');
  console.log('Message:', notification.message);
  console.log('Details:', notification.details);
});

// Listen for errors
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Subscribe to specific alert
socket.emit('alert:subscribe', { alertId: 'your-alert-id' });

// Acknowledge notification
socket.emit('notification:ack', { notificationId: 'notification-id' });
```

### React Hook Example
```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useAlertNotifications(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const newSocket = io('http://localhost:4000', {
      auth: { token }
    });

    newSocket.on('connected', (data) => {
      console.log('Connected to notifications');
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  return { socket, notifications };
}
```

## Testing

### Run Alert System Tests
```bash
npm run alert:test
```

### Manual Testing Steps

1. **Start Services**
   ```bash
   # Terminal 1: Backend
   npm run dev
   
   # Terminal 2: Alert Worker
   npm run alert-worker:dev
   ```

2. **Get JWT Token**
   ```bash
   curl -X POST http://localhost:4000/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{
       "walletAddress": "your-wallet",
       "signature": "your-signature"
     }'
   ```

3. **Create Alert**
   ```bash
   curl -X POST http://localhost:4000/api/alerts \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "network",
       "conditions": { "networkEvent": "new_block" },
       "notificationMethod": "ui"
     }'
   ```

4. **Connect WebSocket Client**
   Use the JavaScript example above

5. **Trigger Alert**
   - Index a new block (if using indexer)
   - Or use test endpoint:
   ```bash
   curl -X POST http://localhost:4000/api/alerts/ALERT_ID/test \
     -H "Authorization: Bearer TOKEN"
   ```

6. **Verify Notification**
   Check WebSocket client console for notification

## Common Alert Configurations

### Monitor Large Transactions
```json
{
  "type": "transaction",
  "conditions": {
    "transactionType": "shielded_input",
    "minAmount": 1000
  },
  "notificationMethod": "ui"
}
```

### Watch Specific Address
```json
{
  "type": "address",
  "conditions": {
    "watchAddress": "zs1abc..."
  },
  "notificationMethod": "webhook",
  "webhookUrl": "https://your-server.com/webhook"
}
```

### Network Activity Alert
```json
{
  "type": "network",
  "conditions": {
    "networkEvent": "high_activity"
  },
  "notificationMethod": "email",
  "email": "user@example.com"
}
```

### Pool Size Threshold
```json
{
  "type": "threshold",
  "conditions": {
    "thresholdType": "pool_size",
    "thresholdValue": 10000,
    "thresholdOperator": "greater_than"
  },
  "notificationMethod": "ui"
}
```

## Troubleshooting

### "Connection refused" Error
- Ensure PostgreSQL is running on port 5432
- Ensure Redis is running on port 6379
- Check `.env` configuration

### "Unauthorized" Error
- Verify JWT token is valid
- Check token expiration
- Ensure user exists in database

### Alerts Not Triggering
- Verify alert worker is running
- Check alert is active (`isActive: true`)
- Review worker logs for errors
- Verify alert conditions match data

### WebSocket Connection Fails
- Check JWT token in auth
- Verify CORS settings
- Check firewall/proxy settings
- Ensure WebSocket server initialized

## File Structure

```
packages/backend/src/
├── types/
│   └── alert.ts              # Alert type definitions
├── services/
│   ├── alert-service.ts      # Alert CRUD operations
│   └── notification-service.ts # WebSocket & notifications
├── workers/
│   └── alert-worker.ts       # Alert monitoring worker
├── routes/
│   └── alerts.ts             # Alert API endpoints
└── scripts/
    ├── start-alert-worker.ts # Worker startup
    └── test-alert-system.ts  # Test suite
```

## Next Steps

1. **Integrate with Indexer**: Add alert checks when indexing transactions
2. **Frontend Integration**: Build UI components for alert management
3. **Email Service**: Integrate with SendGrid/AWS SES for email notifications
4. **Monitoring**: Set up logging and metrics for alert system
5. **Optimization**: Add caching and rate limiting as needed

## Resources

- Full Documentation: `ALERT_SYSTEM.md`
- Implementation Summary: `TASK_8_SUMMARY.md`
- API Endpoints: See `ALERT_SYSTEM.md` → API Endpoints section
- WebSocket Events: See `ALERT_SYSTEM.md` → WebSocket Events section

## Support

For issues or questions:
1. Check logs in console output
2. Review `ALERT_SYSTEM.md` for detailed documentation
3. Run test suite: `npm run alert:test`
4. Check database for alert records
