/**
 * Signature and execution tools
 * Implements transaction signing and execution functionality
 */
const { z } = require('zod');
const { services } = require('@safer-sh/core');
const { configManager, transactionManager } = require('@safer-sh/common/config');
const { resolveOwnerFromIdentifier, initializeSigner } = require('@safer-sh/common/config/utils');
const { TRANSACTION_STATUS } = require('@safer-sh/core');
const { initializeSafeSDK } = require('@safer-sh/core/utils');
const { ethers } = require('ethers');

/**
 * Execute a transaction with the provided parameters
 * @param {Object} params Parameters for execution
 * @returns {Promise<SaferTransaction>} The updated transaction
 */
async function executeTransaction({
  safeAddress, rpcUrl, chainId, transaction, signer,
  gasLimit, gasPrice, gasBoost, services, configProvider
}) {
  try {
    // Create gas parameters object
    const gasParams = {};
    
    // Set gas limit if provided
    if (gasLimit) {
      gasParams.gasLimit = gasLimit;
    }
    
    // Set gas price if provided
    if (gasPrice) {
      gasParams.gasPrice = gasPrice;
    } else if (gasBoost) {
      // If no gas price but boost provided, get current network price
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const currentFeeData = await provider.getFeeData();
      gasParams.gasPrice = ethers.utils.formatUnits(currentFeeData.gasPrice, 'gwei');
    }
    
    // Apply boost if provided
    if (gasBoost && gasParams.gasPrice) {
      const boost = 100 + parseInt(gasBoost, 10);
      const originalPrice = parseFloat(gasParams.gasPrice);
      const boostedGasPrice = (originalPrice * boost / 100).toFixed(9);
      gasParams.gasPrice = boostedGasPrice.toString();
    }
    
    // Execute transaction using execute service
    const result = await services.executeService.executeTransaction({
      safeAddress,
      rpcUrl,
      chainId,
      transaction,
      signer,
      gasParams
    });
    
    // Save the updated transaction
    await transactionManager.saveTransaction(result);
    
    return result;
  } catch (error) {
    // Rethrow with additional context if needed
    throw error;
  }
}

/**
 * Register signature-related tools to the server
 * @param {Object} server MCP server instance
 */
function registerSignatureTools(server) {
  // Sign transaction tool
  server.tool(
    "signTransaction",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      nonce: z.string().optional(),
      signerIdentifier: z.string().min(1)
    },
    async ({ safeAddress, txHash, nonce, signerIdentifier }) => {
      try {
        // Get chain info from config
        const { chainId, rpcUrl, owners } = await configManager.readConfig();
        
        // Load transaction data using either txHash or nonce
        const transaction = await transactionManager.loadTransaction(txHash || nonce);
        
        // Find owner configuration
        if (!owners || !Array.isArray(owners) || owners.length === 0) {
          throw new Error('No owners configured');
        }
        
        // Find owner using the improved resolver function
        const ownerConfig = resolveOwnerFromIdentifier(signerIdentifier, owners);
        
        if (!ownerConfig) {
          throw new Error(`Owner not found with identifier: ${signerIdentifier}`);
        } else if (ownerConfig.error === 'multiple_matches') {
          // Handle multiple matches
          const matchList = ownerConfig.matches.map(m => `  - ${m.name}: ${m.address}`).join('\n');
          throw new Error(`Multiple owners contain "${signerIdentifier}" in their name:\n${matchList}\nPlease use a more specific identifier.`);
        }
        
        // Initialize signer
        const signer = await initializeSigner(ownerConfig, rpcUrl);
        
        // Sign transaction
        const signResult = await services.signService.signTransaction({
          safeAddress,
          rpcUrl,
          chainId,
          transaction,
          signer
        });
        
        // Save updated transaction with signature
        await transactionManager.saveTransaction(signResult.transaction);
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              txHash,
              safeAddress,
              signer: signResult.signature.signer,
              signature: {
                signer: signResult.signature.signer,
                data: signResult.signature.data
              },
              signaturesCount: Object.keys(signResult.transaction.signatures || {}).length,
              threshold: signResult.threshold,
              canExecute: signResult.canExecute,
              message: `Transaction signed successfully by ${signResult.signature.signer}`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error signing transaction: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Execute transaction tool
  server.tool(
    "executeTransaction",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      nonce: z.string().optional(),
      executorIdentifier: z.string().optional(),
      gasLimit: z.string().optional(),
      gasPrice: z.string().optional(),
      gasBoost: z.string().optional()
    },
    async ({ safeAddress, txHash, nonce, executorIdentifier, gasLimit, gasPrice, gasBoost }) => {
      try {
        // Get chain info from config
        const { chainId, rpcUrl, owners } = await configManager.readConfig();
        
        // Load transaction data using either txHash or nonce
        const transaction = await transactionManager.loadTransaction(txHash || nonce);
        
        // Prepare owner config
        let ownerConfig;
        
        // If user provided executor identifier, use it
        if (executorIdentifier) {
          // Find owner configuration
          if (!owners || !Array.isArray(owners) || owners.length === 0) {
            throw new Error('No owners configured');
          }
          
          // Find owner using the improved resolver function
          ownerConfig = resolveOwnerFromIdentifier(executorIdentifier, owners);
          
          if (!ownerConfig) {
            throw new Error(`Executor not found with identifier: ${executorIdentifier}`);
          }
        } else {
          // Try to find a signer that already signed the transaction
          const signers = Object.keys(transaction.signatures || {});
          
          for (const signerAddress of signers) {
            const found = owners.find(
              owner => owner.address.toLowerCase() === signerAddress.toLowerCase()
            );
            
            if (found) {
              ownerConfig = found;
              break;
            }
          }
          
          if (!ownerConfig) {
            throw new Error('No suitable executor found. Please provide executorIdentifier parameter.');
          }
        }
        
        // Initialize signer
        const signer = await initializeSigner(ownerConfig, rpcUrl);
        
        // Get signer address
        const executorAddress = await signer.getAddress();
        
        // Get Safe owners and threshold
        const { safeSdk } = await initializeSafeSDK({
          safeAddress,
          signer,
          rpcUrl,
          chainId,
          forceNew: true
        });
        const threshold = await safeSdk.getThreshold();
        
        // Check if transaction has enough signatures using SaferTransaction's method
        const hasEnoughSigs = transaction.hasEnoughSignatures({
          threshold,
          executorAddress
        });
        
        if (!hasEnoughSigs) {
          throw new Error(`Insufficient signatures to execute transaction`);
        }
        
        // Prepare execution options
        const executionOptions = {};
        
        // Add gas parameters if provided
        if (gasLimit) executionOptions.gasLimit = gasLimit;
        if (gasPrice) executionOptions.gasPrice = gasPrice;
        if (gasBoost) executionOptions.gasBoost = gasBoost;
        
        // Execute transaction using common utility function
        const result = await executeTransaction({
          safeAddress,
          rpcUrl,
          chainId,
          transaction,
          signer,
          gasLimit,
          gasPrice,
          gasBoost,
          services,
          configProvider
        });
        
        // Save the updated transaction with execution info (already done in executeTransaction)
        
        // Format response based on transaction status
        if (result.status === TRANSACTION_STATUS.SUCCESSFUL) {
          return {
            content: [{
              type: "text", 
              text: JSON.stringify({
                success: true,
                txHash,
                safeAddress,
                status: result.status,
                transactionHash: result.metadata.transactionHash,
                block: result.metadata.blockNumber,
                gasUsed: result.metadata.gasUsed,
                message: `Transaction executed successfully with transaction hash ${result.metadata.transactionHash}`
              }, null, 2)
            }]
          };
        } else if (result.status === TRANSACTION_STATUS.SUBMITTED) {
          return {
            content: [{
              type: "text", 
              text: JSON.stringify({
                success: true,
                txHash,
                safeAddress,
                status: result.status,
                submittedTxHash: result.metadata.submittedTxHash,
                message: "Transaction submitted to blockchain but not yet confirmed"
              }, null, 2)
            }]
          };
        } else {
          // Transaction is still pending or in another state
          return {
            content: [{
              type: "text", 
              text: JSON.stringify({
                success: false,
                txHash,
                safeAddress,
                status: result.status,
                message: result.metadata.warning || result.metadata.errorMessage || 
                        `Transaction not completed. Current status: ${result.status}`,
                details: result.metadata
              }, null, 2)
            }],
            isError: true
          };
        }
      } catch (error) {
        // If the error includes transaction data, include that in the response
        if (error.transaction) {
          await transactionManager.saveTransaction(error.transaction);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                txHash,
                safeAddress,
                status: error.transaction.status,
                message: `Error executing transaction: ${error.message}`,
                details: error.transaction.metadata
              }, null, 2)
            }],
            isError: true
          };
        }
        
        // Default error response
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              txHash,
              safeAddress,
              message: `Error executing transaction: ${error.message}`
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );
}

module.exports = { registerSignatureTools };