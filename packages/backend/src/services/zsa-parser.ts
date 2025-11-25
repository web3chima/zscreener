import { pool } from '../config/database.js';

/**
 * ZSA (Zcash Shielded Assets) Protocol Parser
 * Handles extraction and parsing of ZSA asset data from shielded transactions
 */

export interface ZSAAsset {
  assetId: string;
  name: string;
  description: string;
  isShielded: boolean;
  metadata: Record<string, any>;
  createdAt?: Date;
}

export interface ZSAAssetData {
  assetId: string;
  assetType: string;
  amount?: string;
  metadata: Record<string, any>;
}

export class ZSAParser {
  /**
   * Parse ZSA protocol data from transaction proof data
   * ZSA assets are encoded in the proof data structure
   */
  parseZSAData(proofData: any): ZSAAssetData | null {
    try {
      if (!proofData || typeof proofData !== 'object') {
        return null;
      }

      // Check if this transaction contains ZSA asset data
      // ZSA assets are identified by specific markers in the proof structure
      if (!proofData.zsaMarker && !proofData.assetId) {
        return null;
      }

      const assetId = proofData.assetId || this.extractAssetId(proofData);
      if (!assetId) {
        return null;
      }

      // Extract asset type (NFT, fungible token, etc.)
      const assetType = proofData.assetType || 'unknown';

      // Extract amount if present (for fungible assets)
      const amount = proofData.amount || proofData.value;

      // Extract metadata from proof data
      const metadata = this.extractMetadata(proofData);

      return {
        assetId,
        assetType,
        amount: amount?.toString(),
        metadata,
      };
    } catch (error) {
      console.error('Error parsing ZSA data:', error);
      return null;
    }
  }

  /**
   * Extract asset ID from proof data structure
   */
  private extractAssetId(proofData: any): string | null {
    try {
      // ZSA asset IDs are typically 32-byte hashes
      if (proofData.publicInputs && Array.isArray(proofData.publicInputs)) {
        // Look for asset ID in public inputs
        const assetIdInput = proofData.publicInputs.find((input: any) => 
          input.type === 'assetId' || input.name === 'assetId'
        );
        if (assetIdInput && assetIdInput.value) {
          return assetIdInput.value;
        }
      }

      // Alternative: extract from proof bytes
      if (proofData.proofBytes && typeof proofData.proofBytes === 'string') {
        // Asset ID is typically at a specific offset in the proof
        // This is a simplified extraction - actual implementation would need
        // to follow ZSA specification exactly
        const assetIdMatch = proofData.proofBytes.match(/assetId:([a-fA-F0-9]{64})/);
        if (assetIdMatch) {
          return assetIdMatch[1];
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting asset ID:', error);
      return null;
    }
  }

  /**
   * Extract metadata from ZSA proof data
   */
  private extractMetadata(proofData: any): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      // Extract standard ZSA metadata fields
      if (proofData.name) metadata.name = proofData.name;
      if (proofData.symbol) metadata.symbol = proofData.symbol;
      if (proofData.decimals !== undefined) metadata.decimals = proofData.decimals;
      if (proofData.totalSupply) metadata.totalSupply = proofData.totalSupply;
      if (proofData.issuer) metadata.issuer = proofData.issuer;
      if (proofData.issuanceDate) metadata.issuanceDate = proofData.issuanceDate;

      // Extract NFT-specific metadata
      if (proofData.nftMetadata) {
        metadata.nft = proofData.nftMetadata;
      }

      // Extract custom metadata
      if (proofData.customMetadata) {
        metadata.custom = proofData.customMetadata;
      }

      // Extract any additional fields that might be present
      if (proofData.attributes) {
        metadata.attributes = proofData.attributes;
      }

      if (proofData.uri || proofData.tokenURI) {
        metadata.uri = proofData.uri || proofData.tokenURI;
      }

      if (proofData.image || proofData.imageUrl) {
        metadata.image = proofData.image || proofData.imageUrl;
      }

      if (proofData.description) {
        metadata.description = proofData.description;
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return metadata;
  }

  /**
   * Parse shielded asset information from transaction
   */
  parseShieldedAsset(transaction: any): ZSAAsset | null {
    try {
      const zsaData = this.parseZSAData(transaction.proof_data || transaction.proofData);
      
      if (!zsaData) {
        return null;
      }

      return {
        assetId: zsaData.assetId,
        name: zsaData.metadata.name || 'Unknown Asset',
        description: zsaData.metadata.description || '',
        isShielded: true, // ZSA assets in shielded transactions are always shielded
        metadata: zsaData.metadata,
      };
    } catch (error) {
      console.error('Error parsing shielded asset:', error);
      return null;
    }
  }

  /**
   * Store ZSA asset data in the database
   */
  async storeZSAAsset(asset: ZSAAsset): Promise<string | null> {
    try {
      // Check if asset already exists
      const existingAsset = await pool.query(
        'SELECT id FROM nft_data WHERE asset_id = $1',
        [asset.assetId]
      );

      if (existingAsset.rows.length > 0) {
        // Update existing asset
        await pool.query(
          `UPDATE nft_data 
           SET zsa_data = $1, metadata = $2, is_shielded = $3
           WHERE asset_id = $4`,
          [
            JSON.stringify({ name: asset.name, description: asset.description }),
            JSON.stringify(asset.metadata),
            asset.isShielded,
            asset.assetId,
          ]
        );
        return existingAsset.rows[0].id;
      }

      // Insert new asset
      const result = await pool.query(
        `INSERT INTO nft_data (asset_id, zsa_data, metadata, is_shielded)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          asset.assetId,
          JSON.stringify({ name: asset.name, description: asset.description }),
          JSON.stringify(asset.metadata),
          asset.isShielded,
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing ZSA asset:', error);
      return null;
    }
  }

  /**
   * Process a transaction and extract/store any ZSA assets
   */
  async processTransaction(transaction: any): Promise<string | null> {
    try {
      const asset = this.parseShieldedAsset(transaction);
      
      if (!asset) {
        return null;
      }

      return await this.storeZSAAsset(asset);
    } catch (error) {
      console.error('Error processing transaction for ZSA assets:', error);
      return null;
    }
  }

  /**
   * Get ZSA asset by ID
   */
  async getAssetById(assetId: string): Promise<ZSAAsset | null> {
    try {
      const result = await pool.query(
        `SELECT asset_id, zsa_data, metadata, is_shielded, created_at
         FROM nft_data
         WHERE asset_id = $1`,
        [assetId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const zsaData = row.zsa_data || {};

      return {
        assetId: row.asset_id,
        name: zsaData.name || 'Unknown Asset',
        description: zsaData.description || '',
        isShielded: row.is_shielded,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      };
    } catch (error) {
      console.error('Error getting asset by ID:', error);
      return null;
    }
  }

  /**
   * Get all ZSA assets with optional filtering
   */
  async getAssets(options: {
    isShielded?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ assets: ZSAAsset[]; total: number }> {
    try {
      const { isShielded, limit = 50, offset = 0 } = options;

      let query = `
        SELECT asset_id, zsa_data, metadata, is_shielded, created_at
        FROM nft_data
        WHERE zsa_data IS NOT NULL
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (isShielded !== undefined) {
        paramCount++;
        params.push(isShielded);
        query += ` AND is_shielded = $${paramCount}`;
      }

      query += ` ORDER BY created_at DESC`;

      // Add pagination
      paramCount++;
      params.push(limit);
      query += ` LIMIT $${paramCount}`;

      paramCount++;
      params.push(offset);
      query += ` OFFSET $${paramCount}`;

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM nft_data
        WHERE zsa_data IS NOT NULL
      `;
      const countParams: any[] = [];
      let countParamCount = 0;

      if (isShielded !== undefined) {
        countParamCount++;
        countParams.push(isShielded);
        countQuery += ` AND is_shielded = $${countParamCount}`;
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      const assets = result.rows.map(row => {
        const zsaData = row.zsa_data || {};
        return {
          assetId: row.asset_id,
          name: zsaData.name || 'Unknown Asset',
          description: zsaData.description || '',
          isShielded: row.is_shielded,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        };
      });

      return { assets, total };
    } catch (error) {
      console.error('Error getting assets:', error);
      return { assets: [], total: 0 };
    }
  }
}

// Export singleton instance
export const zsaParser = new ZSAParser();

