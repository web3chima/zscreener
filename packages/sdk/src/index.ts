export interface SDKConfig {
  apiUrl: string;
  apiKey?: string;
}

export class ZscreenerSDK {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  async getHealth(): Promise<{ status: string }> {
    // Placeholder implementation
    return { status: 'ok' };
  }
}

export default ZscreenerSDK;
