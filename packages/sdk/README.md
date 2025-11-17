# Zscreener SDK

Official SDK for interacting with the Zscreener API.

## Installation

```bash
npm install @zscreener/sdk
```

## Usage

```typescript
import ZscreenerSDK from '@zscreener/sdk';

const sdk = new ZscreenerSDK({
  apiUrl: 'https://api.zscreener.com',
  apiKey: 'your-api-key',
});

// Example usage
const health = await sdk.getHealth();
console.log(health);
```

## Documentation

Full documentation coming soon.

## License

MIT
