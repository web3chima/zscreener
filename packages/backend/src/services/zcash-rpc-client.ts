import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface ZcashRPCConfig {
  url: string;
  user: string;
  password: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface RPCRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params: any[];
}

interface RPCResponse<T = any> {
  result: T;
  error: {
    code: number;
    message: string;
  } | null;
  id: string | number;
}

interface BlockInfo {
  hash: string;
  confirmations: number;
  height: number;
  version: number;
  merkleroot: string;
  time: number;
  nonce: string;
  bits: string;
  difficulty: number;
  previousblockhash?: string;
  nextblockhash?: string;
  tx: string[];
}

interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  verificationprogress: number;
  chainwork: string;
  pruned: boolean;
  commitments: number;
  valuePools: Array<{
    id: string;
    monitored: boolean;
    chainValue: number;
    chainValueZat: number;
  }>;
}

interface RawTransaction {
  hex: string;
  txid: string;
  version: number;
  locktime: number;
  vin: any[];
  vout: any[];
  vShieldedSpend?: any[];
  vShieldedOutput?: any[];
  bindingSig?: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

export class ZcashRPCError extends Error {
  constructor(
    message: string,
    public code: string,
    public rpcCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ZcashRPCError';
  }
}

export class ZcashRPCClient {
  private client: AxiosInstance;
  private config: Required<ZcashRPCConfig>;
  private requestId: number = 0;

  constructor(config?: Partial<ZcashRPCConfig>) {
    this.config = {
      url: config?.url || process.env.ZCASH_RPC_URL || 'http://localhost:8232',
      user: config?.user || process.env.ZCASH_RPC_USER || 'zcashrpc',
      password: config?.password || process.env.ZCASH_RPC_PASSWORD || '',
      timeout: config?.timeout || 30000,
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000,
    };

    this.client = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
      auth: {
        username: this.config.user,
        password: this.config.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make an RPC call with retry logic
   * Changed from private to public for external usage
   */
  public async call<T = any>(
    method: string,
    params: any[] = []
  ): Promise<T> {
    const request: RPCRequest = {
      jsonrpc: '1.0',
      id: ++this.requestId,
      method,
      params,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.post<RPCResponse<T>>('', request);

        if (response.data.error) {
          throw new ZcashRPCError(
            response.data.error.message,
            'RPC_ERROR',
            response.data.error.code,
            { method, params }
          );
        }

        return response.data.result;
      } catch (error: any) {
        lastError = error;

        if (error instanceof ZcashRPCError) {
          throw error;
        }

        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw new ZcashRPCError(
            `RPC request failed: ${error.message}`,
            'RPC_CLIENT_ERROR',
            error.response.status,
            { method, params, response: error.response.data }
          );
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * attempt;
          console.warn(
            `RPC call to ${method} failed (attempt ${attempt}/${this.config.maxRetries}). Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        throw new ZcashRPCError(
          `RPC call to ${method} failed after ${this.config.maxRetries} attempts: ${error.message}`,
          'RPC_MAX_RETRIES_EXCEEDED',
          undefined,
          { method, params, originalError: error.message }
        );
      }
    }

    throw lastError || new Error('Unexpected error in RPC call');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getBlock(hashOrHeight: string | number, verbosity: number = 1): Promise<BlockInfo> {
    return this.call<BlockInfo>('getblock', [hashOrHeight, verbosity]);
  }

  async getRawTransaction(txid: string, verbose: boolean = true): Promise<RawTransaction> {
    return this.call<RawTransaction>('getrawtransaction', [txid, verbose ? 1 : 0]);
  }

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.call<BlockchainInfo>('getblockchaininfo', []);
  }

  async getBlockHash(height: number): Promise<string> {
    return this.call<string>('getblockhash', [height]);
  }

  async getBlockCount(): Promise<number> {
    return this.call<number>('getblockcount', []);
  }

  async getBestBlockHash(): Promise<string> {
    return this.call<string>('getbestblockhash', []);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getBlockchainInfo();
      return true;
    } catch (error) {
      console.error('Failed to connect to Zcash node:', error);
      return false;
    }
  }

  getConfig(): Omit<ZcashRPCConfig, 'password'> {
    return {
      url: this.config.url,
      user: this.config.user,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
    };
  }
}

export const zcashRPCClient = new ZcashRPCClient();
