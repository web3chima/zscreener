import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getStats = async () => {
  const [priceRes, blockRes, analyticsRes] = await Promise.all([
    api.get('/price'),
    api.get('/transactions?limit=1'),
    api.get('/analytics/network-stats') // Fetch live analytics including hashrate
  ]);

  const priceData = priceRes.data as any;
  const blockData = blockRes.data as any;
  const analyticsData = analyticsRes.data as any;

  return {
    price: priceData?.zec?.usd || 0,
    priceChange: priceData?.zec?.usd_24h_change || 0,
    blockHeight: blockData?.data?.transactions?.[0]?.blockHeight || 0,
    // Add new fields from analytics
    networkHashrate: analyticsData?.data?.networkHashrate || 0,
    shieldedPoolSize: analyticsData?.data?.shieldedPoolSize || 0,
    totalShieldedTransactions: analyticsData?.data?.totalShieldedTransactions || 0
  };
};

export const getTransactions = async (params: any) => {
  const response = await api.get('/transactions', { params });
  return (response.data as any).data;
};

export const getTransactionByHash = async (hash: string) => {
  const response = await api.get(`/transactions/${hash}`);
  return response.data;
};

export const getWalletTransactions = async (viewingKey: string) => {
  const response = await api.get('/transactions/by-viewing-key', {
    params: { viewingKey }
  });
  return response.data;
};

export const getVolume = async (timeRange: string = '24h') => {
  const response = await api.get('/analytics/volume', {
    params: { timeRange }
  });
  return response.data;
};

export const createIntent = async (data: { amount: string, nearAccount: string }) => {
  const response = await api.post('/cross-chain/intent', {
    accountId: data.nearAccount,
    payload: { amount: data.amount, asset: 'ZEC' } // Construct payload
  });
  return response.data;
};
