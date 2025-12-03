import axios, { AxiosInstance } from 'axios';

export interface SDKConfig {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface Transaction {
  txHash: string;
  blockHeight: number;
  timestamp: string;
  shieldedInputs: number;
  shieldedOutputs: number;
  proofData?: any;
  memoData?: string;
}

export interface WalletStats {
  totalTransactions: number;
  totalShieldedInputs: number;
  totalShieldedOutputs: number;
}

export interface CrossChainIntent {
  intentId: string;
  status: string;
  txHash?: string;
}

export class ZscreenerSDK {
  private client: AxiosInstance;

  constructor(config: SDKConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
    });
  }

  /**
   * Check API Health
   */
  async getHealth(): Promise<{ status: string; service: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * Get recent transactions
   */
  async getTransactions(params: {
    limit?: number;
    offset?: number;
    minShieldedInputs?: number
  } = {}): Promise<{ transactions: Transaction[]; pagination: any }> {
    const response = await this.client.get('/transactions', { params });
    return response.data.data;
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(hash: string): Promise<Transaction> {
    const response = await this.client.get(`/transactions/${hash}`);
    return response.data.data;
  }

  /**
   * Submit a Viewing Key to access shielded history
   * @param viewingKey The unified or sapling viewing key
   */
  async submitViewingKey(viewingKey: string): Promise<{
    transactions: Transaction[];
    stats: WalletStats;
  }> {
    const response = await this.client.get('/transactions/by-viewing-key', {
      params: { viewingKey }
    });
    return response.data.data;
  }

  /**
   * Get Cross-Chain DeFi Stats
   */
  async getCrossChainStats(zcashAddress: string): Promise<any> {
    const response = await this.client.get('/cross-chain/summary', {
      params: { zcashAddress }
    });
    return response.data.data;
  }

  /**
   * Create a Cross-Chain Intent (Chain Signature)
   */
  async createCrossChainIntent(accountId: string, payload: string): Promise<CrossChainIntent> {
    const response = await this.client.post('/cross-chain/intent', {
      accountId,
      payload
    });
    return response.data.data;
  }

  /**
   * Get Network Statistics
   */
  async getNetworkStats(): Promise<{ price: number; blockHeight: number }> {
    // This aggregates multiple endpoints for convenience
    const priceRes = await this.client.get('/price');
    // Assuming transactions endpoint returns latest block in pagination meta or first tx
    const txRes = await this.client.get('/transactions?limit=1');

    return {
      price: priceRes.data.zec?.usd || 0,
      blockHeight: txRes.data.data.transactions[0]?.blockHeight || 0
    };
  }
}

export default ZscreenerSDK;
