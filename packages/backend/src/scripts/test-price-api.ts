import dotenv from 'dotenv';
import { priceService } from '../services/price-service.js';

dotenv.config();

async function testPriceAPI() {
  console.log('Testing Price API (without Redis)...\n');

  try {
    // Test 1: Fetch price from API
    console.log('Test 1: Fetching price from CoinGecko API...');
    const priceData = await priceService.fetchPrice();
    console.log('✓ Price fetched successfully:');
    console.log(`  ZEC/USD: $${priceData.zec.usd}`);
    console.log(`  24h Change: ${priceData.zec.usd_24h_change.toFixed(2)}%`);
    console.log(`  24h Volume: $${priceData.zec.usd_24h_vol.toLocaleString()}`);
    console.log(`  Market Cap: $${priceData.zec.usd_market_cap.toLocaleString()}`);
    console.log(`  Last Updated: ${new Date(priceData.zec.last_updated_at * 1000).toISOString()}`);
    console.log();

    // Test 2: Historical price data
    console.log('Test 2: Fetching historical price data (7 days)...');
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
      
      // Calculate price change
      const priceChange = ((lastPrice[1] - firstPrice[1]) / firstPrice[1]) * 100;
      console.log(`  7-day change: ${priceChange.toFixed(2)}%`);
    }
    console.log();

    console.log('✓ All API tests passed!');
    console.log('\nNote: Redis caching will work when Redis is running.');
    console.log('The service gracefully handles Redis being unavailable.');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testPriceAPI();

