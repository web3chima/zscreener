import crypto from 'crypto';
import { getNillionClient, NillionClient } from './nillion-client.js';

export interface NilDBStorageOptions {
  userId: string;
  encryptionKey?: string;
  metadata?: Record<string, any>;
}

export interface NilDBStorageResult {
  dataId: string;
  userId: string;
  storedAt: number;
  encryptionKeyId: string;
}

export interface NilDBRetrievalOptions {
  dataId: string;
  userId: string;
  encryptionKey?: string;
}

export interface StoredData {
  dataId: string;
  data: any;
  userId: string;
  metadata?: Record<string, any>;
  storedAt: number;
}

/**
 * Nil DB Service for privacy-preserving data storage
 * Handles encryption, storage, and retrieval of data in Nillion's Nil DB
 */
export class NilDBService {
  private client: NillionClient;
  private encryptionKeys: Map<string, Buffer> = new Map();

  constructor(client?: NillionClient) {
    this.client = client || getNillionClient();
  }

  /**
   * Generate or retrieve an encryption key for a user
   */
  private async getOrCreateEncryptionKey(userId: string, providedKey?: string): Promise<{ key: Buffer; keyId: string }> {
    if (providedKey) {
      const key = Buffer.from(providedKey, 'hex');
      const keyId = crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
      return { key, keyId };
    }

    // Check if we have a cached key for this user
    const cachedKey = this.encryptionKeys.get(userId);
    if (cachedKey) {
      const keyId = crypto.createHash('sha256').update(cachedKey).digest('hex').substring(0, 16);
      return { key: cachedKey, keyId };
    }

    // Generate a new key
    const key = crypto.randomBytes(32); // 256-bit key
    this.encryptionKeys.set(userId, key);
    const keyId = crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);

    return { key, keyId };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encryptData(data: any, key: Buffer): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const dataString = JSON.stringify(data);
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decryptData(encrypted: string, key: Buffer, iv: string, authTag: string): any {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Store data in Nil DB with encryption
   */
  async storeData(data: any, options: NilDBStorageOptions): Promise<NilDBStorageResult> {
    const { userId, encryptionKey, metadata } = options;

    // Get or create encryption key
    const { key, keyId } = await this.getOrCreateEncryptionKey(userId, encryptionKey);

    // Encrypt the data
    const { encrypted, iv, authTag } = this.encryptData(data, key);

    // Generate unique data ID
    const dataId = crypto.randomBytes(16).toString('hex');

    // Prepare storage payload
    const storagePayload = {
      dataId,
      userId,
      encrypted,
      iv,
      authTag,
      encryptionKeyId: keyId,
      metadata: metadata || {},
      storedAt: Date.now(),
    };

    try {
      // Store in Nil DB via Nillion client
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      await httpClient.post(`${config.nilDbEndpoint}/store`, storagePayload);

      return {
        dataId,
        userId,
        storedAt: storagePayload.storedAt,
        encryptionKeyId: keyId,
      };
    } catch (error) {
      console.error('Nil DB storage failed:', error);
      throw new Error(`Failed to store data in Nil DB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and decrypt data from Nil DB
   */
  async retrieveData(options: NilDBRetrievalOptions): Promise<any> {
    const { dataId, userId, encryptionKey } = options;

    try {
      // Retrieve from Nil DB via Nillion client
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      const response = await httpClient.get(`${config.nilDbEndpoint}/retrieve/${dataId}`, {
        params: { userId },
      });

      const storedData = response.data;

      // Get the encryption key
      const { key } = await this.getOrCreateEncryptionKey(userId, encryptionKey);

      // Decrypt the data
      const decryptedData = this.decryptData(
        storedData.encrypted,
        key,
        storedData.iv,
        storedData.authTag
      );

      return decryptedData;
    } catch (error) {
      throw new Error(`Failed to retrieve data from Nil DB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete data from Nil DB
   */
  async deleteData(dataId: string, userId: string): Promise<void> {
    try {
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      await httpClient.delete(`${config.nilDbEndpoint}/delete/${dataId}`, {
        params: { userId },
      });
    } catch (error) {
      console.error('Nil DB deletion failed:', error);
      throw new Error(`Failed to delete data from Nil DB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all data IDs for a user
   */
  async listUserData(userId: string): Promise<string[]> {
    try {
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      const response = await httpClient.get(`${config.nilDbEndpoint}/list`, {
        params: { userId },
      });

      return response.data.dataIds || [];
    } catch (error) {
      console.error('Nil DB list failed:', error);
      throw new Error(`Failed to list data from Nil DB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export encryption key for a user (use with caution)
   */
  exportEncryptionKey(userId: string): string | null {
    const key = this.encryptionKeys.get(userId);
    return key ? key.toString('hex') : null;
  }

  /**
   * Import encryption key for a user
   */
  importEncryptionKey(userId: string, keyHex: string): void {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('Invalid encryption key length. Expected 32 bytes (256 bits)');
    }
    this.encryptionKeys.set(userId, key);
  }

  /**
   * Clear cached encryption keys
   */
  clearEncryptionKeys(): void {
    this.encryptionKeys.clear();
  }
}

// Singleton instance
let sharedService: NilDBService | null = null;

/**
 * Get or create a shared Nil DB service instance
 */
export function getNilDBService(): NilDBService {
  if (!sharedService) {
    sharedService = new NilDBService();
  }
  return sharedService;
}

/**
 * Create a new Nil DB service instance (not shared)
 */
export function createNilDBService(client?: NillionClient): NilDBService {
  return new NilDBService(client);
}
