# Price Oracle Integration

## Overview

The Price Oracle service provides real-time and historical ZEC (Zcash) price data from CoinGecko API with Redis caching and WebSocket broadcasting for live updates.

## Features

- **Real-time Price Fetching**: Fetches current ZEC price from CoinGecko API
- **Redis Caching**: Caches price data for 60 seconds to reduce API calls
- **WebSocket Broadcasting**: Broadcasts price updates to connected clients when price changes by 0.5% or more
- **Historical Data**: Supports fetching historical price data for up to 365 days
- **Graceful Degradation**: Works without Redis, falling back to direct API calls
- **Automatic Updates**: Periodically fetches and broadcasts price updates every 60 seconds

## Architecture

```
┌─────────────────┐
│  CoinGecko API  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Price Service  │◄────►│ Redis Cache  │
└────────┬────────┘      └──────────────┘
         │
         ├──────────────────┐
         ▼                  ▼
┌─────────────────┐  ┌──────────────────┐
│   REST API      │  │  WebSocket       │
│  /api/price/*   │  │  price:update    │
└─────────────────┘  └──────────────────┘
```

## API Endpoints

### GET /api/price/zec

Get current ZEC price with caching.

**Response:**
```json
{
  "success": true,
  "data": {
    "zec": {
      "usd": 522.71,
      "usd_24h_change": -2.22,
      "usd_24h_vol": 1191937747.571,
      "usd_market_cap": 8577256806.787,
      "last_updated_at": 1732519410
    },
    "cached_at": 1732519410000
  },
  "cached": true
}
```

### GET /api/price/zec/historical

Get historical ZEC price data.

**Query Parameters:**
- `days` (optional): Number of days of historical data (1-365, default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "prices": [[timestamp, price], ...],
    "market_caps": [[timestamp, market_cap], ...],
    "total_volumes": [[timestamp, volume], ...]
  },
  "query": {
    "days": 7
  }
}
```

### GET /api/price/health

Health check for price service.

**Response:**
```json
{
  "success": true,
  "status": "operational",
  "timestamp": "2025-11-25T06:53:30.000Z"
}
```

## WebSocket Events

### price:update

Broadcasted to all connected clients when price changes by 0.5% or more.

**Event Data:**
```javascript
{
  "data": {
    "zec": {
      "usd": 522.71,
      "usd_24h_change": -2.22,
      "usd_24h_vol": 1191937747.571,
      "usd_market_cap": 8577256806.787,
      "last_updated_at": 1732519410
    },
    "cached_at": 1732519410000
  },
  "timestamp": 1732519410000
}
```

**Client Example:**
```javascript
socket.on('price:update', (data) => {
  console.log('Price updated:', data.data.zec.usd);
  // Update UI with new price
});
```

## Service Configuration

### Environment Variables

- `REDIS_URL`: Redis connection URL (default: `redis://localhost:6379`)
- `REDIS_PASSWORD`: Redis password (optional)

### Cache Configuration

- **Cache Key**: `price:zec`
- **Cache TTL**: 60 seconds
- **Broadcast Threshold**: 0.5% price change

### Update Interval

- **Default**: 60 seconds (60000ms)
- **Configurable**: Can be changed when starting the service

## Usage

### Starting the Service

The price service starts automatically when the backend server starts:

```typescript
import { priceService } from './services/price-service.js';

// Start price updates (updates every 60 seconds)
priceService.startPriceUpdates(60000);
```

### Stopping the Service

```typescript
priceService.stopPriceUpdates();
```

### Manual Price Fetch

```typescript
// Fetch fresh price from API
const priceData = await priceService.fetchPrice();

// Get price with caching
const cachedPrice = await priceService.getPrice();

// Get historical data
const historicalData = await priceService.getHistoricalPrice(7);
```

## Testing

### Test with API Only (No Redis Required)

```bash
npm run price:api-test
```

This test verifies:
- Current price fetching from CoinGecko
- Historical price data retrieval
- Graceful handling of Redis unavailability

### Test with Full Stack (Redis Required)

```bash
npm run price:test
```

This test verifies:
- Price fetching with caching
- Redis cache storage and retrieval
- Cache TTL behavior

## Error Handling

### API Errors

- **Rate Limiting**: Returns error if CoinGecko rate limit is exceeded
- **Network Errors**: Logs error and returns stale cache data if available
- **Invalid Response**: Throws error if API response is malformed

### Redis Errors

- **Connection Failed**: Service continues without caching
- **Cache Miss**: Fetches fresh data from API
- **Stale Cache**: Returns stale data if API fetch fails

## Rate Limits

CoinGecko API rate limits:
- **Free Tier**: 10-50 calls/minute
- **With Caching**: ~1 call/minute per instance

## Performance

- **Cache Hit**: < 10ms response time
- **Cache Miss**: 200-500ms response time (API call)
- **WebSocket Broadcast**: < 50ms latency

## Integration with Frontend

### REST API Integration

```typescript
// Fetch current price
const response = await fetch('/api/price/zec');
const { data } = await response.json();
console.log(`ZEC Price: $${data.zec.usd}`);

// Fetch historical data
const histResponse = await fetch('/api/price/zec/historical?days=30');
const { data: histData } = await histResponse.json();
```

### WebSocket Integration

```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: userToken }
});

socket.on('price:update', (data) => {
  updatePriceDisplay(data.data.zec.usd);
});
```

## Monitoring

### Health Check

```bash
curl http://localhost:4000/api/price/health
```

### Logs

The service logs:
- Price updates and broadcasts
- API errors and retries
- Cache operations
- WebSocket connections

## Future Enhancements

- [ ] Support for multiple cryptocurrencies
- [ ] Price alerts and notifications
- [ ] Advanced caching strategies
- [ ] Fallback to alternative price APIs
- [ ] Price prediction and analytics
- [ ] Historical data caching

## Requirements Validation

This implementation satisfies:
- **Requirement 1.4**: Dashboard displays current ZEC price
- **Requirement 6.2**: Toolbar displays ZEC price with real-time updates

