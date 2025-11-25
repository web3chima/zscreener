import axios from 'axios';
import { redisClient } from '../config/redis.js';
import { notificationService } from './notification-service.js';

interface PriceData {
  zec: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
    last_updated_at: number;
  };
}

interface CachedPriceData extends PriceData {
  cached_at: number;
}

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const CACHE_KEY = 'price:zec';
const CACHE_TTL = 60; // 1 minute cache
const PRICE_CHANGE_THRESHOLD = 0.5; // 0.5% change triggers WebSocket update

class PriceService {
  private lastBroadcastPrice: number | null = null;
  private fetchInterval: NodeJS.Timeout | null = null;

  /**
   * Fetch current ZEC price from CoinGecko API
   */
  async fetchPrice(): Promise<PriceData> {
    try {
      const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
        params: {
          ids: 'zcash',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true,
          include_market_cap: true,
          include_last_updated_at: true,
        },
        timeout: 5000,
      });

      if (!response.data || !response.data.zcash) {
        throw new Error('Invalid response from CoinGecko API');
      }

      const priceData: PriceData = {
        zec: {
          usd: response.data.zcash.usd,
          usd_24h_change: response.data.zcash.usd_24h_change || 0,
          usd_24h_vol: response.data.zcash.usd_24h_vol || 0,
          usd_market_cap: response.data.zcash.usd_market_cap || 0,
          last_updated_at: response.data.zcash.last_updated_at || Date.now() / 1000,
        },
      };

      return priceData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('CoinGecko API error:', error.message);
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded for CoinGecko API');
        }
      }
      throw new Error('Failed to fetch price data from CoinGecko');
    }
  }

  /**
   * Get ZEC price with caching
   */
  async getPrice(): Promise<CachedPriceData> {
    try {
      // Check cache first
      const cached = await redisClient.get(CACHE_KEY);
      
      if (cached) {
        const cachedData: CachedPriceData = JSON.parse(cached);
        return cachedData;
      }

      // Fetch fresh data
      const priceData = await this.fetchPrice();
      const cachedPriceData: CachedPriceData = {
        ...priceData,
        cached_at: Date.now(),
      };

      // Store in cache
      await redisClient.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(cachedPriceData));

      return cachedPriceData;
    } catch (error) {
      // If fetch fails, try to return stale cache data
      const staleCache = await redisClient.get(CACHE_KEY);
      if (staleCache) {
        console.warn('Returning stale price data due to fetch error');
        return JSON.parse(staleCache);
      }
      throw error;
    }
  }

  /**
   * Check if price has changed significantly
   */
  private shouldBroadcastPriceUpdate(currentPrice: number): boolean {
    if (this.lastBroadcastPrice === null) {
      return true;
    }

    const percentChange = Math.abs(
      ((currentPrice - this.lastBroadcastPrice) / this.lastBroadcastPrice) * 100
    );

    return percentChange >= PRICE_CHANGE_THRESHOLD;
  }

  /**
   * Start periodic price updates and WebSocket broadcasting
   */
  startPriceUpdates(intervalMs: number = 60000): void {
    if (this.fetchInterval) {
      console.warn('Price update interval already running');
      return;
    }

    console.log(`Starting price updates every ${intervalMs}ms`);

    // Fetch immediately on start
    this.updateAndBroadcastPrice();

    // Then fetch periodically
    this.fetchInterval = setInterval(() => {
      this.updateAndBroadcastPrice();
    }, intervalMs);
  }

  /**
   * Stop periodic price updates
   */
  stopPriceUpdates(): void {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
      console.log('Stopped price updates');
    }
  }

  /**
   * Update price and broadcast via WebSocket if significant change
   */
  private async updateAndBroadcastPrice(): Promise<void> {
    try {
      const priceData = await this.fetchPrice();
      const currentPrice = priceData.zec.usd;

      // Store in cache
      const cachedPriceData: CachedPriceData = {
        ...priceData,
        cached_at: Date.now(),
      };
      await redisClient.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(cachedPriceData));

      // Broadcast if price changed significantly
      if (this.shouldBroadcastPriceUpdate(currentPrice)) {
        notificationService.broadcastPriceUpdate(cachedPriceData);
        this.lastBroadcastPrice = currentPrice;
        console.log(`Price update broadcast: $${currentPrice}`);
      }
    } catch (error) {
      console.error('Error updating price:', error);
    }
  }

  /**
   * Get historical price data (if needed in future)
   */
  async getHistoricalPrice(days: number = 7): Promise<any> {
    try {
      const response = await axios.get(
        `${COINGECKO_API_URL}/coins/zcash/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days,
            interval: days <= 1 ? 'hourly' : 'daily',
          },
          timeout: 10000,
        }
      );

      return {
        prices: response.data.prices,
        market_caps: response.data.market_caps,
        total_volumes: response.data.total_volumes,
      };
    } catch (error) {
      console.error('Error fetching historical price:', error);
      throw new Error('Failed to fetch historical price data');
    }
  }
}

export const priceService = new PriceService();

