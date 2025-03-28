/**
 * Safe Service Implementation
 * Provides functionality related to Safe wallet management
 */
const { ethers } = require('ethers');
const { initializeSafeSDK } = require('../utils');
const { InvalidParameterError } = require('../exceptions');
const { SaferTransaction } = require('../transaction');

/**
 * Safe Service Implementation
 */
class SafeService {
  /**
   * Get Safe wallet information
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @returns {Promise<Object>} Safe information
   */
  
  async getSafeInfo(params) {
    const { safeAddress, rpcUrl, chainId } = params;
    
    // Initialize Safe SDK (read-only mode)
    const { safeSdk, provider } = await initializeSafeSDK({
      safeAddress,
      rpcUrl,
      chainId,
      readOnly: true
    });

    const result = await Promise.all([
      provider.getBalance(safeAddress),
      safeSdk.getOwners(),
      safeSdk.getThreshold(),
      safeSdk.getNonce(),
      provider.getNetwork(),
      safeSdk.getContractVersion()
    ])
    
    return {
      safeAddress,
      ethBalance: result[0].toString(),
      ethBalanceFormatted: ethers.utils.formatEther(result[0]),
      owners: result[1],
      threshold: result[2],
      nonce: result[3],
      chainId: result[4].chainId,
      version: result[5]
    };
  }

  /**
   * Create add owner transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {string} params.newOwnerAddress - New owner address
   * @param {number} [params.threshold] - New threshold (optional)
   * @returns {Promise<Object>} Transaction object
   */
  async createAddOwnerTx(params) {
    const { safeAddress, rpcUrl, chainId, newOwnerAddress, threshold: newThreshold } = params;
    
    // Initialize Safe SDK (read-only mode)
    const { safeSdk } = await initializeSafeSDK({
      safeAddress,
      rpcUrl,
      chainId,
      readOnly: true
    });
    
    // Validate new owner address
    if (!ethers.utils.isAddress(newOwnerAddress)) {
      throw new InvalidParameterError('newOwnerAddress', 'Invalid Ethereum address');
    }
    
    // Get current owners
    const currentOwners = await safeSdk.getOwners();
    
    // Check if owner already exists
    if (currentOwners.map(a => a.toLowerCase()).includes(newOwnerAddress.toLowerCase())) {
      throw new InvalidParameterError('newOwnerAddress', 'Address is already an owner');
    }
    
    // Get current threshold
    const currentThreshold = await safeSdk.getThreshold();
    
    // Determine new threshold
    let threshold = currentThreshold;
    if (newThreshold !== undefined) {
      threshold = newThreshold;
    }
    
    // Validate threshold
    const ownerCount = currentOwners.length + 1; // +1 for the new owner
    if (threshold < 1 || threshold > ownerCount) {
      throw new InvalidParameterError('threshold', `Threshold must be between 1 and ${ownerCount}`);
    }
    
    // Create transaction
    const safeTransaction = await safeSdk.createAddOwnerTx({
      ownerAddress: newOwnerAddress,
      threshold
    });
    
    // Calculate and set the safe transaction hash
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    safeTransaction.safeTxHash = safeTxHash;
    
    // Return transaction with metadata
    const result = {
      transaction: safeTransaction,
      metadata: {
        type: 'addOwner',
        safeAddress,
        newOwner: newOwnerAddress,
        oldThreshold: currentThreshold,
        newThreshold: threshold,
        owners: [...currentOwners, newOwnerAddress]
      },
      chainId
    };

    return SaferTransaction.fromSafeSDKTransaction(result);
  }

  /**
   * Create remove owner transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {string} params.ownerAddress - Owner address to remove
   * @param {number} [params.threshold] - New threshold (optional)
   * @returns {Promise<Object>} Transaction object
   */
  async createRemoveOwnerTx(params) {
    const { safeAddress, rpcUrl, chainId, ownerAddress, threshold: newThreshold } = params;
    
    // Initialize Safe SDK (read-only mode)
    const { safeSdk } = await initializeSafeSDK({
      safeAddress,
      rpcUrl,
      chainId,
      readOnly: true
    });
    
    // Validate owner address
    if (!ethers.utils.isAddress(ownerAddress)) {
      throw new InvalidParameterError('ownerAddress', 'Invalid Ethereum address');
    }
    
    // Get current owners
    const currentOwners = await safeSdk.getOwners();
    
    // Check if owner exists
    if (!currentOwners.map(a => a.toLowerCase()).includes(ownerAddress.toLowerCase())) {
      throw new InvalidParameterError('ownerAddress', 'Address is not an owner');
    }
    
    // Get current threshold
    const currentThreshold = await safeSdk.getThreshold();
    
    // Determine new threshold
    let threshold = newThreshold !== undefined ? newThreshold : currentThreshold;
    
    // If removing an owner would make threshold larger than owner count, adjust it
    const ownerCount = currentOwners.length - 1; // -1 for removing the owner
    if (ownerCount < threshold) {
      threshold = ownerCount;
    }
    
    // Validate threshold
    if (threshold < 1 || threshold > ownerCount) {
      throw new InvalidParameterError('threshold', `Threshold must be between 1 and ${ownerCount}`);
    }
    
    // Create transaction
    const safeTransaction = await safeSdk.createRemoveOwnerTx({
      ownerAddress,
      threshold
    });
    
    // Calculate and set the safe transaction hash
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    safeTransaction.safeTxHash = safeTxHash;
    
    // Return transaction with metadata
    const result = {
      transaction: safeTransaction,
      metadata: {
        type: 'removeOwner',
        safeAddress,
        removedOwner: ownerAddress,
        oldThreshold: currentThreshold,
        newThreshold: threshold,
        owners: currentOwners.filter(owner => owner.toLowerCase() !== ownerAddress.toLowerCase())
      },
      chainId
    };

    return SaferTransaction.fromSafeSDKTransaction(result);
  }

  /**
   * Create change threshold transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {number} params.threshold - New threshold
   * @returns {Promise<Object>} Transaction object
   */
  async createChangeThresholdTx(params) {
    const { safeAddress, rpcUrl, chainId, threshold } = params;

    if(!isNumber(threshold)) {
      throw new InvalidParameterError('threshold', 'Threshold must be a number');
    }
    
    // Initialize Safe SDK (read-only mode)
    const { safeSdk } = await initializeSafeSDK({
      safeAddress,
      rpcUrl,
      chainId,
      readOnly: true
    });
    
    // Get current owners
    const owners = await safeSdk.getOwners();
    
    // Get current threshold
    const currentThreshold = await safeSdk.getThreshold();
    
    // Validate threshold
    if (threshold < 1 || threshold > owners.length) {
      throw new InvalidParameterError('threshold', `Threshold must be between 1 and ${owners.length}`);
    }
    
    // Create transaction
    const safeTransaction = await safeSdk.createChangeThresholdTx(threshold);
    
    // Calculate and set the safe transaction hash
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    safeTransaction.safeTxHash = safeTxHash;
    
    // Return transaction with metadata
    const result = {
      transaction: safeTransaction,
      metadata: {
        type: 'changeThreshold',
        safeAddress,
        oldThreshold: currentThreshold,
        newThreshold: threshold,
        owners
      },
      chainId
    };

    return SaferTransaction.fromSafeSDKTransaction(result);
  }
}

// Export SafeService singleton
module.exports = new SafeService(); 