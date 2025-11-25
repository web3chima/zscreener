# Nillion Privacy Services Integration

This document describes the Nillion privacy services integration for Zscreener, including confidential compute (Nilcc) and private storage (Nil DB).

## Overview

The Nillion integration provides privacy-preserving features for the Zscreener application:

- **Nil DB**: Private encrypted storage for sensitive data
- **Nilcc**: Confidential compute for privacy-preserving analytics
- **Encryption Service**: Secure encryption/decryption of zero-knowledge proof views

## Architecture

### Components

1. **Nillion Client** (`nillion-client.ts`)
   - Handles authentication with Nillion services
   - Manages access tokens and session state
   - Provides HTTP client for API requests

2. **Nil DB Service** (`nil-db-service.ts`)
   - Encrypts data using AES-256-GCM
   - Stores encrypted data in Nillion's private database
   - Manages encryption keys per user
   - Supports data retrieval and deletion

3. **Nilcc Service** (`nilcc-service.ts`)
   - Submits confidential computation jobs
   - Supports operations: sum, average, count, max, min, aggregate, filter
   - Provides privacy-preserving analytics queries
   - Tracks job status and retrieves results

4. **Encryption Service** (`encryption-service.ts`)
   - Encrypts/decrypts Halo zero-knowledge proof data
   - Verifies proof integrity
   - Supports batch operations
   - Integrates with Nil DB for enhanced privacy

## Configuration

Add the following environment variables to your `.env` file:

```bash
# Nillion Configuration
NILLION_ENDPOINT=https://api.nillion.testnet
NILLION_API_KEY=your-api-key-here
NILLION_NETWORK=testnet
NIL_DB_ENDPOINT=https://nildb.nillion.testnet
NILCC_ENDPOINT=https://nilcc.nillion.testnet
NILLION_TIMEOUT=30000
NILLION_ENABLED=true
```

## API Endpoints

### Privacy Endpoints (`/api/privacy`)

#### 1. Encrypt Proof
```http
POST /api/privacy/encrypt-proof
Content-Type: application/json

{
  "userId": "user-123",
  "proofData": {
    "proofBytes": "deadbeef...",
    "publicInputs": ["input1", "input2"],
    "proofType": "spend",
    "verificationKey": "key..."
  },
  "metadata": { "type": "transaction" },
  "storeInNilDB": true
}
```

Response:
```json
{
  "success": true,
  "proofId": "abc123...",
  "proofHash": "hash...",
  "storedInNilDB": true,
  "message": "Proof encrypted successfully"
}
```

#### 2. Decrypt Proof
```http
GET /api/privacy/decrypt-proof/:id?userId=user-123&fromNilDB=true
```

Response:
```json
{
  "success": true,
  "proofId": "abc123...",
  "proofData": { ... },
  "proofHash": "hash...",
  "message": "Proof decrypted successfully"
}
```

#### 3. Submit Confidential Computation
```http
POST /api/privacy/nilcc-compute
Content-Type: application/json

{
  "userId": "user-123",
  "operation": "sum",
  "inputs": [
    { "type": "inline", "value": 10 },
    { "type": "inline", "value": 20 }
  ],
  "parameters": {}
}
```

Response:
```json
{
  "success": true,
  "jobId": "job-456...",
  "status": "pending",
  "message": "Computation job submitted successfully"
}
```

#### 4. Get Computation Result
```http
GET /api/privacy/nilcc-compute/:jobId?userId=user-123
```

Response:
```json
{
  "success": true,
  "jobId": "job-456...",
  "status": "completed",
  "result": 30,
  "computedAt": 1234567890,
  "proofOfComputation": "base64..."
}
```

#### 5. Store Data in Nil DB
```http
POST /api/privacy/store-nildb
Content-Type: application/json

{
  "userId": "user-123",
  "data": { "key": "value" },
  "metadata": { "type": "analytics" }
}
```

Response:
```json
{
  "success": true,
  "dataId": "data-789...",
  "userId": "user-123",
  "storedAt": 1234567890,
  "encryptionKeyId": "key-id..."
}
```

#### 6. Retrieve Data from Nil DB
```http
GET /api/privacy/retrieve-nildb/:dataId?userId=user-123
```

Response:
```json
{
  "success": true,
  "dataId": "data-789...",
  "data": { "key": "value" },
  "message": "Data retrieved from Nil DB successfully"
}
```

#### 7. Privacy-Preserving Analytics Query
```http
POST /api/privacy/analytics-query
Content-Type: application/json

{
  "userId": "user-123",
  "queryType": "transaction_volume",
  "dataIds": ["id1", "id2", "id3"],
  "parameters": { "timeRange": "24h" }
}
```

Response:
```json
{
  "success": true,
  "jobId": "analytics-job-123",
  "queryType": "transaction_volume",
  "status": "pending",
  "message": "Analytics query submitted successfully"
}
```

## Usage Examples

### Encrypting a Proof

```typescript
import { getEncryptionService } from './services/encryption-service';

const encryptionService = getEncryptionService();

const proofId = await encryptionService.encryptProofView({
  userId: 'user-123',
  proofData: {
    proofBytes: 'deadbeef...',
    publicInputs: ['input1', 'input2'],
    proofType: 'spend',
    verificationKey: 'key...'
  },
  storeInNilDB: true
});
```

### Running Confidential Computation

```typescript
import { getNilccService } from './services/nilcc-service';

const nilccService = getNilccService();

const jobId = await nilccService.submitComputation({
  userId: 'user-123',
  operation: 'sum',
  inputs: [
    { type: 'inline', value: 10 },
    { type: 'inline', value: 20 }
  ]
});

// Wait for completion
const job = await nilccService.waitForCompletion(jobId);
console.log('Result:', job.result);
```

### Storing Data in Nil DB

```typescript
import { getNilDBService } from './services/nil-db-service';

const nilDBService = getNilDBService();

const result = await nilDBService.storeData(
  { sensitive: 'data' },
  {
    userId: 'user-123',
    metadata: { type: 'transaction' }
  }
);

console.log('Stored with ID:', result.dataId);
```

## Testing

Run the Nillion integration tests:

```bash
npm run nillion:test
```

This will test:
- Nillion client connection
- Nil DB storage and retrieval
- Nilcc confidential compute
- Encryption service
- Privacy-preserving analytics

## Mock Mode

When `NILLION_API_KEY` is not configured, the services operate in mock mode:

- **Nillion Client**: Uses mock authentication tokens
- **Nil DB**: Stores data in memory instead of remote database
- **Nilcc**: Performs computations locally
- **Encryption**: Works normally (uses local encryption)

This allows development and testing without requiring actual Nillion service credentials.

## Security Considerations

1. **Encryption Keys**: Keys are derived deterministically from user IDs. In production, use proper key management with user secrets.

2. **API Key**: Store `NILLION_API_KEY` securely and never commit it to version control.

3. **User Authorization**: All endpoints verify user ownership before allowing access to data.

4. **Data Integrity**: Proof data is validated before encryption and includes integrity checks.

5. **Transport Security**: Always use HTTPS in production for API communication.

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 4.1**: Nilcc integration for confidential compute operations ✓
- **Requirement 4.2**: Nil DB for private storage ✓
- **Requirement 4.3**: Privacy-preserving analytics execution ✓
- **Requirement 4.4**: User option to enable Nillion features ✓
- **Requirement 4.5**: Encrypted data storage in Nil DB ✓
- **Requirement 8.1**: Encryption options for proof views ✓
- **Requirement 8.2**: Encrypted proof data storage ✓
- **Requirement 8.4**: Authorized-only decryption ✓

## Future Enhancements

1. **Key Management**: Implement proper key derivation with user secrets
2. **Batch Operations**: Optimize bulk encryption/decryption
3. **Caching**: Add Redis caching for frequently accessed data
4. **Monitoring**: Add metrics for Nillion service usage
5. **Rate Limiting**: Implement per-user rate limits for privacy operations
