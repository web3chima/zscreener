import { pool } from '../config/database.js';

/**
 * ZIP 231 Memo Field Parser
 * Handles parsing of Zcash memo fields according to ZIP 231 specification
 * Supports text, binary, and NFT metadata extraction
 */

export interface ZIP231Memo {
  memoData: string;
  memoType: 'text' | 'nft' | 'arbitrary' | 'empty';
  parsedContent: any;
  encoding?: string;
}

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  external_url?: string;
  animation_url?: string;
  [key: string]: any;
}

export class ZIP231Parser {
  // ZIP 231 memo field constants
  private readonly MEMO_SIZE = 512; // bytes
  
  // Memo type identifiers (first byte)
  private readonly MEMO_TYPE_EMPTY = 0xF6;

  /**
   * Parse memo field data according to ZIP 231 specification
   */
  parseMemo(memoData: string | Buffer | null): ZIP231Memo | null {
    try {
      if (!memoData) {
        return {
          memoData: '',
          memoType: 'empty',
          parsedContent: null,
        };
      }

      // Convert to buffer if string
      let buffer: Buffer;
      if (typeof memoData === 'string') {
        // Handle hex-encoded memo data
        if (memoData.startsWith('0x')) {
          buffer = Buffer.from(memoData.slice(2), 'hex');
        } else {
          // Try to parse as base64 or treat as raw string
          try {
            buffer = Buffer.from(memoData, 'base64');
          } catch {
            buffer = Buffer.from(memoData, 'utf-8');
          }
        }
      } else {
        buffer = memoData;
      }

      // Check if memo is empty (all zeros or empty buffer)
      if (buffer.length === 0 || this.isEmptyMemo(buffer)) {
        return {
          memoData: '',
          memoType: 'empty',
          parsedContent: null,
        };
      }

      // Determine memo type from first byte
      const typeIndicator = buffer[0];
      
      if (typeIndicator === this.MEMO_TYPE_EMPTY) {
        return {
          memoData: buffer.toString('hex'),
          memoType: 'empty',
          parsedContent: null,
        };
      }

      // Try to parse as text memo
      if (this.isTextMemo(buffer)) {
        return this.parseTextMemo(buffer);
      }

      // Try to parse as NFT metadata
      const nftMemo = this.parseNFTMemo(buffer);
      if (nftMemo) {
        return nftMemo;
      }

      // Default to arbitrary binary data
      return {
        memoData: buffer.toString('hex'),
        memoType: 'arbitrary',
        parsedContent: {
          hex: buffer.toString('hex'),
          base64: buffer.toString('base64'),
          length: buffer.length,
        },
      };
    } catch (error) {
      console.error('Error parsing memo:', error);
      return null;
    }
  }

  /**
   * Check if memo is empty (all zeros or padding)
   */
  private isEmptyMemo(buffer: Buffer): boolean {
    return buffer.every(byte => byte === 0 || byte === this.MEMO_TYPE_EMPTY);
  }

  /**
   * Check if memo contains valid UTF-8 text
   */
  private isTextMemo(buffer: Buffer): boolean {
    try {
      // Remove null padding
      const trimmed = this.trimNullBytes(buffer);
      
      // Try to decode as UTF-8
      const text = trimmed.toString('utf-8');
      
      // Check if it's valid UTF-8 and contains printable characters
      // Valid text should not have too many control characters
      const controlChars = text.split('').filter(c => {
        const code = c.charCodeAt(0);
        return code < 32 && code !== 10 && code !== 13 && code !== 9;
      }).length;
      
      return controlChars < text.length * 0.1; // Less than 10% control chars
    } catch {
      return false;
    }
  }

  /**
   * Parse text memo
   */
  private parseTextMemo(buffer: Buffer): ZIP231Memo {
    const trimmed = this.trimNullBytes(buffer);
    const text = trimmed.toString('utf-8');

    return {
      memoData: buffer.toString('hex'),
      memoType: 'text',
      parsedContent: {
        text: text.trim(),
        length: text.length,
      },
      encoding: 'utf-8',
    };
  }

  /**
   * Parse NFT metadata from memo field
   * NFT metadata is typically JSON-encoded
   */
  private parseNFTMemo(buffer: Buffer): ZIP231Memo | null {
    try {
      const trimmed = this.trimNullBytes(buffer);
      const text = trimmed.toString('utf-8');

      // Try to parse as JSON
      let metadata: any;
      try {
        metadata = JSON.parse(text);
      } catch {
        // Not valid JSON, check if it looks like NFT metadata
        if (!this.looksLikeNFTMetadata(text)) {
          return null;
        }
        // Try to extract metadata from text format
        metadata = this.extractNFTMetadataFromText(text);
      }

      // Validate that it looks like NFT metadata
      if (!this.isValidNFTMetadata(metadata)) {
        return null;
      }

      return {
        memoData: buffer.toString('hex'),
        memoType: 'nft',
        parsedContent: metadata,
        encoding: 'utf-8',
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if text looks like NFT metadata
   */
  private looksLikeNFTMetadata(text: string): boolean {
    const nftKeywords = ['name', 'description', 'image', 'attributes', 'token', 'nft', 'metadata'];
    const lowerText = text.toLowerCase();
    return nftKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Extract NFT metadata from text format
   */
  private extractNFTMetadataFromText(text: string): NFTMetadata {
    const metadata: NFTMetadata = {};
    
    // Try to extract key-value pairs
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key.toLowerCase()] = value.trim();
      }
    }

    return metadata;
  }

  /**
   * Validate NFT metadata structure
   */
  private isValidNFTMetadata(metadata: any): boolean {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    // Check for common NFT metadata fields
    const hasNFTFields = 
      'name' in metadata ||
      'description' in metadata ||
      'image' in metadata ||
      'attributes' in metadata ||
      'tokenId' in metadata ||
      'token_id' in metadata;

    return hasNFTFields;
  }

  /**
   * Remove null byte padding from buffer
   */
  private trimNullBytes(buffer: Buffer): Buffer {
    let end = buffer.length;
    while (end > 0 && buffer[end - 1] === 0) {
      end--;
    }
    return buffer.slice(0, end);
  }

  /**
   * Extract NFT metadata from memo and store in database
   */
  async extractAndStoreNFTMetadata(
    assetId: string,
    memoData: string | Buffer | null
  ): Promise<boolean> {
    try {
      const memo = this.parseMemo(memoData);
      
      if (!memo || memo.memoType !== 'nft') {
        return false;
      }

      // Update nft_data table with ZIP 231 memo data
      await pool.query(
        `UPDATE nft_data 
         SET zip231_memo = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2
         WHERE asset_id = $3`,
        [
          memo.memoData,
          JSON.stringify(memo.parsedContent),
          assetId,
        ]
      );

      return true;
    } catch (error) {
      console.error('Error extracting and storing NFT metadata:', error);
      return false;
    }
  }

  /**
   * Process transaction memo field and extract NFT data
   */
  async processTransactionMemo(transaction: any): Promise<ZIP231Memo | null> {
    try {
      const memoData = transaction.memo_data || transaction.memoData;
      
      if (!memoData) {
        return null;
      }

      const memo = this.parseMemo(memoData);
      
      // If this is NFT metadata and we have an asset ID, store it
      if (memo && memo.memoType === 'nft' && transaction.asset_id) {
        await this.extractAndStoreNFTMetadata(transaction.asset_id, memoData);
      }

      return memo;
    } catch (error) {
      console.error('Error processing transaction memo:', error);
      return null;
    }
  }

  /**
   * Get memo data for a specific asset
   */
  async getMemoForAsset(assetId: string): Promise<ZIP231Memo | null> {
    try {
      const result = await pool.query(
        'SELECT zip231_memo FROM nft_data WHERE asset_id = $1',
        [assetId]
      );

      if (result.rows.length === 0 || !result.rows[0].zip231_memo) {
        return null;
      }

      return this.parseMemo(result.rows[0].zip231_memo);
    } catch (error) {
      console.error('Error getting memo for asset:', error);
      return null;
    }
  }

  /**
   * Parse memo from transaction and return structured data
   */
  parseTransactionMemo(transaction: any): ZIP231Memo | null {
    const memoData = transaction.memo_data || transaction.memoData;
    return this.parseMemo(memoData);
  }

  /**
   * Create a text memo (for testing or utility purposes)
   */
  createTextMemo(text: string): Buffer {
    const buffer = Buffer.alloc(this.MEMO_SIZE);
    const textBuffer = Buffer.from(text, 'utf-8');
    
    // Copy text to memo buffer
    textBuffer.copy(buffer, 0, 0, Math.min(textBuffer.length, this.MEMO_SIZE));
    
    return buffer;
  }

  /**
   * Create an NFT metadata memo
   */
  createNFTMemo(metadata: NFTMetadata): Buffer {
    const json = JSON.stringify(metadata);
    const buffer = Buffer.alloc(this.MEMO_SIZE);
    const jsonBuffer = Buffer.from(json, 'utf-8');
    
    // Copy JSON to memo buffer
    jsonBuffer.copy(buffer, 0, 0, Math.min(jsonBuffer.length, this.MEMO_SIZE));
    
    return buffer;
  }
}

// Export singleton instance
export const zip231Parser = new ZIP231Parser();

