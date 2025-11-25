import * as nearAPI from 'near-api-js';
import dotenv from 'dotenv';

dotenv.config();

const { keyStores } = nearAPI;

export interface NEARConfig {
  networkId: string;
  nodeUrl: string;
  walletUrl?: string;
  helperUrl?: string;
  explorerUrl?: string;
}

/**
 * Get NEAR network configuration based on environment
 */
export function getNEARConfig(): NEARConfig {
  const network = process.env.NEAR_NETWORK || 'testnet';
  const nodeUrl = process.env.NEAR_NODE_URL;

  if (network === 'mainnet') {
    return {
      networkId: 'mainnet',
      nodeUrl: nodeUrl || 'https://rpc.mainnet.near.org',
      walletUrl: 'https://wallet.near.org',
      helperUrl: 'https://helper.mainnet.near.org',
      explorerUrl: 'https://explorer.mainnet.near.org',
    };
  } else {
    return {
      networkId: 'testnet',
      nodeUrl: nodeUrl || 'https://rpc.testnet.near.org',
      walletUrl: 'https://wallet.testnet.near.org',
      helperUrl: 'https://helper.testnet.near.org',
      explorerUrl: 'https://explorer.testnet.near.org',
    };
  }
}

/**
 * Create NEAR connection instance
 */
export async function createNEARConnection() {
  const config = getNEARConfig();
  
  // Use in-memory key store for server-side operations
  const keyStore = new keyStores.InMemoryKeyStore();

  const connectionConfig = {
    networkId: config.networkId,
    keyStore,
    nodeUrl: config.nodeUrl,
    walletUrl: config.walletUrl,
    helperUrl: config.helperUrl,
  };

  try {
    // Use Near constructor directly instead of deprecated connect()
    const nearConnection = new nearAPI.Near(connectionConfig);
    console.log(`Connected to NEAR ${config.networkId} network`);
    return nearConnection;
  } catch (error) {
    console.error('Failed to connect to NEAR network:', error);
    throw new Error(`NEAR connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Singleton NEAR connection instance
 */
let nearConnectionInstance: nearAPI.Near | null = null;

/**
 * Get or create NEAR connection instance
 */
export async function getNEARConnection(): Promise<nearAPI.Near> {
  if (!nearConnectionInstance) {
    nearConnectionInstance = await createNEARConnection();
  }
  return nearConnectionInstance;
}

/**
 * Close NEAR connection
 */
export function closeNEARConnection(): void {
  nearConnectionInstance = null;
  console.log('NEAR connection closed');
}

export default {
  getNEARConfig,
  createNEARConnection,
  getNEARConnection,
  closeNEARConnection,
};
