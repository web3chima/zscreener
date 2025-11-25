import dotenv from 'dotenv';
import { priceService } from '../services/price-service.js';
import { redisClient } from '../config/redis.js';

dotenv.config();

async function testPriceService() {
  console.log('Testing Price Service...\n');

  try {
    // Test 1: Fetch price from API
    console.log('Test 1: Fetching price from CoinGecko API...');
    const priceData = await priceService.fetchPrice();
    console.log('✓ Price fetched successfully:');
    console.log(`  ZEC/USD: $${priceData.zec.usd}`);
    console.log(`  24h Change: ${priceData.zec.usd_24h_change.toFixed(2)}%`);
    console.log(`  24h Volume: $${priceData.zec.usd_24h_vol.toLocaleString()}`);
    console.log(`  Market Cap: $${priceData.zec.usd_market_cap.toLocaleString()}`);
    console.log();

    // Test 2: Get price with caching
    console.log('Test 2: Getting price with caching...');
    const cachedPrice1 = await priceService.getPrice();
    console.log('✓ First call (should fetch from API):');
    console.log(`  ZEC/USD: $${cachedPrice1.zec.usd}`);
    console.log(`  Cached at: ${new Date(cachedPrice1.cached_at).toISOString()}`);
    console.log();

    // Test 3: Get price again (should use cache)
    console.log('Test 3: Getting price again (should use cache)...');
    const cachedPrice2 = await priceService.getPrice();
    console.log('✓ Second call (should use cache):');
    console.log(`  ZEC/USD: $${cachedPrice2.zec.usd}`);
    console.log(`  Cached at: ${new Date(cachedPrice2.cached_at).toISOString()}`);
    console.log(`  Same cache: ${cachedPrice1.cached_at === cachedPrice2.cached_at ? 'Yes' : 'No'}`);
    console.log();

    // Test 4: Check Redis cache
    console.log('Test 4: Checking Redis cache...');
    const cacheKey = 'price:zec';
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      console.log('✓ Data found in Redis cache:');
      console.log(`  ZEC/USD: $${parsed.zec.usd}`);
      const ttl = await redisClient.ttl(cacheKey);
      console.log(`  TTL: ${ttl} seconds`);
    } else {
      console.log('✗ No data in Redis cache');
    }
    console.log();

    // Test 5: Historical price data
    console.log('Test 5: Fetching historical price data (7 days)...');
    const historicalData = await priceService.getHistoricalPrice(7);
    console.log('✓ Historical data fetched:');
    console.log(`  Price data points: ${historicalData.prices.length}`);
    console.log(`  Market cap data points: ${historicalData.market_caps.length}`);
    console.log(`  Volume data points: ${historicalData.total_volumes.length}`);
    if (historicalData.prices.length > 0) {
      const firstPrice = historicalData.prices[0];
      const lastPrice = historicalData.prices[historicalData.prices.length - 1];
      console.log(`  First price: $${firstPrice[1]} at ${new Date(firstPrice[0]).toISOString()}`);
      console.log(`  Last price: $${lastPrice[1]} at ${new Date(lastPrice[0]).toISOString()}`);
    }
    console.log();

    console.log('✓ All tests passed!');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await redisClient.quit();
    process.exit(0);
  }
}

testPriceService();

