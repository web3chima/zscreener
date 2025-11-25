# Zscreener API Endpoints

This document describes the REST API endpoints implemented for the Zscreener backend.

## Base URL
```
http://localhost:4000/api
```

## Authentication Endpoints

### POST /api/auth/signin
Sign in with wallet signature.

**Request Body:**
```json
{
  "walletAddress": "string",
  "signature": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "userId": "string",
      "walletAddress": "string",
      "viewingKeys": []
    },
    "token": "string",
    "expiresIn": 3600
  }
}
```

### POST /api/auth/validate-viewing-key
Validate and associate a viewing key with the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "viewingKey": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "viewingKeyHash": "string",
    "message": "Viewing key validated and associated with account"
  }
}
```

### POST /api/auth/signout
Sign out and revoke the current session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

### GET /api/auth/session
Get current session information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "walletAddress": "string",
    "viewingKeys": []
  }
}
```

## Transaction Endpoints

### GET /api/transactions
Get shielded transactions with filtering and pagination.

**Query Parameters:**
- `startBlock` (optional): Filter by minimum block height
- `endBlock` (optional): Filter by maximum block height
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `minShieldedInputs` (optional): Filter by minimum shielded inputs
- `minShieldedOutputs` (optional): Filter by minimum shielded outputs
- `limit` (optional, default: 50): Number of results per page
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "txHash": "string",
        "blockHeight": 123456,
        "timestamp": "2024-01-01T00:00:00Z",
        "shieldedInputs": 2,
        "shieldedOutputs": 3,
        "proofData": {},
        "memoData": "string",
        "indexedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 1000,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### GET /api/transactions/:hash
Get a specific transaction by hash.

**Parameters:**
- `hash`: Transaction hash (64 character hex string)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "txHash": "string",
    "blockHeight": 123456,
    "timestamp": "2024-01-01T00:00:00Z",
    "shieldedInputs": 2,
    "shieldedOutputs": 3,
    "proofData": {},
    "memoData": "string",
    "indexedAt": "2024-01-01T00:00:00Z"
  },
  "cached": false
}
```

### GET /api/transactions/by-viewing-key
Get transactions associated with a viewing key.

**Query Parameters:**
- `viewingKey` (required): The viewing key to query
- `limit` (optional, default: 50): Number of results per page
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [],
    "pagination": {
      "total": 10,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    },
    "stats": {
      "totalTransactions": 10,
      "totalShieldedInputs": 20,
      "totalShieldedOutputs": 30,
      "firstTransaction": "2024-01-01T00:00:00Z",
      "lastTransaction": "2024-01-02T00:00:00Z"
    }
  },
  "cached": false
}
```

## Analytics Endpoints

### GET /api/analytics/network-stats
Get overall network statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalShieldedTransactions": 10000,
    "totalShieldedValue": 50000,
    "averageTransactionSize": 5.5,
    "shieldedPoolSize": 25000,
    "last24hVolume": 1000,
    "last24hTransactions": 200,
    "latestBlock": 123456
  },
  "cached": false
}
```

**Cache:** 5 minutes

### GET /api/analytics/shielded-pool
Get shielded pool metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalInputs": 20000,
    "totalOutputs": 30000,
    "inputOutputRatio": 1.5,
    "averageInputsPerTx": 2.0,
    "averageOutputsPerTx": 3.0,
    "transactionsByType": {
      "spendOnly": 1000,
      "outputOnly": 2000,
      "mixed": 7000
    }
  },
  "cached": false
}
```

**Cache:** 5 minutes

### GET /api/analytics/volume
Get transaction volume over time with time range support.

**Query Parameters:**
- `timeRange` (optional, default: '24h'): Time range ('1h', '24h', '7d', '30d', '90d', '1y')
- `interval` (optional, default: 'hour'): Time interval ('minute', 'hour', 'day', 'week', 'month')
- `startDate` (optional): Custom start date (ISO 8601)
- `endDate` (optional): Custom end date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "volumeData": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "transactionCount": 100,
        "totalInputs": 200,
        "totalOutputs": 300
      }
    ],
    "summary": {
      "totalTransactions": 1000,
      "totalInputs": 2000,
      "totalOutputs": 3000,
      "averagePerInterval": 41.67,
      "dataPoints": 24
    },
    "query": {
      "timeRange": "24h",
      "interval": "hour",
      "startDate": null,
      "endDate": null
    }
  },
  "cached": false
}
```

**Cache:** 2 minutes

### GET /api/analytics/recent-activity
Get recent transaction activity summary.

**Query Parameters:**
- `hours` (optional, default: '24'): Number of hours to look back

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "hour": "2024-01-01T00:00:00Z",
      "transactionCount": 50,
      "inputs": 100,
      "outputs": 150,
      "averageSize": 5.0
    }
  ],
  "cached": false
}
```

**Cache:** 3 minutes

## Rate Limiting

- **General API endpoints:** 100 requests per 15 minutes per IP
- **Authentication endpoints:** 20 requests per 15 minutes per IP

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

Common error codes:
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AUTH_RATE_LIMIT_EXCEEDED`: Too many authentication attempts
- `INVALID_CREDENTIALS`: Invalid authentication credentials
- `UNAUTHORIZED`: Authentication required
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Request validation failed
- `INTERNAL_ERROR`: Server error

## Health Check

### GET /health
Check if the service is running.

**Response:**
```json
{
  "status": "ok",
  "service": "zscreener-backend",
  "timestamp": "2024-01-01T00:00:00Z"
}
```
