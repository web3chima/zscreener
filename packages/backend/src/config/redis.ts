import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;

// Create Redis client for general use
export const redisClient = new Redis.default(redisUrl, {
  password: redisPassword || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('error', (err: Error) => {
  console.error('Redis client error:', err);
});

export default redisClient;
