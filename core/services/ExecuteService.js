/**
 * Execute Service Implementation
 * Handles business logic related to transaction execution, including transaction execution and gas estimation
 */
const { ethers } = require('ethers');
const { 
  initializeSafeSDK, 
  convertSignatures 
} = require('../utils');
const { 
  InsufficientSignaturesError,
  TransactionExecutionError
} = require('../exceptions');
const { SaferTransaction, TRANSACTION_STATUS } = require('../transaction');

// Import EthSafeSignature from Safe SDK
const { EthSafeSignature } = require('@safe-global/protocol-kit/dist/src/utils/signatures/SafeSignature');

/**
 * Execute Service Implementation
 */
class ExecuteService {
  /**
   * Execute transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {SaferTransaction} params.transaction - SaferTransaction object
   * @param {Object} [params.gasParams] - Optional gas parameters
   * @param {string} [params.gasParams.gasLimit] - Gas limit
   * @param {string} [params.gasParams.maxFeePerGas] - Maximum gas fee
   * @param {string} [params.gasParams.maxPriorityFeePerGas] - Maximum priority gas fee
   * @param {ethers.Signer} params.signer - Ethereum signer
   * @returns {Promise<SaferTransaction>} Updated transaction with execution results
   * @throws {InsufficientSignaturesError} If signatures are insufficient
   * @throws {TransactionExecutionError} If transaction execution fails
   */
  async executeTransaction(params) {
    const { 
      safeAddress,
      rpcUrl,
      chainId,
      transaction,
      gasParams,
      signer
    } = params;
    
    // Define updatedTransaction at function scope to fix the reference error
    let updatedTransaction = null;
    
    try {
      // Create a provider
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Make sure the signer has access to a provider for network operations
      let connectedSigner = signer;
      
      // If it's a custom signer with getSigner method (like LedgerSigner),
      // use that to get a fully configured signer
      if (typeof signer.getSigner === 'function') {
        connectedSigner = await signer.getSigner(provider);
      }
      
      // Initialize Safe SDK
      const { safeSdk } = await initializeSafeSDK({
        safeAddress,
        signer: connectedSigner,
        rpcUrl,
        chainId,
        forceNew: true
      });
      
      // Get signer address
      const executorAddress = await signer.getAddress();
      
      // Get Safe owners
      const owners = await safeSdk.getOwners();
      
      // Check if executor is an owner
      const isExecutorOwner = owners.some(
        owner => owner.toLowerCase() === executorAddress.toLowerCase()
      );
      
      // Get threshold
      const threshold = await safeSdk.getThreshold();
      
      // Check if transaction has enough signatures to be executed
      // Use the SaferTransaction's hasEnoughSignatures method
      const hasEnoughSigs = transaction.hasEnoughSignatures({
        threshold,
        executorAddress: isExecutorOwner ? executorAddress : null
      });
      
      if (!hasEnoughSigs) {
        // Get current signature count
        const signatureCount = Object.keys(transaction.signatures || {}).length;
        
        // Determine required signatures
        const requiredSignatures = isExecutorOwner ? threshold - 1 : threshold;
        
        const errorMessage = isExecutorOwner
          ? `Insufficient signatures to execute: ${signatureCount}/${requiredSignatures} (executor counts as a signature)`
          : `Insufficient signatures to execute: ${signatureCount}/${threshold}`;
        
        throw new InsufficientSignaturesError(
          errorMessage,
          signatureCount,
          requiredSignatures,
          { executorIsOwner: isExecutorOwner }
        );
      }
      
      try {
        // Convert signatures to format expected by SDK
        const convertedSignatures = convertSignatures(transaction.signatures || {});
        
        // Create Safe transaction from data
        const safeTransactionData = transaction.toSafeSDKTransactionData();
        
        // Build transaction object
        const safeTransaction = await safeSdk.createTransaction({ safeTransactionData });
        
        // Add signatures
        for (const [address, signature] of Object.entries(convertedSignatures)) {
          // Create EthSafeSignature instance
          const safeSignature = new EthSafeSignature(address, signature);
          
          // Add signature to transaction
          await safeTransaction.addSignature(safeSignature);
        }
        
        // Prepare transaction options
        const options = {};
        
        // Handle gas parameters
        if (gasParams) {
          // Set gas limit if provided
          if (gasParams.gasLimit) {
            options.gasLimit = gasParams.gasLimit;
          }
          
          // Set gas price if provided (convert from gwei to wei)
          if (gasParams.gasPrice) {
            options.gasPrice = ethers.utils.parseUnits(gasParams.gasPrice.toString(), 'gwei');
          }
        }
        
        // Execute transaction
        const executeTxResponse = await safeSdk.executeTransaction(safeTransaction, options);
        
        // Get transaction hash - this is the Safe transaction hash
        const safeTxHash = executeTxResponse.hash;
        
        // Create updated transaction result with execution details
        updatedTransaction = new SaferTransaction({
          ...transaction,
          status: TRANSACTION_STATUS.SUBMITTED,
          metadata: {
            ...transaction.metadata,
            submittedTxHash: safeTxHash,
            executor: executorAddress,
            submissionDate: new Date().toISOString()
          }
        });
        
        // Check if transactionResponse exists
        if (executeTxResponse.transactionResponse) {
          try {
            // Get the blockchain transaction hash - this is the actual Ethereum transaction
            const ethTxHash = executeTxResponse.transactionResponse.hash;
            
            // Wait for transaction receipt with timeout to prevent hanging indefinitely
            const txReceipt = await Promise.race([
              executeTxResponse.transactionResponse.wait(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000) // 2 minute timeout
              )
            ]);
            
            // Now that we have confirmation, update with final status
            updatedTransaction = new SaferTransaction({
              ...transaction,
              status: txReceipt.status === 1 ? TRANSACTION_STATUS.SUCCESSFUL : TRANSACTION_STATUS.FAILED,
              executionDate: new Date().toISOString(),
              transactionHash: ethTxHash,
              isExecuted: true,
              isSuccessful: txReceipt.status === 1,
              metadata: {
                ...transaction.metadata,
                executor: executorAddress,
                blockNumber: txReceipt.blockNumber,
                gasUsed: txReceipt.gasUsed.toString(),
                transactionHash: ethTxHash
              },
              chainId
            });
          } catch (confirmError) {
            // If there's an error waiting for confirmation, don't mark as executed
            // Instead mark as SUBMITTED since the transaction was sent but not confirmed
            updatedTransaction = new SaferTransaction({
              ...transaction,
              status: TRANSACTION_STATUS.SUBMITTED,
              metadata: {
                ...transaction.metadata,
                submittedTxHash: executeTxResponse.transactionResponse.hash,
                executor: executorAddress,
                submissionDate: new Date().toISOString(),
                confirmationError: confirmError.message || 'Unknown error during confirmation'
              },
              chainId
            });
            throw confirmError;
          }
        } else {
          // No transaction response (which should be very rare)
          // In this case, we can't be sure if the transaction was executed
          // Mark as pending with a warning in metadata
          updatedTransaction = new SaferTransaction({
            ...transaction,
            status: TRANSACTION_STATUS.PENDING, // Change from EXECUTED to PENDING
            metadata: {
              ...transaction.metadata,
              executor: executorAddress,
              warning: 'Transaction execution returned no receipt. Status uncertain.'
            },
            chainId
          });
        }
        
        return updatedTransaction;
      } catch (error) {
        // Rethrow as TransactionExecutionError with complete error information
        
        // Create updated transaction result showing error
        updatedTransaction = new SaferTransaction({
          ...transaction,
          status: TRANSACTION_STATUS.PENDING, // Keep as pending when execution fails
          metadata: {
            ...transaction.metadata,
            errorMessage: error.message || 'Unknown execution error',
            errorCode: error.code,
            errorTime: new Date().toISOString()
            },
          chainId
        });
        
        const errorDetails = {
          originalError: error.toString(),
          code: error.code,
          data: error.data
        };
        
        // For InsufficientSignaturesError, add the signatures information
        if (error.code === 'INSUFFICIENT_SIGNATURES') {
          errorDetails.current = error.current;
          errorDetails.required = error.required;
        }
        
        const txExecError = new TransactionExecutionError(
          error.message || 'Unknown execution error', 
          errorDetails
        );
        
        // Copy the error code property for direct access
        if (error.code) {
          txExecError.code = error.code;
        }
        
        // For InsufficientSignaturesError, also copy the current/required properties
        if (error.current !== undefined) {
          txExecError.current = error.current;
        }
        if (error.required !== undefined) {
          txExecError.required = error.required;
        }
        
        // Include the updated transaction in the error object
        txExecError.transaction = updatedTransaction;
        
        throw txExecError;
      }
    } catch (error) {
      // Rethrow as TransactionExecutionError with complete error information
      
      // If the error already has an updated transaction, use it
      if (error.transaction) {
        return error.transaction;
      }
      
      // Otherwise create a new failed transaction
      updatedTransaction = new SaferTransaction({
        ...transaction,
        status: TRANSACTION_STATUS.PENDING, // Keep as pending, not failed
        metadata: {
          ...transaction.metadata,
          outerErrorMessage: error.message || 'Unknown outer execution error',
          outerErrorCode: error.code,
          outerErrorTime: new Date().toISOString(),
          ledgerError: error.message.includes('Ledger') || error.message.includes('USB')
        },
        chainId
      });
      
      const errorDetails = {
        originalError: error.toString(),
        code: error.code,
        data: error.data
      };
      
      // For InsufficientSignaturesError, add the signatures information
      if (error.code === 'INSUFFICIENT_SIGNATURES') {
        errorDetails.current = error.current;
        errorDetails.required = error.required;
      }
      
      const txExecError = new TransactionExecutionError(
        error.message || 'Unknown execution error',
        errorDetails
      );
      
      // Copy the error code property for direct access
      if (error.code) {
        txExecError.code = error.code;
      }
      
      // For InsufficientSignaturesError, also copy the current/required properties
      if (error.current !== undefined) {
        txExecError.current = error.current;
      }
      if (error.required !== undefined) {
        txExecError.required = error.required;
      }
      
      // Include the updated transaction in the error object
      txExecError.transaction = updatedTransaction;
      
      throw txExecError;
    }
  }
}

// Export ExecuteService singleton
module.exports = new ExecuteService(); 