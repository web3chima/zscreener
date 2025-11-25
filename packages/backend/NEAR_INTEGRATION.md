# NEAR Protocol Integration

This document describes the NEAR Protocol integration in the Zscreener backend service.

## Overview

The NEAR integration enables cross-chain data fetching and analytics by connecting to the NEAR Protocol blockchain. This allows Zscreener to correlate Zcash shielded transactions with NEAR DeFi activities and bridge operations.

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```bash
# NEAR Configuration
NEAR_NETWORK=testnet          # or 'mainnet' for production
NEAR_NODE_URL=https://rpc.testnet.near.org  # Optional, defaults based on network
```

### Network Options

- **Testnet**: For development and testing
  - Network ID: `testnet`
  - RPC URL: `https://rpc.testnet.near.org`
  - Explorer: `https://explorer.testnet.near.org`

- **Mainnet**: For production
  - Network ID: `mainnet`
  - RPC URL: `https://rpc.mainnet.near.org`
  - Explorer: `https://explorer.mainnet.near.org`

## Architecture

### Components

1. **NEAR Configuration** (`src/config/near.ts`)
   - Network configuration management
   - Connection initialization
   - Singleton connection instance

2. **NEAR Service** (`src/services/near-service.ts`)
   - Account operations
   - Transaction queries
   - Contract interactions
   - Network status monitoring

## Usage

### Initialize NEAR Service

```typescript
import { nearService } from './services/near-service';

// Initialize the service
await nearService.initialize();
```

### Get Account Information

```typescript
const accountInfo = await nearService.getAccountInfo('example.near');
console.log(`Balance: ${accountInfo.balanceFormatted} NEAR`);
console.log(`Storage: ${accountInfo.storageUsage} bytes`);
```

### Check Account Existence

```typescript
const exists = await nearService.accountExists('example.near');
if (exists) {
  console.log('Account exists on NEAR');
}
```

### Get Account Balance

```typescript
const balance = await nearService.getAccountBalance('example.near');
console.log(`Available balance: ${balance} NEAR`);
```

### View Contract State

```typescript
const result = await nearService.viewContractState(
  'contract.near',
  'get_balance',
  { account_id: 'user.near' }
);
```

### Get Network Status

```typescript
const status = await nearService.getNetworkStatus();
console.log(`Chain ID: ${status.chain_id}`);
console.log(`Latest block: ${status.sync_info.latest_block_height}`);
```

### Get Block Information

```typescript
// By block height
const block = await nearService.getBlock(12345678);

// By block hash
const blockByHash = await nearService.getBlock('ABC123...');
```

### Get Transaction Status

```typescript
const txStatus = await nearService.getTransactionStatus(
  'transaction_hash',
  'signer_account.near'
);
```

### Custom RPC Queries

```typescript
const result = await nearService.queryRPC('view_account', {
  finality: 'final',
  account_id: 'example.near'
});
```

## Testing

### Run NEAR Connection Test

```bash
npm run near:test
```

This test script will:
- Display NEAR configuration
- Initialize the NEAR service
- Fetch network status
- Test account operations
- Retrieve block information

### Expected Output

```
Testing NEAR connection...

NEAR Configuration:
  Network: testnet
  Node URL: https://rpc.testnet.near.org

✓ NEAR service initialized
✓ Network Status:
  Chain ID: testnet
  Latest Block Height: 224521253
✓ Account exists: true
✓ Account Info:
  Account ID: test.near
  Balance: 1,226.81 NEAR
✓ Latest Block:
  Height: 224521253

✅ All NEAR connection tests passed!
```

## API Reference

### NEARService Class

#### Methods

- `initialize()`: Initialize NEAR connection
- `getAccountInfo(accountId)`: Get comprehensive account information
- `accountExists(accountId)`: Check if account exists
- `getAccountBalance(accountId)`: Get formatted account balance
- `viewContractState(contractId, methodName, args)`: View contract state
- `getNetworkStatus()`: Get current network status
- `getBlock(blockId)`: Get block by height or hash
- `getTransactionStatus(txHash, accountId)`: Get transaction status
- `queryRPC(method, params)`: Execute custom RPC query
- `getConnection()`: Get raw NEAR connection instance

### Data Types

#### NEARAccountInfo

```typescript
interface NEARAccountInfo {
  accountId: string;
  balance: string;              // Raw balance in yoctoNEAR
  balanceFormatted: string;     // Formatted balance in NEAR
  storageUsage: number;         // Storage usage in bytes
  blockHeight: number;          // Block height of account state
  blockHash: string;            // Block hash of account state
}
```

#### NEARConfig

```typescript
interface NEARConfig {
  networkId: string;
  nodeUrl: string;
  walletUrl?: string;
  helperUrl?: string;
  explorerUrl?: string;
}
```

## Error Handling

All NEAR service methods throw descriptive errors:

```typescript
try {
  const accountInfo = await nearService.getAccountInfo('invalid.near');
} catch (error) {
  console.error('Failed to fetch account:', error.message);
}
```

Common error scenarios:
- Account doesn't exist
- Network connection issues
- Invalid RPC responses
- Timeout errors

## Best Practices

1. **Connection Management**
   - Use the singleton instance via `nearService`
   - Initialize once at application startup
   - Reuse the connection for all operations

2. **Error Handling**
   - Always wrap NEAR calls in try-catch blocks
   - Log errors for debugging
   - Provide user-friendly error messages

3. **Performance**
   - Cache frequently accessed data (account info, network status)
   - Use Redis for caching NEAR data
   - Implement rate limiting for RPC calls

4. **Security**
   - Never expose private keys
   - Use read-only operations for public data
   - Validate all user inputs before querying

## Future Enhancements

- Transaction history fetching
- DeFi protocol integration
- Bridge activity monitoring
- Real-time event subscriptions
- Cross-chain correlation logic

## Resources

- [NEAR Protocol Documentation](https://docs.near.org/)
- [NEAR JavaScript API](https://docs.near.org/tools/near-api-js/quick-reference)
- [NEAR RPC API](https://docs.near.org/api/rpc/introduction)
- [NEAR Explorer](https://explorer.near.org/)
