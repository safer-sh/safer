/**
 * SaferTransaction class
 * 
 * A unified transaction model that can be used across all modules.
 * Provides methods to convert between different transaction formats.
 */

/**
 * Transaction status
 * @enum {string}
 */
const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  EXECUTED: 'EXECUTED',
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

/**
 * Operation types
 * @enum {number}
 */
const OPERATION_TYPE = {
  CALL: 0,
  DELEGATE_CALL: 1
};

/**
 * SaferTransaction class
 * Unified transaction model for Safer
 */
class SaferTransaction {
  /**
   * Create a SaferTransaction
   * 
   * @param {Object} params - Transaction parameters
   * @param {string} params.hash - Transaction hash (safeTxHash)
   * @param {string} params.to - Target address
   * @param {string} params.value - Wei amount
   * @param {string} params.data - Transaction data (hex)
   * @param {number} params.operation - Operation type (0=call, 1=delegatecall)
   * @param {string} params.safeTxGas - Gas for safe transaction
   * @param {string} params.baseGas - Base gas
   * @param {string} params.gasPrice - Gas price
   * @param {string} params.gasToken - Gas token address
   * @param {string} params.refundReceiver - Refund receiver address
   * @param {number} params.nonce - Transaction nonce
   * @param {Object} params.signatures - Map of owner addresses to signatures
   * @param {string} params.createDate - Transaction creation date
   * @param {string} params.status - Transaction status
   * @param {Object} params.metadata - Additional transaction metadata
   * @param {string|number} params.chainId - Chain ID of the transaction
   * @param {string} [params.executionDate] - Transaction execution date
   * @param {boolean} [params.isExecuted] - Transaction execution status
   * @param {boolean} [params.isSuccessful] - Transaction success status
   */
  constructor({
    hash,
    to,
    value,
    data,
    operation = OPERATION_TYPE.CALL,
    safeTxGas = '0',
    baseGas = '0',
    gasPrice = '0',
    gasToken = '0x0000000000000000000000000000000000000000',
    refundReceiver = '0x0000000000000000000000000000000000000000',
    nonce,
    signatures = {},
    createDate = new Date().toISOString(),
    status = TRANSACTION_STATUS.PENDING,
    metadata = {},
    chainId,
    executionDate = null,
    isExecuted,
    isSuccessful
  }) {
    // Required fields
    if (!hash) throw new Error('Transaction hash is required');
    if (!to) throw new Error('Transaction to address is required');
    if (nonce === undefined) throw new Error('Transaction nonce is required');

    // Main transaction properties
    this.hash = hash;
    this.to = to;
    this.value = value || '0';
    this.data = data || '0x';
    this.operation = operation;
    this.safeTxGas = safeTxGas;
    this.baseGas = baseGas;
    this.gasPrice = gasPrice;
    this.gasToken = gasToken;
    this.refundReceiver = refundReceiver;
    this.nonce = nonce;
    this.signatures = signatures;
    this.createDate = createDate;
    this.status = status;
    this.metadata = metadata;
    this.chainId = chainId;

    // STS compatibility properties
    this.executionDate = executionDate;
    this.isExecuted = isExecuted !== undefined ? isExecuted : 
                     (status === TRANSACTION_STATUS.EXECUTED || 
                      status === TRANSACTION_STATUS.SUCCESSFUL || 
                      status === TRANSACTION_STATUS.FAILED);
    this.isSuccessful = isSuccessful !== undefined ? isSuccessful : 
                       (status === TRANSACTION_STATUS.SUCCESSFUL ? true : 
                        (status === TRANSACTION_STATUS.FAILED ? false : null));
  }

  /**
   * Get the Safe Transaction Hash
   * 
   * @returns {string} Safe Transaction Hash
   */
  get safeTxHash() {
    return this.hash;
  }

  /**
   * Get the submission date
   * 
   * @returns {string} Submission date
   */
  get submissionDate() {
    return this.createDate;
  }

  /**
   * Get the Safe address from metadata
   * 
   * @returns {string|null} Safe address
   */
  get safe() {
    return this.metadata.safeAddress || null;
  }

  /**
   * Convert signatures object to array format
   * 
   * @returns {Array} Array of confirmation objects
   */
  getConfirmationsArray() {
    return Object.entries(this.signatures).map(([owner, signature]) => ({
      owner,
      signature,
      signatureType: signature.startsWith('0x000000') ? 'ETH_SIGN' : 'EOA',
      submissionDate: this.createDate
    }));
  }

  /**
   * Convert signatures object to packed string format
   * 
   * @returns {string} Packed signatures string
   */
  getSignaturesString() {
    // Sort signatures by owner address
    const sortedOwners = Object.keys(this.signatures).sort();
    
    // Concatenate signatures
    let signatures = '0x';
    for (const owner of sortedOwners) {
      signatures += this.signatures[owner].slice(2); // Remove 0x prefix
    }
    
    return signatures;
  }

  /**
   * Add a signature to the transaction
   * 
   * @param {string} ownerAddress - Owner address
   * @param {string} signature - Signature string
   * @returns {SaferTransaction} Updated transaction with the new signature
   */
  addSignature(ownerAddress, signature) {
    // Create a new signatures object with the new signature
    const updatedSignatures = {
      ...this.signatures,
      [ownerAddress]: signature
    };
    
    // Create a new instance with updated signatures
    return new SaferTransaction({
      ...this,
      signatures: updatedSignatures
    });
  }
  
  /**
   * Check if the transaction has enough signatures to be executed
   * 
   * @param {Object} params - Parameters for signature check
   * @param {number} params.threshold - Required number of signatures
   * @param {string} [params.executorAddress] - Address of executor (optional)
   * @returns {boolean} True if the transaction has enough signatures
   */
  hasEnoughSignatures({ threshold, executorAddress }) {
    // Count current signatures
    const signatureCount = Object.keys(this.signatures).length;
    
    // If threshold is already met, return true
    if (signatureCount >= threshold) {
      return true;
    }
    
    // If no executor address provided, just check threshold
    if (!executorAddress) {
      return signatureCount >= threshold;
    }
    
    // If executor has already signed, their signature is already counted
    if (this.isSignedBy(executorAddress)) {
      return signatureCount >= threshold;
    }
    
    // Special case: If executor is an owner but hasn't signed yet,
    // their action of executing counts as a signature
    return signatureCount + 1 >= threshold;
  }
  
  /**
   * Check if an owner has signed the transaction
   * 
   * @param {string} ownerAddress - Owner address
   * @returns {boolean} True if the owner has signed
   */
  isSignedBy(ownerAddress) {
    // Normalize addresses for comparison
    const normalizedOwnerAddress = ownerAddress.toLowerCase();
    
    // Check if the owner is in the signatures
    return Object.keys(this.signatures)
      .map(addr => addr.toLowerCase())
      .includes(normalizedOwnerAddress);
  }
  
  /**
   * Get the list of signers
   * 
   * @returns {string[]} List of signer addresses
   */
  getSigners() {
    return Object.keys(this.signatures);
  }
  
  /**
   * Update transaction status
   * 
   * @param {string} newStatus - New transaction status
   * @returns {SaferTransaction} Updated transaction with new status
   */
  updateStatus(newStatus) {
    // Create a new instance with updated status
    return new SaferTransaction({
      ...this,
      status: newStatus
    });
  }

  /**
   * Create a SaferTransaction from Safe SDK transaction format
   * 
   * @param {Object} params - Parameters
   * @param {Object} params.transaction - Safe SDK transaction
   * @param {Object} params.metadata - Additional metadata
   * @param {string|number} params.chainId - Chain ID of the transaction
   * @returns {SaferTransaction} SaferTransaction instance
   */
  static fromSafeSDKTransaction({ transaction, metadata, chainId }) {
    return new SaferTransaction({
      hash: transaction.safeTxHash,
      to: transaction.data.to,
      value: transaction.data.value,
      data: transaction.data.data,
      operation: transaction.data.operation,
      safeTxGas: transaction.data.safeTxGas.toString(),
      baseGas: transaction.data.baseGas.toString(),
      gasPrice: transaction.data.gasPrice,
      gasToken: transaction.data.gasToken,
      refundReceiver: transaction.data.refundReceiver,
      nonce: transaction.data.nonce,
      signatures: {},
      status: TRANSACTION_STATUS.PENDING,
      metadata,
      chainId
    });
  }

  /**
   * Convert a SaferTransaction to a Safe SDK transaction
   * 
   * @returns {Object} Safe SDK transaction
   */
  toSafeSDKTransactionData() {
    return {
      to: this.to,
      value: this.value,
      data: this.data,
      operation: this.operation,
      safeTxGas: this.safeTxGas,
      baseGas: this.baseGas,
      gasPrice: this.gasPrice,
      gasToken: this.gasToken,
      refundReceiver: this.refundReceiver,
      nonce: this.nonce
    };
  }

  /**
   * Get the transaction hash (for executed transactions)
   * 
   * @returns {string|null} Transaction hash 
   */
  get transactionHash() {
    return this.metadata.transactionHash || null;
  }

  /**
   * Get the IPFS metadata if available
   * 
   * @returns {Object|null} IPFS metadata
   */
  get ipfsData() {
    return this.metadata.ipfs || null;
  }
}

module.exports = {
  SaferTransaction,
  TRANSACTION_STATUS,
  OPERATION_TYPE
}; 