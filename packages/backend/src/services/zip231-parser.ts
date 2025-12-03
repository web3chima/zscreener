import { zcashRPCClient } from './zcash-rpc-client.js';

export interface Zip231Metadata {
  version: number;
  assets: {
    id: string;
    uri?: string;
    data?: any;
  }[];
}

export interface Zip231Memo {
  memoType: string;
  parsedContent: any;
  encoding: string;
}

export class Zip231Parser {
  /**
   * Parse memo data to check for ZIP-231 NFT metadata
   */
  parseMemo(memoHex: string): Zip231Metadata | null {
    try {
      const memoBuffer = Buffer.from(memoHex, 'hex');
      const memoString = memoBuffer.toString('utf8').replace(/\0/g, '');

      if (memoString.startsWith('zsa:') || memoString.includes('"zsa"')) {
        try {
          const data = JSON.parse(memoString);
          if (data.zsa && Array.isArray(data.zsa)) {
             return {
               version: 1,
               assets: data.zsa
             };
          }
        } catch (e) {
          // Not JSON
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a transaction involves ZSAs
   */
  checkForZSA(tx: any): boolean {
    if (tx.vShieldedOutput) {
       // logic to check for custom asset identifiers in outputs if available
       return false;
    }
    return false;
  }

  /**
   * Get memo for a specific asset using live RPC
   * It assumes assetId might be related to a txid or we need to find the minting tx.
   * Since there is no standard "getMintingTx(assetId)", we will look up the asset info
   * via getAssets (which we just updated) and if it has a txid, use it.
   * Or if 'assetId' IS the txid of issuance.
   */
  async getMemoForAsset(assetId: string): Promise<Zip231Memo | null> {
    try {
        // Attempt to treat assetId as a TXID first (common for issuance-based IDs)
        // or find the minting TX.
        // For now, without an indexer mapping AssetID -> MintTXID, we can only try
        // to see if we can get details.

        // If we can't find it, we return null, NOT mock data.

        // Example: if assetId is the txid
        try {
            const tx = await zcashRPCClient.getRawTransaction(assetId, true);
            if (tx && tx.vShieldedOutput) {
                 // Try to extract memo from the first shielded output
                 // This is a heuristic.
                 const firstOutput = tx.vShieldedOutput[0];
                 if (firstOutput && firstOutput.memo) {
                     const memoHex = firstOutput.memo;
                     const metadata = this.parseMemo(memoHex);
                     if (metadata) {
                         return {
                             memoType: 'application/json',
                             parsedContent: metadata,
                             encoding: 'utf-8'
                         };
                     }
                 }
            }
        } catch (e) {
            // assetId might not be a txid
        }

        return null;
    } catch (error) {
      console.error(`Failed to get memo for asset ${assetId}:`, error);
      return null;
    }
  }
}

export const zip231Parser = new Zip231Parser();
