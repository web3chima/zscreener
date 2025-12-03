import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import analyticsRoutes from './routes/analytics.js';
import crossChainRoutes from './routes/cross-chain.js';
import nftRoutes from './routes/nft.js';
import alertRoutes from './routes/alerts.js';
import privacyRoutes from './routes/privacy.js';
import priceRoutes from './routes/price.js';
import { notificationService } from './services/notification-service.js';
import { priceService } from './services/price-service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'zscreener-backend', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cross-chain', crossChainRoutes);
app.use('/api/nft', nftRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/price', priceRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
    return;
  }
  
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }
  
  // Default error response
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
    },
  });
});

// Initialize WebSocket notification service
notificationService.initialize(httpServer);

// Start price update service (updates every 5 minutes to avoid rate limits)
priceService.startPriceUpdates(300000);

// Start Block Indexer Worker
const isProduction = process.env.NODE_ENV === 'production' || __filename.endsWith('.js');
const workerExtension = isProduction ? 'js' : 'ts';
const scriptPath = path.resolve(__dirname, `scripts/start-worker.${workerExtension}`);

console.log(`Starting indexer worker from ${scriptPath}...`);

const worker = fork(scriptPath, [], {
  execArgv: isProduction ? [] : ['--import', 'tsx'],
  env: { ...process.env }
});

worker.on('message', (msg) => {
  console.log('[Indexer Worker]:', msg);
});

worker.on('error', (err) => {
  console.error('[Indexer Worker Error]:', err);
});

worker.on('exit', (code) => {
  if (code !== 0) {
    console.warn(`[Indexer Worker] stopped with exit code ${code}`);
  }
});


httpServer.listen(PORT, () => {
  console.log(`Zscreener backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
  console.log(`Price oracle service started`);
  console.log(`NillionAgent Integration: Enabled (User: ${process.env.API_USER})`);
});
