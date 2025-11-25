import crypto from 'crypto';
import { getNilDBService, NilDBService } from './nil-db-service.js';
import { getNillionClient, NillionClient } from './nillion-client.js';

export interface HaloProofData {
  proofBytes: string;
  publicInputs: string[];
  proofType: 'spend' | 'output' | 'binding';
  verificationKey: string;
}

export interface EncryptedProofView {
  proofId: string;
  userId: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  encryptionAlgorithm: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface ProofEncryptionOptions {
  userId: string;
  proofData: HaloProofData;
  metadata?: Record<string, any>;
  storeInNilDB?: boolean;
}

export interface ProofDecryptionOptions {
  proofId: string;
  userId: string;
  fromNilDB?: boolean;
}

/**
 * Encryption Service for managing private views of zero-knowledge proofs
 * Provides encryption/decryption and secure storage of proof data
 */
export class EncryptionService {
  private client: NillionClient;
  private nilDBService: NilDBService;
  private encryptedProofs: Map<string, EncryptedProofView> = new Map();
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits

  constructor(client?: NillionClient, nilDBService?: NilDBService) {
    this.client = client || getNillionClient();
    this.nilDBService = nilDBService || getNilDBService();
  }

  /**
   * Generate a secure encryption key for a user
   */
  private generateEncryptionKey(userId: string): Buffer {
    // Use a deterministic salt based on userId for consistent key generation
    const salt = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 32);
    // In production, this should use a proper key derivation function with user's secret
    return crypto.pbkdf2Sync(userId, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt proof data using AES-256-GCM
   */
  private encryptProofData(proofData: HaloProofData, key: Buffer): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

    const proofString = JSON.stringify(proofData);
    let encrypted = cipher.update(proofString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt proof data using AES-256-GCM
   */
  private decryptProofData(
    encrypted: string,
    key: Buffer,
    iv: string,
    authTag: string
  ): HaloProofData {
    const decipher = crypto.createDecipheriv(
      this.ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Encrypt a proof view for a user
   */
  async encryptProofView(options: ProofEncryptionOptions): Promise<string> {
    const { userId, proofData, metadata, storeInNilDB = false } = options;

    // Generate proof ID
    const proofId = crypto.randomBytes(16).toString('hex');

    // Generate encryption key for user
    const encryptionKey = this.generateEncryptionKey(userId);

    // Encrypt the proof data
    const { encrypted, iv, authTag } = this.encryptProofData(proofData, encryptionKey);

    // Create encrypted proof view
    const encryptedProofView: EncryptedProofView = {
      proofId,
      userId,
      encryptedData: encrypted,
      iv,
      authTag,
      encryptionAlgorithm: this.ENCRYPTION_ALGORITHM,
      createdAt: Date.now(),
      metadata,
    };

    if (storeInNilDB) {
      // Store in Nil DB for enhanced privacy
      try {
        await this.nilDBService.storeData(encryptedProofView, {
          userId,
          metadata: {
            type: 'encrypted_proof_view',
            proofId,
            ...metadata,
          },
        });
      } catch (error) {
        console.error('Failed to store encrypted proof in Nil DB:', error);
        // Fall back to local storage
        this.encryptedProofs.set(proofId, encryptedProofView);
      }
    } else {
      // Store locally
      this.encryptedProofs.set(proofId, encryptedProofView);
    }

    return proofId;
  }

  /**
   * Decrypt a proof view for an authorized user
   */
  async decryptProofView(options: ProofDecryptionOptions): Promise<HaloProofData> {
    const { proofId, userId, fromNilDB = false } = options;

    let encryptedProofView: EncryptedProofView | null = null;

    if (fromNilDB) {
      // Retrieve from Nil DB
      try {
        encryptedProofView = await this.nilDBService.retrieveData({
          dataId: proofId,
          userId,
        });
      } catch (error) {
        console.error('Failed to retrieve encrypted proof from Nil DB:', error);
        // Fall back to local storage
        encryptedProofView = this.encryptedProofs.get(proofId) || null;
      }
    } else {
      // Retrieve from local storage
      encryptedProofView = this.encryptedProofs.get(proofId) || null;
    }

    if (!encryptedProofView) {
      throw new Error(`Encrypted proof ${proofId} not found`);
    }

    // Verify user authorization
    if (encryptedProofView.userId !== userId) {
      throw new Error('Unauthorized: User does not have access to this proof');
    }

    // Generate decryption key
    const decryptionKey = this.generateEncryptionKey(userId);

    // Decrypt the proof data
    try {
      const proofData = this.decryptProofData(
        encryptedProofView.encryptedData,
        decryptionKey,
        encryptedProofView.iv,
        encryptedProofView.authTag
      );

      return proofData;
    } catch (error) {
      throw new Error(`Failed to decrypt proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all encrypted proof IDs for a user
   */
  async listUserProofs(userId: string, includeNilDB: boolean = false): Promise<string[]> {
    const localProofIds = Array.from(this.encryptedProofs.values())
      .filter(proof => proof.userId === userId)
      .map(proof => proof.proofId);

    if (includeNilDB) {
      try {
        const nilDBProofIds = await this.nilDBService.listUserData(userId);
        return [...new Set([...localProofIds, ...nilDBProofIds])];
      } catch (error) {
        console.error('Failed to list proofs from Nil DB:', error);
        return localProofIds;
      }
    }

    return localProofIds;
  }

  /**
   * Delete an encrypted proof
   */
  async deleteEncryptedProof(proofId: string, userId: string, fromNilDB: boolean = false): Promise<void> {
    // Verify ownership
    const proof = this.encryptedProofs.get(proofId);
    if (proof && proof.userId !== userId) {
      throw new Error('Unauthorized: User does not own this proof');
    }

    // Delete from local storage
    this.encryptedProofs.delete(proofId);

    // Delete from Nil DB if requested
    if (fromNilDB) {
      try {
        await this.nilDBService.deleteData(proofId, userId);
      } catch (error) {
        console.error('Failed to delete proof from Nil DB:', error);
      }
    }
  }

  /**
   * Verify proof integrity (check if proof data is valid)
   */
  verifyProofIntegrity(proofData: HaloProofData): boolean {
    try {
      // Basic validation
      if (!proofData.proofBytes || !proofData.publicInputs || !proofData.verificationKey) {
        return false;
      }

      // Verify proof type
      const validProofTypes = ['spend', 'output', 'binding'];
      if (!validProofTypes.includes(proofData.proofType)) {
        return false;
      }

      // Verify proof bytes format (should be hex string)
      if (!/^[0-9a-fA-F]+$/.test(proofData.proofBytes)) {
        return false;
      }

      // Verify public inputs are valid
      if (!Array.isArray(proofData.publicInputs) || proofData.publicInputs.length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a hash of proof data for verification
   */
  generateProofHash(proofData: HaloProofData): string {
    const proofString = JSON.stringify({
      proofBytes: proofData.proofBytes,
      publicInputs: proofData.publicInputs,
      proofType: proofData.proofType,
    });

    return crypto.createHash('sha256').update(proofString).digest('hex');
  }

  /**
   * Batch encrypt multiple proofs
   */
  async batchEncryptProofs(
    userId: string,
    proofs: HaloProofData[],
    storeInNilDB: boolean = false
  ): Promise<string[]> {
    const proofIds: string[] = [];

    for (const proofData of proofs) {
      try {
        const proofId = await this.encryptProofView({
          userId,
          proofData,
          storeInNilDB,
        });
        proofIds.push(proofId);
      } catch (error) {
        console.error('Failed to encrypt proof in batch:', error);
        // Continue with other proofs
      }
    }

    return proofIds;
  }

  /**
   * Batch decrypt multiple proofs
   */
  async batchDecryptProofs(
    userId: string,
    proofIds: string[],
    fromNilDB: boolean = false
  ): Promise<HaloProofData[]> {
    const proofs: HaloProofData[] = [];

    for (const proofId of proofIds) {
      try {
        const proofData = await this.decryptProofView({
          proofId,
          userId,
          fromNilDB,
        });
        proofs.push(proofData);
      } catch (error) {
        console.error(`Failed to decrypt proof ${proofId}:`, error);
        // Continue with other proofs
      }
    }

    return proofs;
  }

  /**
   * Clear old encrypted proofs from cache
   */
  clearOldProofs(olderThanMs: number = 86400000): void {
    const cutoffTime = Date.now() - olderThanMs;

    for (const [proofId, proof] of this.encryptedProofs.entries()) {
      if (proof.createdAt < cutoffTime) {
        this.encryptedProofs.delete(proofId);
      }
    }
  }

  /**
   * Get encryption statistics for monitoring
   */
  getEncryptionStats(): {
    totalEncryptedProofs: number;
    proofsByUser: Record<string, number>;
    algorithm: string;
  } {
    const proofsByUser: Record<string, number> = {};

    for (const proof of this.encryptedProofs.values()) {
      proofsByUser[proof.userId] = (proofsByUser[proof.userId] || 0) + 1;
    }

    return {
      totalEncryptedProofs: this.encryptedProofs.size,
      proofsByUser,
      algorithm: this.ENCRYPTION_ALGORITHM,
    };
  }
}

// Singleton instance
let sharedService: EncryptionService | null = null;

/**
 * Get or create a shared Encryption service instance
 */
export function getEncryptionService(): EncryptionService {
  if (!sharedService) {
    sharedService = new EncryptionService();
  }
  return sharedService;
}

/**
 * Create a new Encryption service instance (not shared)
 */
export function createEncryptionService(
  client?: NillionClient,
  nilDBService?: NilDBService
): EncryptionService {
  return new EncryptionService(client, nilDBService);
}
