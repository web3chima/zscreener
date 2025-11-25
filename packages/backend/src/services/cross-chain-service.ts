import { nearService } from './near-service.js';
import pool from '../config/database.js';

export interface NEARTransactionData {
  hash: string;
  signerId: string;
  receiverId: string;
  blockHash: string;
  blockTimestamp: number;
  actions: any[];
  status: 'success' | 'failure';
}

export interface DefiPosition {
  protocol: string;
  contractId: string;
  positionType: 'lending' | 'staking' | 'liquidity' | 'farming';
  amount: string;
  tokenSymbol: string;
  valueUSD?: number;
  lastUpdated: number;
}

export interface BridgeActivity {
  bridgeContract: string;
  direction: 'to_near' | 'from_near';
  amount: string;
  tokenSymbol: string;
  txHash: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
}

export interface CrossChainData {
  zcashAddress: string;
  nearAddress?: string;
  transactions: NEARTransactionData[];
  defiPositions: DefiPosition[];
  bridgeActivity: BridgeActivity[];
  lastUpdated: number;
}

/**
 * Cross-chain data fetching service for NEAR integration
 */
export class CrossChainService {
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly KNOWN_DEFI_CONTRACTS = [
    'v2.ref-finance.near',
    'token.burrow.near',
    'meta-pool.near',
    'linear-protocol.near',
  ];
  private readonly KNOWN_BRIDGE_CONTRACTS = [
    'rainbow-bridge.near',
    'token.portal-bridge.near',
  ];

  /**
   * Fetch cross-chain data for a Zcash address
   */
  async fetchCrossChainData(
    zcashAddress: string,
    nearAddress?: string
  ): Promise<CrossChainData> {
    try {
      // Check cache first
      const cachedData = await this.getCachedData(zcashAddress);
      if (cachedData && this.isCacheValid(cachedData.last_updated)) {
        return this.parseCachedData(cachedData);
      }

      // If no NEAR address provided, try to derive or return empty data
      if (!nearAddress) {
        const emptyData: CrossChainData = {
          zcashAddress,
          transactions: [],
          defiPositions: [],
          bridgeActivity: [],
          lastUpdated: Date.now(),
        };
        await this.storeCrossChainData(emptyData);
        return emptyData;
      }

      // Fetch fresh data from NEAR
      const [transactions, defiPositions, bridgeActivity] = await Promise.all([
        this.fetchNEARTransactions(nearAddress),
        this.fetchDefiPositions(nearAddress),
        this.fetchBridgeActivity(nearAddress),
      ]);

      const crossChainData: CrossChainData = {
        zcashAddress,
        nearAddress,
        transactions,
        defiPositions,
        bridgeActivity,
        lastUpdated: Date.now(),
      };

      // Store in cache
      await this.storeCrossChainData(crossChainData);

      return crossChainData;
    } catch (error) {
      console.error(`Failed to fetch cross-chain data for ${zcashAddress}:`, error);
      throw new Error(
        `Failed to fetch cross-chain data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch NEAR transactions for an address
   */
  async fetchNEARTransactions(nearAddress: string): Promise<NEARTransactionData[]> {
    try {
      // Check if account exists
      const accountExists = await nearService.accountExists(nearAddress);
      if (!accountExists) {
        return [];
      }

      // Query recent transactions using RPC
      // Note: NEAR RPC has limited transaction history access
      // For production, consider using NEAR indexer or third-party APIs
      await nearService.getConnection();

      // Fetch recent transactions (this is a simplified approach)
      // In production, you'd use NEAR indexer or archive node
      const transactions: NEARTransactionData[] = [];

      // For now, return empty array as transaction history requires indexer
      // This would be implemented with NEAR indexer in production
      console.log(`Transaction history for ${nearAddress} requires NEAR indexer integration`);
      
      return transactions;
    } catch (error) {
      console.error(`Failed to fetch NEAR transactions for ${nearAddress}:`, error);
      return [];
    }
  }

  /**
   * Fetch DeFi positions from NEAR protocols
   */
  async fetchDefiPositions(nearAddress: string): Promise<DefiPosition[]> {
    const positions: DefiPosition[] = [];

    try {
      // Check each known DeFi protocol
      for (const contractId of this.KNOWN_DEFI_CONTRACTS) {
        try {
          const position = await this.queryDefiPosition(nearAddress, contractId);
          if (position) {
            positions.push(position);
          }
        } catch (error) {
          // Continue checking other protocols even if one fails
          console.log(`No position found in ${contractId} for ${nearAddress}`);
        }
      }

      return positions;
    } catch (error) {
      console.error(`Failed to fetch DeFi positions for ${nearAddress}:`, error);
      return positions;
    }
  }

  /**
   * Query DeFi position from a specific protocol
   */
  private async queryDefiPosition(
    nearAddress: string,
    contractId: string
  ): Promise<DefiPosition | null> {
    try {
      // Different protocols have different methods to query positions
      // This is a simplified implementation
      
      if (contractId.includes('ref-finance')) {
        // Ref Finance - query liquidity positions
        const deposits = await nearService.viewContractState(
          contractId,
          'get_deposits',
          { account_id: nearAddress }
        );
        
        if (deposits && Object.keys(deposits).length > 0) {
          // Parse first deposit as example
          const tokenId = Object.keys(deposits)[0];
          const amount = deposits[tokenId];
          
          return {
            protocol: 'Ref Finance',
            contractId,
            positionType: 'liquidity',
            amount: amount.toString(),
            tokenSymbol: this.parseTokenSymbol(tokenId),
            lastUpdated: Date.now(),
          };
        }
      } else if (contractId.includes('burrow')) {
        // Burrow - query lending positions
        const account = await nearService.viewContractState(
          contractId,
          'get_account',
          { account_id: nearAddress }
        );
        
        if (account && account.supplied && account.supplied.length > 0) {
          const supplied = account.supplied[0];
          return {
            protocol: 'Burrow',
            contractId,
            positionType: 'lending',
            amount: supplied.balance || '0',
            tokenSymbol: this.parseTokenSymbol(supplied.token_id),
            lastUpdated: Date.now(),
          };
        }
      } else if (contractId.includes('meta-pool') || contractId.includes('linear-protocol')) {
        // Staking protocols
        const balance = await nearService.viewContractState(
          contractId,
          'get_account_staked_balance',
          { account_id: nearAddress }
        );
        
        if (balance && balance !== '0') {
          return {
            protocol: contractId.includes('meta-pool') ? 'Meta Pool' : 'Linear Protocol',
            contractId,
            positionType: 'staking',
            amount: balance.toString(),
            tokenSymbol: 'NEAR',
            lastUpdated: Date.now(),
          };
        }
      }

      return null;
    } catch (error) {
      // Position doesn't exist or contract method not available
      return null;
    }
  }

  /**
   * Fetch bridge activity for an address
   */
  async fetchBridgeActivity(nearAddress: string): Promise<BridgeActivity[]> {
    const activities: BridgeActivity[] = [];

    try {
      // Query known bridge contracts for activity
      // This is a simplified implementation
      // In production, you'd use bridge indexers or event logs
      
      for (const bridgeContract of this.KNOWN_BRIDGE_CONTRACTS) {
        try {
          // Check if user has interacted with bridge
          // This would require indexer or event logs in production
          console.log(`Checking bridge activity in ${bridgeContract} for ${nearAddress}`);
        } catch (error) {
          console.log(`No bridge activity found in ${bridgeContract}`);
        }
      }

      return activities;
    } catch (error) {
      console.error(`Failed to fetch bridge activity for ${nearAddress}:`, error);
      return activities;
    }
  }

  /**
   * Get cached cross-chain data from database
   */
  private async getCachedData(zcashAddress: string): Promise<any | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM cross_chain_data WHERE zcash_address = $1 ORDER BY last_updated DESC LIMIT 1',
        [zcashAddress]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(lastUpdated: Date): boolean {
    const now = Date.now();
    const cacheTime = new Date(lastUpdated).getTime();
    return now - cacheTime < this.CACHE_DURATION_MS;
  }

  /**
   * Parse cached data from database
   */
  private parseCachedData(cachedData: any): CrossChainData {
    return {
      zcashAddress: cachedData.zcash_address,
      nearAddress: cachedData.near_data?.nearAddress,
      transactions: cachedData.near_data?.transactions || [],
      defiPositions: cachedData.defi_positions || [],
      bridgeActivity: cachedData.near_data?.bridgeActivity || [],
      lastUpdated: new Date(cachedData.last_updated).getTime(),
    };
  }

  /**
   * Store cross-chain data in cache table
   */
  async storeCrossChainData(data: CrossChainData): Promise<void> {
    try {
      const nearData = {
        nearAddress: data.nearAddress,
        transactions: data.transactions,
        bridgeActivity: data.bridgeActivity,
      };

      await pool.query(
        `INSERT INTO cross_chain_data (zcash_address, near_data, defi_positions, last_updated)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (zcash_address) 
         DO UPDATE SET 
           near_data = $2,
           defi_positions = $3,
           last_updated = NOW()`,
        [data.zcashAddress, JSON.stringify(nearData), JSON.stringify(data.defiPositions)]
      );

      console.log(`Stored cross-chain data for ${data.zcashAddress}`);
    } catch (error) {
      console.error('Failed to store cross-chain data:', error);
      throw new Error(
        `Failed to store cross-chain data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse token symbol from token ID
   */
  private parseTokenSymbol(tokenId: string): string {
    // Extract symbol from token contract ID
    // e.g., "token.near" -> "TOKEN", "wrap.near" -> "wNEAR"
    if (tokenId === 'wrap.near') return 'wNEAR';
    if (tokenId.includes('.')) {
      const parts = tokenId.split('.');
      return parts[0].toUpperCase();
    }
    return tokenId.toUpperCase();
  }

  /**
   * Invalidate cache for a specific address
   */
  async invalidateCache(zcashAddress: string): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM cross_chain_data WHERE zcash_address = $1',
        [zcashAddress]
      );
      console.log(`Invalidated cache for ${zcashAddress}`);
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Get all cached addresses
   */
  async getCachedAddresses(): Promise<string[]> {
    try {
      const result = await pool.query(
        'SELECT DISTINCT zcash_address FROM cross_chain_data ORDER BY last_updated DESC'
      );
      return result.rows.map(row => row.zcash_address);
    } catch (error) {
      console.error('Failed to get cached addresses:', error);
      return [];
    }
  }
}

// Export singleton instance
export const crossChainService = new CrossChainService();

export default crossChainService;
