import { zcashRPCClient } from './zcash-rpc-client.js';
import chainConfig from '../config/chain.js';
import { pool } from '../config/database.js';

export class ChainSynchronizer {
  private isRunning: boolean = false;
  private currentHeight: number = 0;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('Starting chain synchronizer...');

    try {
      this.currentHeight = await this.getLastSyncedHeight();
      this.syncLoop();
    } catch (error) {
      console.error('Failed to start synchronizer:', error);
      this.isRunning = false;
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('Stopping chain synchronizer...');
  }

  private async syncLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const networkHeight = await zcashRPCClient.getBlockCount();

        if (this.currentHeight < networkHeight) {
          const targetHeight = Math.min(
            this.currentHeight + chainConfig.sync.batchSize,
            networkHeight
          );

          await this.processBlocks(this.currentHeight + 1, targetHeight);
          this.currentHeight = targetHeight;
        } else {
          await new Promise(resolve => setTimeout(resolve, chainConfig.sync.pollInterval));
        }
      } catch (error) {
        console.error('Error in sync loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processBlocks(startHeight: number, endHeight: number): Promise<void> {
    console.log(`Syncing blocks ${startHeight} to ${endHeight}`);

    for (let h = startHeight; h <= endHeight; h++) {
      try {
        const blockHash = await zcashRPCClient.getBlockHash(h);
        const block = await zcashRPCClient.getBlock(blockHash, 1);

        // Here we would extract headers, filter updates, etc.
        // For MVP, we just update the sync status
        await this.updateSyncStatus(h, blockHash, block.time);
      } catch (error) {
        console.error(`Failed to process block ${h}:`, error);
        throw error;
      }
    }
  }

  private async getLastSyncedHeight(): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT MAX(block_height) as height FROM shielded_transactions'
      );
      return result.rows[0]?.height || 0;
    } catch (error) {
      return 0;
    }
  }

  private async updateSyncStatus(height: number, hash: string, timestamp: number): Promise<void> {
    // In a real implementation, this would update a 'chain_tip' table or emit events.
    // Suppressing unused warning by logging
    if (process.env.DEBUG_SYNC) {
       console.log(`Synced ${height} (${hash}) at ${timestamp}`);
    }
  }
}

export const chainSynchronizer = new ChainSynchronizer();
