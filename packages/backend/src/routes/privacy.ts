import { Router, Request, Response } from 'express';
import { getEncryptionService } from '../services/encryption-service.js';
import { getNilDBService } from '../services/nil-db-service.js';
import { getNilccService } from '../services/nilcc-service.js';
import type { HaloProofData } from '../services/encryption-service.js';

const router = Router();

/**
 * POST /api/privacy/encrypt-proof
 * Encrypt a proof view for private storage
 */
router.post('/encrypt-proof', async (req: Request, res: Response) => {
  try {
    const { userId, proofData, metadata, storeInNilDB } = req.body;

    // Validate required fields
    if (!userId || !proofData) {
      return res.status(400).json({
        error: 'Missing required fields: userId and proofData are required',
      });
    }

    // Validate proof data structure
    if (!proofData.proofBytes || !proofData.publicInputs || !proofData.verificationKey) {
      return res.status(400).json({
        error: 'Invalid proof data structure',
      });
    }

    const encryptionService = getEncryptionService();

    // Verify proof integrity
    if (!encryptionService.verifyProofIntegrity(proofData)) {
      return res.status(400).json({
        error: 'Invalid proof data: integrity check failed',
      });
    }

    // Encrypt the proof
    const proofId = await encryptionService.encryptProofView({
      userId,
      proofData: proofData as HaloProofData,
      metadata,
      storeInNilDB: storeInNilDB || false,
    });

    // Generate proof hash for verification
    const proofHash = encryptionService.generateProofHash(proofData);

    res.status(201).json({
      success: true,
      proofId,
      proofHash,
      storedInNilDB: storeInNilDB || false,
      message: 'Proof encrypted successfully',
    });
  } catch (error) {
    console.error('Error encrypting proof:', error);
    res.status(500).json({
      error: 'Failed to encrypt proof',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/privacy/decrypt-proof/:id
 * Decrypt a proof view for an authorized user
 */
router.get('/decrypt-proof/:id', async (req: Request, res: Response) => {
  try {
    const { id: proofId } = req.params;
    const { userId, fromNilDB } = req.query;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId',
      });
    }

    const encryptionService = getEncryptionService();

    // Decrypt the proof
    const proofData = await encryptionService.decryptProofView({
      proofId,
      userId: userId as string,
      fromNilDB: fromNilDB === 'true',
    });

    // Generate proof hash for verification
    const proofHash = encryptionService.generateProofHash(proofData);

    res.status(200).json({
      success: true,
      proofId,
      proofData,
      proofHash,
      message: 'Proof decrypted successfully',
    });
  } catch (error) {
    console.error('Error decrypting proof:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Unauthorized access to proof',
        details: error.message,
      });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Proof not found',
        details: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to decrypt proof',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/privacy/nilcc-compute
 * Submit a confidential computation job to Nilcc
 */
router.post('/nilcc-compute', async (req: Request, res: Response) => {
  try {
    const { userId, operation, inputs, parameters, customProgram } = req.body;

    // Validate required fields
    if (!userId || !operation || !inputs) {
      return res.status(400).json({
        error: 'Missing required fields: userId, operation, and inputs are required',
      });
    }

    // Validate inputs structure
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({
        error: 'Invalid inputs: must be a non-empty array',
      });
    }

    const nilccService = getNilccService();

    // Submit computation
    const jobId = await nilccService.submitComputation({
      userId,
      operation,
      inputs,
      parameters,
      customProgram,
    });

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Computation job submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting Nilcc computation:', error);
    res.status(500).json({
      error: 'Failed to submit computation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/privacy/nilcc-compute/:jobId
 * Get the status and result of a computation job
 */
router.get('/nilcc-compute/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId',
      });
    }

    const nilccService = getNilccService();

    // Get job status
    const job = await nilccService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    // Verify user authorization
    if (job.userId !== userId) {
      return res.status(403).json({
        error: 'Unauthorized: Job does not belong to user',
      });
    }

    // If job is completed, return the result
    if (job.status === 'completed') {
      const result = await nilccService.getComputeResult(jobId, userId as string);
      return res.status(200).json({
        success: true,
        jobId,
        status: job.status,
        result: result.result,
        computedAt: result.computedAt,
        proofOfComputation: result.proofOfComputation,
      });
    }

    // Return job status
    res.status(200).json({
      success: true,
      jobId,
      status: job.status,
      submittedAt: job.submittedAt,
      completedAt: job.completedAt,
      error: job.error,
    });
  } catch (error) {
    console.error('Error getting Nilcc job status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/privacy/store-nildb
 * Store data in Nil DB with encryption
 */
router.post('/store-nildb', async (req: Request, res: Response) => {
  try {
    const { userId, data, metadata, encryptionKey } = req.body;

    // Validate required fields
    if (!userId || !data) {
      return res.status(400).json({
        error: 'Missing required fields: userId and data are required',
      });
    }

    const nilDBService = getNilDBService();

    // Store data in Nil DB
    const result = await nilDBService.storeData(data, {
      userId,
      encryptionKey,
      metadata,
    });

    res.status(201).json({
      success: true,
      dataId: result.dataId,
      userId: result.userId,
      storedAt: result.storedAt,
      encryptionKeyId: result.encryptionKeyId,
      message: 'Data stored in Nil DB successfully',
    });
  } catch (error) {
    console.error('Error storing data in Nil DB:', error);
    res.status(500).json({
      error: 'Failed to store data in Nil DB',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/privacy/retrieve-nildb/:dataId
 * Retrieve data from Nil DB
 */
router.get('/retrieve-nildb/:dataId', async (req: Request, res: Response) => {
  try {
    const { dataId } = req.params;
    const { userId, encryptionKey } = req.query;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId',
      });
    }

    const nilDBService = getNilDBService();

    // Retrieve data from Nil DB
    const data = await nilDBService.retrieveData({
      dataId,
      userId: userId as string,
      encryptionKey: encryptionKey as string | undefined,
    });

    res.status(200).json({
      success: true,
      dataId,
      data,
      message: 'Data retrieved from Nil DB successfully',
    });
  } catch (error) {
    console.error('Error retrieving data from Nil DB:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Data not found in Nil DB',
        details: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve data from Nil DB',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/privacy/list-proofs
 * List all encrypted proofs for a user
 */
router.get('/list-proofs', async (req: Request, res: Response) => {
  try {
    const { userId, includeNilDB } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId',
      });
    }

    const encryptionService = getEncryptionService();

    const proofIds = await encryptionService.listUserProofs(
      userId as string,
      includeNilDB === 'true'
    );

    res.status(200).json({
      success: true,
      userId,
      proofIds,
      count: proofIds.length,
    });
  } catch (error) {
    console.error('Error listing proofs:', error);
    res.status(500).json({
      error: 'Failed to list proofs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/privacy/proof/:id
 * Delete an encrypted proof
 */
router.delete('/proof/:id', async (req: Request, res: Response) => {
  try {
    const { id: proofId } = req.params;
    const { userId, fromNilDB } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId',
      });
    }

    const encryptionService = getEncryptionService();

    await encryptionService.deleteEncryptedProof(
      proofId,
      userId as string,
      fromNilDB === 'true'
    );

    res.status(200).json({
      success: true,
      message: 'Proof deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting proof:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Unauthorized: Cannot delete proof',
        details: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to delete proof',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/privacy/stats
 * Get encryption statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const encryptionService = getEncryptionService();
    const stats = encryptionService.getEncryptionStats();

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting encryption stats:', error);
    res.status(500).json({
      error: 'Failed to get encryption stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/privacy/analytics-query
 * Execute a privacy-preserving analytics query
 */
router.post('/analytics-query', async (req: Request, res: Response) => {
  try {
    const { userId, queryType, dataIds, parameters } = req.body;

    if (!userId || !queryType || !dataIds) {
      return res.status(400).json({
        error: 'Missing required fields: userId, queryType, and dataIds are required',
      });
    }

    if (!Array.isArray(dataIds)) {
      return res.status(400).json({
        error: 'Invalid dataIds: must be an array',
      });
    }

    const nilccService = getNilccService();

    const jobId = await nilccService.executeAnalyticsQuery(
      userId,
      queryType,
      dataIds,
      parameters
    );

    res.status(202).json({
      success: true,
      jobId,
      queryType,
      status: 'pending',
      message: 'Analytics query submitted successfully',
    });
  } catch (error) {
    console.error('Error executing analytics query:', error);
    res.status(500).json({
      error: 'Failed to execute analytics query',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
