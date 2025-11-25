# Cross-Chain Service Documentation

## Overview

The Cross-Chain Service provides integration with NEAR Protocol to fetch cross-chain data, DeFi positions, and bridge activity for Zcash addresses. This service implements caching to optimize performance and reduce API calls.

## Features

- **NEAR Transaction Fetching**: Query transactions for NEAR addresses
- **DeFi Position Tracking**: Monitor positions across major NEAR DeFi protocols
- **Bridge Activity Monitoring**: Track cross-chain bridge transactions
- **Intelligent Caching**: 5-minute cache duration to reduce API calls
- **Database Persistence**: Store cross-chain data in PostgreSQL

## Supported DeFi Protocols

The service currently supports the following NEAR DeFi protocols:

1. **Ref Finance** (`v2.ref-finance.near`) - Liquidity positions
2. **Burrow** (`token.burrow.near`) - Lending positions
3. **Meta Pool** (`meta-pool.near`) - Staking positions
4. **Linear Protocol** (`linear-protocol.near`) - Staking positions

## Supported Bridge Contracts

The service monitors the following bridge contracts:

1. **Rainbow Bridge** (`rainbow-bridge.near`)
2. **Portal Bridge** (`token.portal-bridge.near`)

## API Reference

### CrossChainService

#### `fetchCrossChainData(zcashAddress: string, nearAddress?: string): Promise<CrossChainData>`

Fetches cross-chain data for a Zcash address. Checks cache first, then fetches fresh data if needed.

**Parameters:**
- `zcashAddress` (string): The Zcash address to fetch data for
- `nearAddress` (string, optional): The associated NEAR address

**Returns:** `Promise<CrossChainData>`

**Example:**
```typescript
import { crossChainService } from './services/cross-chain-service';

const data = await crossChainService.fetchCrossChainData(
  't1ZcashAddress123',
  'example.near'
);

console.log(`Found ${data.defiPositions.length} DeFi positions`);
```

#### `fetchNEARTransactions(nearAddress: string): Promise<NEARTransactionData[]>`

Fetches NEAR transactions for a specific address.

**Note:** Full transaction history requires NEAR indexer integration. Current implementation returns empty array as placeholder.

#### `fetchDefiPositions(nearAddress: string): Promise<DefiPosition[]>`

Queries all supported DeFi protocols for positions held by the address.

**Returns:** Array of DeFi positions with protocol, type, amount, and token information.

#### `fetchBridgeActivity(nearAddress: string): Promise<BridgeActivity[]>`

Monitors bridge contracts for cross-chain activity.

**Note:** Full bridge activity tracking requires indexer or event log integration.

#### `storeCrossChainData(data: CrossChainData): Promise<void>`

Stores cross-chain data in the database cache. Uses upsert logic to update existing records.

#### `invalidateCache(zcashAddress: string): Promise<void>`

Removes cached data for a specific Zcash address, forcing fresh fetch on next request.

#### `getCachedAddresses(): Promise<string[]>`

Returns list of all Zcash addresses with cached cross-chain data.

## Data Models

### CrossChainData

```typescript
interface CrossChainData {
  zcashAddress: string;
  nearAddress?: string;
  transactions: NEARTransactionData[];
  defiPositions: DefiPosition[];
  bridgeActivity: BridgeActivity[];
  lastUpdated: number;
}
```

### DefiPosition

```typescript
interface DefiPosition {
  protocol: string;
  contractId: string;
  positionType: 'lending' | 'staking' | 'liquidity' | 'farming';
  amount: string;
  tokenSymbol: string;
  valueUSD?: number;
  lastUpdated: number;
}
```

### BridgeActivity

```typescript
interface BridgeActivity {
  bridgeContract: string;
  direction: 'to_near' | 'from_near';
  amount: string;
  tokenSymbol: string;
  txHash: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
}
```

### NEARTransactionData

```typescript
interface NEARTransactionData {
  hash: string;
  signerId: string;
  receiverId: string;
  blockHash: string;
  blockTimestamp: number;
  actions: any[];
  status: 'success' | 'failure';
}
```

## Database Schema

The service uses the `cross_chain_data` table:

```sql
CREATE TABLE cross_chain_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zcash_address VARCHAR(255) UNIQUE NOT NULL,
  near_data JSONB,
  defi_positions JSONB,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

## Caching Strategy

- **Cache Duration**: 5 minutes (300,000 ms)
- **Cache Key**: Zcash address
- **Cache Invalidation**: Automatic after duration or manual via `invalidateCache()`
- **Upsert Logic**: Updates existing records instead of creating duplicates

## Testing

Run the test script to verify the service:

```bash
npm run crosschain:test
```

The test script will:
1. Initialize NEAR service
2. Fetch cross-chain data for a test address
3. Verify cache retrieval
4. List all cached addresses
5. Test cache invalidation

## Production Considerations

### Transaction History

The current implementation has limited transaction history access due to NEAR RPC constraints. For production:

1. **Use NEAR Indexer**: Deploy a NEAR indexer to track historical transactions
2. **Third-party APIs**: Integrate with services like NEAR Blocks or Pagoda
3. **Event Logs**: Parse contract event logs for detailed activity

### DeFi Protocol Integration

To add more DeFi protocols:

1. Add contract ID to `KNOWN_DEFI_CONTRACTS` array
2. Implement protocol-specific query logic in `queryDefiPosition()`
3. Handle protocol-specific data structures

Example:
```typescript
private readonly KNOWN_DEFI_CONTRACTS = [
  'v2.ref-finance.near',
  'token.burrow.near',
  'meta-pool.near',
  'linear-protocol.near',
  'your-protocol.near', // Add new protocol
];
```

### Bridge Monitoring

For comprehensive bridge monitoring:

1. Use bridge indexers or event logs
2. Track both incoming and outgoing transactions
3. Monitor transaction status and confirmations
4. Implement retry logic for failed queries

### Performance Optimization

1. **Parallel Queries**: DeFi positions are queried in parallel
2. **Cache First**: Always check cache before external API calls
3. **Graceful Degradation**: Continue if individual protocol queries fail
4. **Connection Pooling**: Database connections are pooled for efficiency

## Error Handling

The service implements comprehensive error handling:

- **Network Errors**: Caught and logged, returns empty arrays
- **Invalid Addresses**: Validated before queries
- **Protocol Failures**: Individual protocol failures don't break entire fetch
- **Database Errors**: Logged with detailed error messages

## Future Enhancements

1. **Real-time Updates**: WebSocket subscriptions for live data
2. **More Protocols**: Expand DeFi protocol coverage
3. **Historical Analytics**: Track position changes over time
4. **Price Integration**: Add USD value calculations
5. **Alert System**: Notify on significant position changes
6. **Multi-chain Support**: Extend to other blockchain networks

## Requirements Validation

This service implements the following requirements:

- **Requirement 1.5**: Fetches cross-chain DeFi data using NEAR Intents SDK
- **Requirement 1.3**: Provides analytics data for cross-chain activity
- **Requirement 9.2**: Implements efficient caching and data processing

## Related Services

- **NEAR Service** (`near-service.ts`): Low-level NEAR Protocol integration
- **Block Indexer** (`block-indexer.ts`): Zcash blockchain indexing
- **Viewing Key Service** (`viewing-key-service.ts`): Zcash viewing key management
