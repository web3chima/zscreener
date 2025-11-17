# Zscreener

Advanced Zcash privacy block explorer with cross-chain insights and analytics for shielded transactions.

## Overview

Zscreener leverages NEAR Intents and privacy chain signatures to provide cross-chain insights while preserving user privacy. The system enables users to analyze Zcash shielded transactions, view NFT data through ZSA/ZIP 231 integration, and access privacy-preserving analytics through Nillion's confidential compute and private storage solutions.

## Project Structure

This is a monorepo containing three main packages:

```
zscreener/
├── packages/
│   ├── frontend/     # React web application
│   ├── backend/      # Node.js Express API server
│   └── sdk/          # Zscreener SDK for developers
└── package.json      # Root package configuration
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 6
- Zcash node (for indexing)

## Getting Started

### Installation

```bash
# Install dependencies for all packages
npm install
```

### Development

```bash
# Run all packages in development mode
npm run dev

# Or run individual packages
cd packages/frontend && npm run dev
cd packages/backend && npm run dev
```

### Environment Configuration

Copy the example environment files and configure them:

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env

# Frontend
cp packages/frontend/.env.example packages/frontend/.env
```

See the `.env.example` files for required configuration variables.

## Building

```bash
# Build all packages
npm run build
```

## Code Quality

```bash
# Lint all packages
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

## Architecture

- **Frontend**: React 18+ with TypeScript, TailwindCSS, React Query
- **Backend**: Node.js with Express, PostgreSQL, Redis, Bull queues
- **SDK**: TypeScript library for programmatic access

## Key Features

- Shielded transaction analytics
- Viewing key support for private transaction history
- ZSA and ZIP 231 NFT integration
- NEAR Intents for cross-chain data
- Nillion confidential compute and private storage
- Real-time alerts and notifications
- Developer SDK for integration

## Repository

https://github.com/web3chima/zscreener.git

## License

MIT
