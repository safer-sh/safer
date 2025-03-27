/**
 * Sign Service Implementation
 * Handles business logic related to transaction signing
 */
const { ethers } = require('ethers');
const { SigningError } = require('../exceptions');
const { initializeSafeSDK } = require('../utils');
const { PrivateKeySigner, SignerInterface } = require('../signers');
const { SaferTransaction } = require('../transaction');

/**
 * Sign Service Implementation
 */
class SignService {
  constructor() {
    // Registry of signer implementations
    this.signerRegistry = {
      // Register built-in signers
      'privkey': PrivateKeySigner
    };
  }
  
  /**
   * Register a new signer implementation
   * 
   * @param {string} type - Signer type identifier
   * @param {typeof SignerInterface} implementation - Signer implementation class
   */
  registerSigner(type, implementation) {
    if (!(implementation.prototype instanceof SignerInterface)) {
      throw new Error('Invalid signer implementation');
    }
    this.signerRegistry[type] = implementation;
  }
  
  /**
   * Sign transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe wallet address
   * @param {string} params.rpcUrl - RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {SaferTransaction} params.transaction - SaferTransaction object
   * @param {ethers.Signer} params.signer - Ethereum signer
   * @returns {Promise<Object>} Signature object
   * @throws {SigningError} If signing fails
   */
  async signTransaction(params) {
    const { 
      safeAddress, 
      rpcUrl, 
      chainId, 
      transaction, 
      signer 
    } = params;
    
    try {
      // Get signer address
      const signerAddress = await signer.getAddress();
      
      // Create a provider
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Make sure the signer has access to a provider for network operations
      let connectedSigner = signer;
      
      // If it's a custom signer with getSigner method (like LedgerSigner),
      // use that to get a fully configured signer
      if (typeof signer.getSigner === 'function') {
        connectedSigner = await signer.getSigner(provider);
      }
      
      // Initialize Safe SDK with signer
      const { safeSdk } = await initializeSafeSDK({
        safeAddress,
        signer: connectedSigner,
        rpcUrl,
        chainId,
        forceNew: true // Force a new instance to ensure updated signer is used
      });
      
      // Get list of current owners
      const owners = await safeSdk.getOwners();
      
      // Verify if signer is an owner
      const isOwner = owners.some(
        owner => owner.toLowerCase() === signerAddress.toLowerCase()
      );
      
      if (!isOwner) {
        throw new Error(`Signer ${signerAddress} is not an owner of this Safe`);
      }
      
      // Create Safe transaction object from transaction data
      const safeTransactionData = transaction.toSafeSDKTransactionData();
      
      const safeTransaction = await safeSdk.createTransaction({ safeTransactionData });
      
      // Check if transaction has already been signed by this owner
      if (transaction.signatures && transaction.signatures[signerAddress]) {
        throw new SigningError(
          'Transaction has already been signed by this owner',
          { signer: signerAddress }
        );
      }
      
      // Sign transaction
      const txHash = await safeSdk.getTransactionHash(safeTransaction);
      const signature = await safeSdk.signTransactionHash(txHash);
      
      // Add this signature to the transaction
      const signatureTimestamp = new Date().toISOString();
      const updatedSignatures = {
        ...transaction.signatures,
        [signerAddress]: signature
      };
      
      // Create a new SaferTransaction with updated signatures
      const updatedTransaction = new SaferTransaction({
        ...transaction,
        signatures: updatedSignatures,
        metadata: {
          ...transaction.metadata,
          lastSignedBy: signerAddress,
          lastSignedAt: signatureTimestamp
        },
        chainId
      });
      
      // Return both the signature info and updated transaction
      return {
        signature: {
          hash: txHash,
          signer: signerAddress,
          signature: signature,
          timestamp: signatureTimestamp
        },
        transaction: updatedTransaction
      };
    } catch (error) {
      if (error instanceof SigningError) {
        throw error;
      }
      throw new SigningError(
        `Failed to sign transaction: ${error.message}`,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Check if all required signatures are present
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe wallet address
   * @param {string} params.rpcUrl - RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {SaferTransaction} params.transaction - SaferTransaction object
   * @returns {Promise<Object>} Signature status
   */
  async checkSignatureStatus(params) {
    const { 
      safeAddress, 
      rpcUrl, 
      chainId, 
      transaction
    } = params;
    
    try {
      // Initialize Safe SDK in read-only mode
      const { safeSdk } = await initializeSafeSDK({
        safeAddress,
        rpcUrl,
        chainId,
        readOnly: true
      });
      
      // Get Safe's signature threshold
      const threshold = await safeSdk.getThreshold();
      
      // Count current signatures
      const signatures = transaction.signatures || {};
      const signatureCount = Object.keys(signatures).length;
      
      // Get list of owners
      const owners = await safeSdk.getOwners();
      
      // Create list of owners who haven't signed yet
      const signedAddresses = Object.keys(signatures).map(addr => addr.toLowerCase());
      const pendingOwners = owners.filter(
        owner => !signedAddresses.includes(owner.toLowerCase())
      );
      
      // Get signature timestamps
      const signatureTimestamps = {};
      for (const [address] of Object.entries(signatures)) {
        signatureTimestamps[address] = transaction.metadata?.signatures?.[address]?.timestamp || null;
      }
      
      return {
        hash: transaction.hash,
        signatureCount,
        threshold,
        isExecutable: signatureCount >= threshold,
        pendingOwners,
        signedOwners: signedAddresses,
        signatureTimestamps,
        lastSignedBy: transaction.metadata?.lastSignedBy,
        lastSignedAt: transaction.metadata?.lastSignedAt
      };
    } catch (error) {
      throw new Error(`Failed to check signature status: ${error.message}`);
    }
  }
}

// Export SignService singleton
module.exports = new SignService(); 