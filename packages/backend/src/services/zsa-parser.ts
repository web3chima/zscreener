import { zcashRPCClient } from './zcash-rpc-client.js';

export interface ZSAMetadata {
  assetId: string;
  name?: string;
  symbol?: string;
  totalSupply?: string;
  isShielded: boolean;
  mintedAt: Date;
}

export class ZSAParser {
  /**
   * Get all assets using live Zcash Node RPC
   */
  async getAssets(options: {
    isShielded?: boolean;
    limit?: number;
    offset?: number
  }): Promise<{ assets: ZSAMetadata[]; total: number }> {
    try {
      // Attempt to call z_listassets if the node supports it (ZSA specific)
      // If the method does not exist (standard zcashd), it will throw an error
      // In that case, we return an empty list because there are no ZSAs on a standard chain.
      // We do NOT return fake data.

      const assets: ZSAMetadata[] = [];

      try {
        // 'z_listassets' is the hypothetical command for ZSA.
        // If specific branch is used, this works.
        // We handle the potential error if the node doesn't support it.
        const rpcAssets = await zcashRPCClient.call<any[]>('z_listassets', []);

        if (rpcAssets && Array.isArray(rpcAssets)) {
           // Transform RPC result to ZSAMetadata
           for (const raw of rpcAssets) {
             assets.push({
               assetId: raw.assetId || raw.id,
               name: raw.name,
               symbol: raw.symbol,
               totalSupply: raw.totalSupply,
               isShielded: true, // ZSA are shielded by definition usually
               mintedAt: new Date(raw.timestamp * 1000 || Date.now())
             });
           }
        }
      } catch (error: any) {
         // Log but don't crash if method not found.
         // It simply means no ZSA support on this node, so 0 assets.
         console.warn(`z_listassets RPC call failed (Node might not support ZSA): ${error.message}`);
      }

      let filtered = assets;
      if (options.isShielded !== undefined) {
        filtered = filtered.filter(a => a.isShielded === options.isShielded);
      }

      if (options.offset) {
        filtered = filtered.slice(options.offset);
      }
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }

      return {
        assets: filtered,
        total: assets.length
      };

    } catch (error) {
      console.error('Failed to get assets:', error);
      throw error;
    }
  }

  /**
   * Get asset by ID
   */
  async getAssetById(id: string): Promise<ZSAMetadata | null> {
    const { assets } = await this.getAssets({});
    return assets.find(a => a.assetId === id) || null;
  }
}

export const zsaParser = new ZSAParser();
