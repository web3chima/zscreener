import dotenv from 'dotenv';

dotenv.config();

export interface NillionConfig {
  endpoint: string;
  apiKey: string;
  network: 'testnet' | 'mainnet';
  nilDbEndpoint: string;
  nilccEndpoint: string;
  timeout: number;
}

export const nillionConfig: NillionConfig = {
  endpoint: process.env.NILLION_ENDPOINT || 'https://api.nillion.testnet',
  apiKey: process.env.NILLION_API_KEY || '',
  network: (process.env.NILLION_NETWORK as 'testnet' | 'mainnet') || 'testnet',
  nilDbEndpoint: process.env.NIL_DB_ENDPOINT || 'https://nildb.nillion.testnet',
  nilccEndpoint: process.env.NILCC_ENDPOINT || 'https://nilcc.nillion.testnet',
  timeout: parseInt(process.env.NILLION_TIMEOUT || '30000', 10),
};

export function validateNillionConfig(): void {
  if (!nillionConfig.apiKey) {
    console.warn('Warning: NILLION_API_KEY not set. Nillion features will be disabled.');
  }
  
  if (!nillionConfig.endpoint) {
    throw new Error('NILLION_ENDPOINT must be configured');
  }
}
