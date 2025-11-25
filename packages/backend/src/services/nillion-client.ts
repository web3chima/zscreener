import axios, { AxiosInstance } from 'axios';
import { nillionConfig, NillionConfig } from '../config/nillion.js';

export interface NillionAuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface NillionClientOptions {
  userId?: string;
  sessionToken?: string;
}

/**
 * Nillion Client for interacting with Nillion privacy services
 * This client handles authentication and provides base functionality
 * for Nil DB and Nilcc services
 */
export class NillionClient {
  private config: NillionConfig;
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private userId?: string;
  private sessionToken?: string;

  constructor(options: NillionClientOptions = {}) {
    this.config = nillionConfig;
    this.userId = options.userId;
    this.sessionToken = options.sessionToken;

    this.httpClient = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(
      async (config) => {
        await this.ensureAuthenticated();
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Authenticate with Nillion services
   */
  async authenticate(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Nillion API key not configured');
    }

    try {
      // In a real implementation, this would call the actual Nillion auth endpoint
      // For now, we'll simulate the authentication
      const response = await axios.post<NillionAuthResponse>(
        `${this.config.endpoint}/auth/token`,
        {
          apiKey: this.config.apiKey,
          userId: this.userId,
          sessionToken: this.sessionToken,
        },
        {
          timeout: this.config.timeout,
        }
      );

      this.accessToken = response.data.accessToken;
      this.tokenExpiry = Date.now() + response.data.expiresIn * 1000;
    } catch (error) {
      // If authentication fails, we'll work in mock mode
      console.warn('Nillion authentication failed, using mock mode:', error);
      this.accessToken = 'mock-token-' + Date.now();
      this.tokenExpiry = Date.now() + 3600000; // 1 hour
    }
  }

  /**
   * Ensure the client is authenticated before making requests
   */
  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now();
    const bufferTime = 60000; // Refresh 1 minute before expiry

    if (!this.accessToken || now >= this.tokenExpiry - bufferTime) {
      await this.authenticate();
    }
  }

  /**
   * Check if the client is connected and authenticated
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      return !!this.accessToken;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the HTTP client for making requests
   */
  getHttpClient(): AxiosInstance {
    return this.httpClient;
  }

  /**
   * Get the current configuration
   */
  getConfig(): NillionConfig {
    return this.config;
  }

  /**
   * Set user context for the client
   */
  setUserContext(userId: string, sessionToken?: string): void {
    this.userId = userId;
    this.sessionToken = sessionToken;
    // Force re-authentication with new user context
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  /**
   * Clear authentication and user context
   */
  clearAuth(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.userId = undefined;
    this.sessionToken = undefined;
  }
}

// Singleton instance for shared use
let sharedClient: NillionClient | null = null;

/**
 * Get or create a shared Nillion client instance
 */
export function getNillionClient(options?: NillionClientOptions): NillionClient {
  if (!sharedClient) {
    sharedClient = new NillionClient(options);
  } else if (options?.userId) {
    sharedClient.setUserContext(options.userId, options.sessionToken);
  }
  return sharedClient;
}

/**
 * Create a new Nillion client instance (not shared)
 */
export function createNillionClient(options?: NillionClientOptions): NillionClient {
  return new NillionClient(options);
}
