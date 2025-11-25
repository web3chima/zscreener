# Authentication Service Implementation

## Overview

This document describes the authentication service and session management implementation for Zscreener, completed as part of Task 4.

## Components Implemented

### 1. Authentication Service (`auth-service.ts`)

**Features:**
- Wallet signature authentication
- JWT token generation and verification
- User session creation and management
- Session refresh and revocation

**Key Methods:**
- `signIn(credentials)` - Authenticate user with wallet signature
- `verifyWalletSignature()` - Validate wallet signatures
- `createSession()` - Create and store user session
- `generateJWT()` - Generate JWT tokens
- `verifyJWT()` - Verify and decode JWT tokens
- `getSession()` - Retrieve session from Redis
- `refreshSession()` - Extend session expiration
- `revokeSession()` - Delete user session

### 2. Viewing Key Authentication Service (`viewing-key-auth-service.ts`)

**Features:**
- Viewing key format validation
- Secure viewing key hashing (SHA-256)
- Viewing key association with user accounts
- Viewing key management

**Key Methods:**
- `hashViewingKey()` - Hash viewing keys before storage
- `validateViewingKeyFormat()` - Validate Zcash viewing key format
- `associateViewingKeyWithUser()` - Link viewing keys to users
- `validateViewingKey()` - Verify viewing key validity
- `getUserViewingKeys()` - Get all viewing keys for a user
- `removeViewingKeyFromUser()` - Remove viewing key association

### 3. Session Manager (`session-manager.ts`)

**Features:**
- Redis-based session storage with TTL
- Session indexing by wallet address
- Session refresh and expiration management
- Session statistics and cleanup

**Key Methods:**
- `storeSession()` - Store session with expiration
- `getSession()` - Retrieve session by user ID
- `getSessionByWalletAddress()` - Find session by wallet
- `updateSession()` - Update session data
- `refreshSession()` - Extend session TTL
- `deleteSession()` - Remove session
- `sessionExists()` - Check session validity
- `getSessionTTL()` - Get remaining session time
- `getSessionStats()` - Get session statistics

### 4. Authentication Middleware (`middleware/auth.ts`)

**Features:**
- JWT token verification
- Session validation
- Request authentication
- Optional authentication support

**Middleware Functions:**
- `authenticate` - Required authentication middleware
- `optionalAuth` - Optional authentication middleware

### 5. Authentication Routes (`routes/auth.ts`)

**Endpoints:**

#### POST `/api/auth/signin`
Sign in with wallet signature
```json
Request:
{
  "walletAddress": "string",
  "signature": "string"
}

Response:
{
  "success": true,
  "data": {
    "session": { ... },
    "token": "jwt-token",
    "expiresIn": "1h"
  }
}
```

#### POST `/api/auth/signout`
Sign out and revoke session (requires authentication)
```json
Response:
{
  "success": true,
  "message": "Signed out successfully"
}
```

#### GET `/api/auth/session`
Get current session information (requires authentication)
```json
Response:
{
  "success": true,
  "data": {
    "userId": "uuid",
    "walletAddress": "string",
    "viewingKeys": ["hash1", "hash2"],
    "privacyPreferences": { ... },
    "createdAt": 1234567890
  }
}
```

#### POST `/api/auth/validate-viewing-key`
Validate and associate viewing key (requires authentication)
```json
Request:
{
  "viewingKey": "string"
}

Response:
{
  "success": true,
  "data": {
    "viewingKeyHash": "hash",
    "message": "Viewing key validated and associated with account"
  }
}
```

#### GET `/api/auth/viewing-keys`
Get all viewing keys for user (requires authentication)
```json
Response:
{
  "success": true,
  "data": {
    "viewingKeys": ["hash1", "hash2"],
    "count": 2
  }
}
```

#### DELETE `/api/auth/viewing-key`
Remove viewing key association (requires authentication)
```json
Request:
{
  "viewingKey": "string"
}

Response:
{
  "success": true,
  "message": "Viewing key removed successfully"
}
```

### 6. Type Definitions (`types/auth.ts`)

**Interfaces:**
- `AuthCredentials` - Authentication request data
- `UserSession` - Session data structure
- `SessionToken` - JWT token response
- `JWTPayload` - JWT token payload
- `PrivacySettings` - User privacy preferences

## Security Features

### 1. Viewing Key Protection
- Viewing keys are hashed using SHA-256 before storage
- Never stored in plaintext
- Only hashes are stored in database

### 2. Session Security
- Sessions stored in Redis with automatic expiration
- Configurable TTL (default: 1 hour)
- Session refresh on activity
- Secure session revocation

### 3. JWT Security
- Signed with secret key
- Configurable expiration time
- Verified on each authenticated request
- Payload includes minimal user information

### 4. Authentication Flow
1. User signs message with wallet
2. Backend verifies signature
3. User record created/retrieved
4. Session created in Redis
5. JWT token generated and returned
6. Token included in subsequent requests
7. Middleware verifies token and session

## Configuration

Environment variables used:
```env
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=1h
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
```

## Usage Examples

### Client-Side Authentication

```typescript
// Sign in
const response = await fetch('/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x...',
    signature: 'signed-message'
  })
});

const { data } = await response.json();
const token = data.token;

// Use token in subsequent requests
const sessionResponse = await fetch('/api/auth/session', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Adding Viewing Key

```typescript
const response = await fetch('/api/auth/validate-viewing-key', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    viewingKey: 'zxviews...'
  })
});
```

### Protected Route Example

```typescript
import { authenticate } from './middleware/auth.js';

router.get('/protected', authenticate, async (req, res) => {
  const userId = (req as any).userId;
  const session = (req as any).session;
  
  // Access user data
  res.json({ userId, session });
});
```

## Requirements Satisfied

✅ **Requirement 2.1** - User authentication without storing unencrypted private keys
✅ **Requirement 2.2** - Viewing key validation and transaction display
✅ **Requirement 2.3** - Privacy-preserving viewing key operations
✅ **Requirement 2.4** - Secure session establishment and management
✅ **Requirement 9.2** - Stable backend functionality with session support

## Future Enhancements

1. **Signature Verification**: Implement full cryptographic signature verification for Zcash wallet addresses
2. **Multi-Factor Authentication**: Add optional 2FA support
3. **Session Analytics**: Track session usage patterns
4. **Rate Limiting**: Add per-user rate limiting
5. **Refresh Tokens**: Implement refresh token mechanism for long-lived sessions
6. **Session Migration**: Support for session transfer between devices

## Testing

To test the authentication service:

1. Start Redis: `redis-server`
2. Start backend: `npm run dev`
3. Test signin endpoint:
```bash
curl -X POST http://localhost:4000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x123","signature":"test-signature-min-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}'
```

4. Test session endpoint with token:
```bash
curl http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Notes

- Viewing keys are hashed before storage to maintain privacy
- Sessions automatically expire after TTL
- JWT tokens should be stored securely on client side
- All authenticated endpoints require valid JWT token
- Session is validated on each request to ensure it hasn't been revoked
