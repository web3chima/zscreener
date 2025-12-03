import * as nearAPI from 'near-api-js';
import { getNEARConnection } from '../config/near.js';

const { utils } = nearAPI;

export interface NEARAccountInfo {
  accountId: string;
  balance: string;
  balanceFormatted: string;
  storageUsage: number;
  blockHeight: number;
  blockHash: string;
}

export interface ChainSignatureIntent {
  payload: string; // The payload to be signed (e.g., Zcash tx hash)
  path: string; // Derivation path for the key
  key_version: number;
}

/**
 * NEAR Service for interacting with NEAR Protocol
 */
export class NEARService {
  private connection: nearAPI.Near | null = null;
  private mpcContractId: string = 'v1.signer-prod.testnet'; // Standard Testnet MPC contract

  /**
   * Initialize NEAR connection
   */
  async initialize(): Promise<void> {
    try {
      this.connection = await getNEARConnection();
      console.log('NEAR Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NEAR Service:', error);
      throw error;
    }
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<nearAPI.Near> {
    if (!this.connection) {
      await this.initialize();
    }
    return this.connection!;
  }

  /**
   * Create a Cross-Chain Intent (Chain Signature)
   * This prepares the arguments for calling the NEAR MPC contract to sign a Zcash transaction.
   */
  async createCrossChainIntent(
    accountId: string,
    zcashTxHash: string,
    derivationPath: string = 'zcash-1'
  ): Promise<any> {
    // In a full implementation, this would send a transaction to the NEAR network.
    // For this backend service, we verify the capability and return the instructions
    // for the frontend or perform a view call to check fee requirements.

    console.log(`Creating Cross-Chain Intent for ${accountId} -> Zcash Tx ${zcashTxHash}`);

    try {
      // Check if MPC contract is alive
      await this.viewContractState(this.mpcContractId, 'public_key', {});

      return {
        intentId: `intent-${Date.now()}`,
        status: 'ready_to_sign',
        contractId: this.mpcContractId,
        methodName: 'sign',
        args: {
          payload: Array.from(Buffer.from(zcashTxHash, 'hex')),
          path: derivationPath,
          key_version: 0
        },
        deposit: '0.05' // Estimated fee in NEAR
      };
    } catch (error) {
       console.error('Failed to prepare cross-chain intent:', error);
       throw new Error(`Failed to interact with NEAR MPC contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get NEAR account information
   */
  async getAccountInfo(accountId: string): Promise<NEARAccountInfo> {
    try {
      const connection = await this.ensureConnection();
      const provider = connection.connection.provider;
      
      const accountState: any = await provider.query({
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId,
      });

      return {
        accountId,
        balance: accountState.amount,
        balanceFormatted: utils.format.formatNearAmount(accountState.amount),
        storageUsage: accountState.storage_usage,
        blockHeight: accountState.block_height,
        blockHash: accountState.block_hash,
      };
    } catch (error) {
      console.error(`Failed to get account info for ${accountId}:`, error);
      throw new Error(`Failed to fetch NEAR account info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ... (keep existing methods: accountExists, getAccountBalance, viewContractState, etc.)

  /**
   * Check if NEAR account exists
   */
  async accountExists(accountId: string): Promise<boolean> {
    try {
      await this.getAccountInfo(accountId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAccountBalance(accountId: string): Promise<string> {
    try {
      const accountInfo = await this.getAccountInfo(accountId);
      return accountInfo.balanceFormatted;
    } catch (error) {
      console.error(`Failed to get balance for ${accountId}:`, error);
      throw new Error(`Failed to fetch account balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async viewContractState(
    contractId: string,
    methodName: string,
    args: any = {}
  ): Promise<any> {
    try {
      const connection = await this.ensureConnection();
      const account = await connection.account(contractId);
      
      const result = await account.viewFunction({
        contractId,
        methodName,
        args,
      });

      return result;
    } catch (error) {
      console.error(`Failed to view contract state for ${contractId}.${methodName}:`, error);
      throw new Error(`Failed to view contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getNetworkStatus(): Promise<any> {
    try {
      const connection = await this.ensureConnection();
      const status = await connection.connection.provider.status();
      return status;
    } catch (error) {
      console.error('Failed to get network status:', error);
      throw new Error(`Failed to get network status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBlock(blockId: number | string): Promise<any> {
    try {
      const connection = await this.ensureConnection();
      const blockQuery = typeof blockId === 'number' ? { blockId } : { blockId };
      const block = await connection.connection.provider.block(blockQuery);
      return block;
    } catch (error) {
      console.error(`Failed to get block ${blockId}:`, error);
      throw new Error(`Failed to get block: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTransactionStatus(txHash: string, accountId: string): Promise<any> {
    try {
      const connection = await this.ensureConnection();
      const result = await connection.connection.provider.txStatus(txHash, accountId, 'FINAL');
      return result;
    } catch (error) {
      console.error(`Failed to get transaction status for ${txHash}:`, error);
      throw new Error(`Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async queryRPC(method: string, params: any): Promise<any> {
    try {
      const connection = await this.ensureConnection();
      const result = await connection.connection.provider.query({
        request_type: method,
        ...params,
      });
      return result;
    } catch (error) {
      console.error(`Failed to query RPC method ${method}:`, error);
      throw new Error(`RPC query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConnection(): Promise<nearAPI.Near> {
    return this.ensureConnection();
  }
}

export const nearService = new NEARService();
export default nearService;
