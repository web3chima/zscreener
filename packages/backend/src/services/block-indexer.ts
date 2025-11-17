import { pool } from '../config/database.js';
import { zcashRPCClient, ZcashRPCError } from './zcash-rpc-client.js';
import { PoolClient } from 'pg';

interface ShieldedTransaction {
  txHash: string;
  blockHeight: number;
  timestamp: Date;
  shieldedInputs: number;
  shieldedOutputs: number;
  proofData: HaloProofData;
  memoData?: string;
}

interface HaloProofData {
  proofBytes?: string;
  publicInputs?: string[];
  proofType: 'spend' | 'output' | 'binding' | 'unknown';
  verificationKey?: string;
  spendProofs?: any[];
  outputProofs?: any[];
  bindingSig?: string;
}

interface IndexingProgress {
  lastIndexedBlock: number;
  currentBlock: number;
  totalBlocks: number;
  isIndexing: boolean;
}

export class BlockIndexerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BlockIndexerError';
  }
}

export class BlockIndexer {
  private isRunning: boolean = false;
  private lastIndexedBlock: number = 0;

  constructor() {}

  /**
   * Get the last indexed block height from database
   */
  private async getLastIndexedBlock(): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT MAX(block_height) as max_height FROM shielded_transactions'
      );
      return result.rows[0]?.max_height || 0;
    } catch (error: any) {
      console.error('Error getting last indexed block:', error);
      return 0;
    }
  }

  /**
   * Parse shielded transaction data from raw transaction
   */
  private parseShieldedTransaction(
    rawTx: any,
    blockHeight: number,
    blockTime: number
  ): ShieldedTransaction | null {
    const hasShieldedSpends = rawTx.vShieldedSpend && rawTx.vShieldedSpend.length > 0;
    const hasShieldedOutputs = rawTx.vShieldedOutput && rawTx.vShieldedOutput.length > 0;

    // Only process transactions with shielded components
    if (!hasShieldedSpends && !hasShieldedOutputs) {
      return null;
    }

    const proofData = this.extractHaloProofData(rawTx);

    return {
      txHash: rawTx.txid,
      blockHeight,
      timestamp: new Date(blockTime * 1000),
      shieldedInputs: rawTx.vShieldedSpend?.length || 0,
      shieldedOutputs: rawTx.vShieldedOutput?.length || 0,
      proofData,
      memoData: this.extractMemoData(rawTx),
    };
  }

  /**
   * Extract Halo ECC proof data from transaction
   */
  private extractHaloProofData(rawTx: any): HaloProofData {
    const proofData: HaloProofData = {
      proofType: 'unknown',
      spendProofs: [],
      outputProofs: [],
    };

    // Extract spend proofs
    if (rawTx.vShieldedSpend && rawTx.vShieldedSpend.length > 0) {
      proofData.proofType = 'spend';
      proofData.spendProofs = rawTx.vShieldedSpend.map((spend: any) => ({
        cv: spend.cv,
        anchor: spend.anchor,
        nullifier: spend.nullifier,
        rk: spend.rk,
        proof: spend.proof,
        spendAuthSig: spend.spendAuthSig,
      }));
    }

    // Extract output proofs
    if (rawTx.vShieldedOutput && rawTx.vShieldedOutput.length > 0) {
      if (proofData.proofType === 'spend') {
        proofData.proofType = 'binding';
      } else {
        proofData.proofType = 'output';
      }
      proofData.outputProofs = rawTx.vShieldedOutput.map((output: any) => ({
        cv: output.cv,
        cmu: output.cmu,
        ephemeralKey: output.ephemeralKey,
        encCiphertext: output.encCiphertext,
        outCiphertext: output.outCiphertext,
        proof: output.proof,
      }));
    }

    // Extract binding signature
    if (rawTx.bindingSig) {
      proofData.bindingSig = rawTx.bindingSig;
    }

    return proofData;
  }

  /**
   * Extract memo data from shielded outputs
   */
  private extractMemoData(rawTx: any): string | undefined {
    if (!rawTx.vShieldedOutput || rawTx.vShieldedOutput.length === 0) {
      return undefined;
    }

    // Collect all memo fields from outputs
    const memos = rawTx.vShieldedOutput
      .map((output: any) => output.memo)
      .filter((memo: any) => memo && memo !== '0000000000000000000000000000000000000000000000000000000000000000');

    return memos.length > 0 ? JSON.stringify(memos) : undefined;
  }

  /**
   * Store shielded transaction in database
   */
  private async storeTransaction(
    tx: ShieldedTransaction,
    client?: PoolClient
  ): Promise<void> {
    const dbClient = client || pool;

    try {
      await dbClient.query(
        `INSERT INTO shielded_transactions 
         (tx_hash, block_height, timestamp, shielded_inputs, shielded_outputs, proof_data, memo_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tx_hash) DO UPDATE SET
           block_height = EXCLUDED.block_height,
           timestamp = EXCLUDED.timestamp,
           shielded_inputs = EXCLUDED.shielded_inputs,
           shielded_outputs = EXCLUDED.shielded_outputs,
           proof_data = EXCLUDED.proof_data,
           memo_data = EXCLUDED.memo_data`,
        [
          tx.txHash,
          tx.blockHeight,
          tx.timestamp,
          tx.shieldedInputs,
          tx.shieldedOutputs,
          JSON.stringify(tx.proofData),
          tx.memoData,
        ]
      );
    } catch (error: any) {
      throw new BlockIndexerError(
        `Failed to store transaction ${tx.txHash}: ${error.message}`,
        'STORE_TRANSACTION_ERROR',
        { txHash: tx.txHash, error: error.message }
      );
    }
  }

  /**
   * Index a single block
   */
  async indexBlock(blockHeight: number): Promise<number> {
    try {
      // Get block hash
      const blockHash = await zcashRPCClient.getBlockHash(blockHeight);

      // Get block data
      const block = await zcashRPCClient.getBlock(blockHash, 1);

      let indexedCount = 0;

      // Process each transaction in the block
      for (const txid of block.tx) {
        try {
          // Get raw transaction
          const rawTx = await zcashRPCClient.getRawTransaction(txid, true);

          // Parse shielded transaction data
          const shieldedTx = this.parseShieldedTransaction(
            rawTx,
            blockHeight,
            block.time
          );

          // Store if it has shielded components
          if (shieldedTx) {
            await this.storeTransaction(shieldedTx);
            indexedCount++;
          }
        } catch (error: any) {
          // Log error but continue processing other transactions
          console.error(`Error processing transaction ${txid}:`, error.message);
        }
      }

      console.log(
        `Indexed block ${blockHeight}: ${indexedCount} shielded transactions`
      );

      return indexedCount;
    } catch (error: any) {
      if (error instanceof ZcashRPCError) {
        throw new BlockIndexerError(
          `Failed to index block ${blockHeight}: ${error.message}`,
          'INDEX_BLOCK_ERROR',
          { blockHeight, rpcError: error.code }
        );
      }
      throw error;
    }
  }

  /**
   * Index a range of blocks
   */
  async indexBlockRange(startHeight: number, endHeight: number): Promise<void> {
    if (startHeight > endHeight) {
      throw new BlockIndexerError(
        'Start height must be less than or equal to end height',
        'INVALID_BLOCK_RANGE',
        { startHeight, endHeight }
      );
    }

    console.log(`Indexing blocks from ${startHeight} to ${endHeight}`);

    for (let height = startHeight; height <= endHeight; height++) {
      try {
        await this.indexBlock(height);
      } catch (error: any) {
        console.error(`Failed to index block ${height}:`, error.message);
        // Continue with next block
      }
    }

    console.log(`Completed indexing blocks ${startHeight} to ${endHeight}`);
  }

  /**
   * Start continuous indexing from last indexed block
   */
  async startIndexing(pollInterval: number = 10000): Promise<void> {
    if (this.isRunning) {
      console.warn('Indexer is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting block indexer...');

    // Get last indexed block
    this.lastIndexedBlock = await this.getLastIndexedBlock();
    console.log(`Last indexed block: ${this.lastIndexedBlock}`);

    // Start indexing loop
    while (this.isRunning) {
      try {
        // Get current blockchain height
        const currentHeight = await zcashRPCClient.getBlockCount();

        // Index new blocks
        if (this.lastIndexedBlock < currentHeight) {
          const nextBlock = this.lastIndexedBlock + 1;
          await this.indexBlock(nextBlock);
          this.lastIndexedBlock = nextBlock;
        } else {
          // No new blocks, wait before checking again
          await this.sleep(pollInterval);
        }
      } catch (error: any) {
        console.error('Error in indexing loop:', error.message);
        // Wait before retrying
        await this.sleep(pollInterval);
      }
    }
  }

  /**
   * Stop the indexing process
   */
  stopIndexing(): void {
    console.log('Stopping block indexer...');
    this.isRunning = false;
  }

  /**
   * Get indexing progress
   */
  async getProgress(): Promise<IndexingProgress> {
    try {
      const lastIndexed = await this.getLastIndexedBlock();
      const currentHeight = await zcashRPCClient.getBlockCount();

      return {
        lastIndexedBlock: lastIndexed,
        currentBlock: currentHeight,
        totalBlocks: currentHeight,
        isIndexing: this.isRunning,
      };
    } catch (error: any) {
      throw new BlockIndexerError(
        'Failed to get indexing progress',
        'GET_PROGRESS_ERROR',
        { error: error.message }
      );
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const blockIndexer = new BlockIndexer();
