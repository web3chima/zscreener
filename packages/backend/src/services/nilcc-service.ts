import crypto from 'crypto';
import { getNillionClient, NillionClient } from './nillion-client.js';

export type ComputeOperation = 
  | 'sum'
  | 'average'
  | 'count'
  | 'max'
  | 'min'
  | 'aggregate'
  | 'filter'
  | 'custom';

export interface ComputeRequest {
  operation: ComputeOperation;
  inputs: ComputeInput[];
  parameters?: Record<string, any>;
  userId: string;
  customProgram?: string;
}

export interface ComputeInput {
  dataId?: string;
  value?: any;
  type: 'stored' | 'inline';
}

export interface ComputeJob {
  jobId: string;
  userId: string;
  operation: ComputeOperation;
  status: 'pending' | 'running' | 'completed' | 'failed';
  submittedAt: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export interface ComputeResult {
  jobId: string;
  result: any;
  computedAt: number;
  proofOfComputation?: string;
}

/**
 * Nilcc Service for privacy-preserving confidential compute
 * Executes computations on encrypted data without exposing raw data
 */
export class NilccService {
  private client: NillionClient;
  private jobs: Map<string, ComputeJob> = new Map();

  constructor(client?: NillionClient) {
    this.client = client || getNillionClient();
  }

  /**
   * Submit a computation job to Nilcc
   */
  async submitComputation(request: ComputeRequest): Promise<string> {
    const jobId = crypto.randomBytes(16).toString('hex');

    // Create job record
    const job: ComputeJob = {
      jobId,
      userId: request.userId,
      operation: request.operation,
      status: 'pending',
      submittedAt: Date.now(),
    };

    this.jobs.set(jobId, job);

    try {
      // Submit to Nilcc via Nillion client
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      const payload = {
        jobId,
        userId: request.userId,
        operation: request.operation,
        inputs: request.inputs,
        parameters: request.parameters || {},
        customProgram: request.customProgram,
      };

      await httpClient.post(`${config.nilccEndpoint}/compute/submit`, payload);

      // Update job status
      job.status = 'running';
      this.jobs.set(jobId, job);

      return jobId;
    } catch (error) {
      console.error('Nilcc submission failed:', error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.jobs.set(jobId, job);
      throw error;
    }
  }

  /**
   * Get the status of a computation job
   */
  async getJobStatus(jobId: string): Promise<ComputeJob | null> {
    // Check local cache first
    const localJob = this.jobs.get(jobId);
    if (localJob && (localJob.status === 'completed' || localJob.status === 'failed')) {
      return localJob;
    }

    try {
      // Query Nilcc for job status
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      const response = await httpClient.get(`${config.nilccEndpoint}/compute/status/${jobId}`);
      
      const job: ComputeJob = response.data;
      this.jobs.set(jobId, job);
      
      return job;
    } catch (error) {
      // Return local job if available
      return localJob || null;
    }
  }

  /**
   * Retrieve the result of a completed computation
   */
  async getComputeResult(jobId: string, userId: string): Promise<ComputeResult> {
    const job = await this.getJobStatus(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized: Job does not belong to user');
    }

    if (job.status === 'pending' || job.status === 'running') {
      throw new Error(`Job ${jobId} is still ${job.status}`);
    }

    if (job.status === 'failed') {
      throw new Error(`Job ${jobId} failed: ${job.error}`);
    }

    return {
      jobId,
      result: job.result,
      computedAt: job.completedAt!,
      proofOfComputation: this.generateProofOfComputation(job),
    };
  }

  /**
   * Generate a proof of computation (simplified version)
   */
  private generateProofOfComputation(job: ComputeJob): string {
    const proofData = {
      jobId: job.jobId,
      operation: job.operation,
      completedAt: job.completedAt,
      resultHash: crypto.createHash('sha256').update(JSON.stringify(job.result)).digest('hex'),
    };

    return Buffer.from(JSON.stringify(proofData)).toString('base64');
  }

  /**
   * Execute privacy-preserving analytics query
   * This is a convenience method for common analytics operations
   */
  async executeAnalyticsQuery(
    userId: string,
    queryType: 'transaction_volume' | 'shielded_pool_metrics' | 'user_statistics',
    dataIds: string[],
    parameters?: Record<string, any>
  ): Promise<string> {
    let operation: ComputeOperation;
    let inputs: ComputeInput[];

    switch (queryType) {
      case 'transaction_volume':
        operation = 'sum';
        inputs = dataIds.map(id => ({ dataId: id, type: 'stored' as const }));
        break;
      case 'shielded_pool_metrics':
        operation = 'aggregate';
        inputs = dataIds.map(id => ({ dataId: id, type: 'stored' as const }));
        break;
      case 'user_statistics':
        operation = 'aggregate';
        inputs = dataIds.map(id => ({ dataId: id, type: 'stored' as const }));
        break;
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }

    return this.submitComputation({
      operation,
      inputs,
      parameters,
      userId,
    });
  }

  /**
   * Wait for a job to complete (with timeout)
   */
  async waitForCompletion(jobId: string, timeoutMs: number = 30000): Promise<ComputeJob> {
    const startTime = Date.now();
    const pollInterval = 1000; // Poll every second

    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJobStatus(jobId);
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Cancel a running computation job
   */
  async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized: Job does not belong to user');
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error(`Job ${jobId} is already ${job.status}`);
    }

    try {
      const httpClient = this.client.getHttpClient();
      const config = this.client.getConfig();

      await httpClient.post(`${config.nilccEndpoint}/compute/cancel/${jobId}`, { userId });
    } catch (error) {
      console.warn('Nilcc cancellation failed:', error);
    }

    // Update local job status
    job.status = 'failed';
    job.completedAt = Date.now();
    job.error = 'Cancelled by user';
    this.jobs.set(jobId, job);
  }

  /**
   * List all jobs for a user
   */
  async listUserJobs(userId: string): Promise<ComputeJob[]> {
    const userJobs = Array.from(this.jobs.values()).filter(job => job.userId === userId);
    return userJobs;
  }

  /**
   * Clear completed jobs from cache
   */
  clearCompletedJobs(olderThanMs: number = 3600000): void {
    const cutoffTime = Date.now() - olderThanMs;
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt < cutoffTime
      ) {
        this.jobs.delete(jobId);
      }
    }
  }
}

// Singleton instance
let sharedService: NilccService | null = null;

/**
 * Get or create a shared Nilcc service instance
 */
export function getNilccService(): NilccService {
  if (!sharedService) {
    sharedService = new NilccService();
  }
  return sharedService;
}

/**
 * Create a new Nilcc service instance (not shared)
 */
export function createNilccService(client?: NillionClient): NilccService {
  return new NilccService(client);
}
