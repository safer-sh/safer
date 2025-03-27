/**
 * CLI execute command
 */
const { ethers } = require('ethers');
const { services, TRANSACTION_STATUS } = require('@safer-sh/core');
const { getOwnerAddress, getChainInfo } = require('./config');
const { configManager, transactionManager } = require('@safer-sh/common/config');
const { initializeSigner } = require('@safer-sh/common/config/utils');
const { loading, log, createVerboseLogger } = require('../logger');
const { handleError } = require('../error-handlers');
const { displayTransactionDetails } = require('./transactions');

/**
 * Execute transaction
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleExecute(globalOptions, cmdOptions) {
  try {
    // Merge options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    
    // Check transaction hash
    if (!options.txHash && !options.tx) {
      log.error('Missing transaction hash parameter');
      return false;
    }
    
    // Get transaction hash
    const txInput = options.txHash || options.tx;
    
    // Load transaction data from config provider
    let transaction;
    try {
      loading('Loading transaction data');
      verboseLogger.debug(`Loading transaction: ${txInput}`);
      transaction = await transactionManager.loadTransaction(txInput);
    } catch (error) {
      log.error(error.message);
      return false;
    }
    
    // Display transaction details
    displayTransactionDetails(transaction);
    
    // Get Safe address from transaction
    const safeAddress = transaction.safe;
    if (!safeAddress) {
      log.error('Transaction does not contain Safe address information');
      return false;
    }
    
    // Check transaction status - don't execute transactions that are already executed/successful
    if (transaction.status === TRANSACTION_STATUS.SUCCESSFUL) {
      log.error(`Transaction already successfully executed`);
      return false;
    }
    
    // Check transaction status - don't execute failed transactions without confirmation
    if (transaction.status === TRANSACTION_STATUS.FAILED) {
      log.error(`This transaction previously failed. Please review details using the txs command before attempting to execute again`);
      return false;
    }
    
    // If status is EXECUTED, warn user but allow execution
    if (transaction.status === TRANSACTION_STATUS.EXECUTED) {
      log.warning(`This transaction was marked as executed but might not have completed. Continuing execution...`);
    }
    
    // Get chain information
    const { rpcUrl, chainId } = await getChainInfo(options);
    
    verboseLogger.debug(`Safe address: ${safeAddress}`);
    verboseLogger.debug(`Chain ID: ${chainId}`);
    verboseLogger.debug(`RPC URL: ${rpcUrl}`);
    
    // Get executor configuration
    let ownerConfig;
    
    if (options.signWith) {
      // Using specified executor
      try {
        // Use signWith parameter if provided
        const executorAddress = await getOwnerAddress(options.signWith);
        
        if (!executorAddress) {
          log.error(`Could not resolve executor address from: ${options.signWith}`);
          return false;
        }
        
        ownerConfig = configManager.findOwnerByAddress(executorAddress);
        
        if (!ownerConfig) {
          log.error(`Executor not found in configuration: ${executorAddress}`);
          return false;
        }
        
        verboseLogger.debug(`Using executor: ${executorAddress} (${ownerConfig.type})`);
      } catch (error) {
        log.error(`Failed to initialize executor: ${error.message}`);
        return false;
      }
    } else {
      log.error('No executor specified. Use --sign-with to specify an executor.');
      return false;
    }

    // Initialize signer
    let signer;
    try {
      signer = await initializeSigner(ownerConfig, rpcUrl);
    } catch (error) {
      log.error(`Failed to initialize signer: ${error.message}`);
      return false;
    }
    
    // Get executor address
    const executorAddress = await signer.getAddress();
    
    // Get threshold from transaction
    const threshold = transaction.metadata?.threshold;
    
    // Check if transaction has enough signatures (considering executor)
    if (threshold && !transaction.hasEnoughSignatures({ 
      threshold: parseInt(threshold), 
      executorAddress
    })) {
      // Calculate required signatures
      const isExecutorSigned = transaction.isSignedBy(executorAddress);

      let signatureCount = 0;
      if (isExecutorSigned) {
        signatureCount = transaction.getSigners().length;
      } else {
        signatureCount = transaction.getSigners().length + 1;
      }
      
      log.error(`Insufficient signatures. Required: ${threshold}, Current: ${signatureCount}`);
      return false;
    }
    
    // Parse gas parameters
    const gasParams = {};
    
    if (options.gasLimit) {
      gasParams.gasLimit = options.gasLimit;
    }
    
    // Get current network gas price
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const currentFeeData = await provider.getFeeData();
    const currentGasPriceGwei = ethers.utils.formatUnits(currentFeeData.gasPrice, 'gwei');
    verboseLogger.debug(`Current network gas price: ${currentGasPriceGwei} gwei`);
    
    // Handle gas price and boost
    if (options.gasPrice) {
      // User provided gas price
      gasParams.gasPrice = options.gasPrice;
      verboseLogger.debug(`Using user-provided gas price: ${options.gasPrice} gwei`);
    } else if (options.gasBoost) {
      // No user gas price but boost provided - use current network price with boost
      gasParams.gasPrice = currentGasPriceGwei;
      verboseLogger.debug(`Using current network gas price: ${currentGasPriceGwei} gwei`);
    }
    
    // Apply boost if provided
    if (options.gasBoost) {
      const boost = 100 + parseInt(options.gasBoost, 10);
      const originalPrice = parseFloat(gasParams.gasPrice);
      // Use higher precision to handle small values
      const boostedGasPrice = (originalPrice * boost / 100).toFixed(9);
      gasParams.gasPrice = boostedGasPrice.toString();
      verboseLogger.debug(`Boosted gas price: ${originalPrice} * ${boost/100} = ${gasParams.gasPrice} gwei`);
    }
    
    // Execute transaction
    loading('Executing transaction');
    
    try {
      // Get current network gas prices
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const currentFeeData = await provider.getFeeData();
      
      // Display current network gas information
      log.info('Current network gas prices:');
      if (currentFeeData.gasPrice) {
        const gasPriceGwei = ethers.utils.formatUnits(currentFeeData.gasPrice, 'gwei');
        log.info(`  Gas Price: ${gasPriceGwei} gwei`);
      }
      
      // Display user configured gas parameters
      log.info('Your configured gas settings:');
      if (gasParams.gasLimit) {
        log.info(`  Gas Limit: ${gasParams.gasLimit}`);
      }
      
      if (gasParams.gasPrice) {
        let sourceText = '';
        if (options.gasPrice) {
          sourceText = '(manually set)';
        } else {
          sourceText = '(from network)';
        }
        
        let boostText = '';
        if (options.gasBoost) {
          boostText = ` (boosted by ${options.gasBoost}%)`;
        }
        
        log.info(`  Gas Price: ${parseFloat(gasParams.gasPrice)} gwei ${sourceText}${boostText}`);
      } else {
        log.info(`  Gas Price: Using network default`);
      }
      
      // Call execute service
      log.info(`Executing transaction ${txInput}...`);
      const resultTx = await services.executeService.executeTransaction({
        safeAddress,
        rpcUrl,
        chainId,
        transaction,
        signer: signer,
        gasParams
      });
      
      // Save updated transaction (this now includes correct status)
      await transactionManager.saveTransaction(resultTx);
      
      // Check the actual status to determine the message to display
      if (resultTx.status === 'SUCCESSFUL') {
        log.success(`Transaction executed successfully!`);
        
        // Show transaction hash if available
        if (resultTx.metadata?.transactionHash) {
          log.info(`On-chain hash: ${resultTx.metadata.transactionHash}`);
        }
        
        if (resultTx.metadata?.effectiveGasPrice) {
          const gweiPrice = ethers.utils.formatUnits(resultTx.metadata.effectiveGasPrice, 'gwei');
          log.info(`Effective gas price: ${gweiPrice} gwei`);
        }
        if (resultTx.metadata?.totalCost) {
          log.info(`Total cost: ${ethers.utils.formatEther(resultTx.metadata.totalCost)} ETH`);
        }
      } else if (resultTx.status === 'SUBMITTED') {
        log.info(`Transaction submitted to blockchain but not yet confirmed.`);
        log.info(`On-chain hash: ${resultTx.metadata?.submittedTxHash || 'Unknown'}`);
        log.info(`Check the blockchain explorer for confirmation status.`);
      } else if (resultTx.status === 'PENDING') {
        // Transaction is still pending and may have encountered an issue
        if (resultTx.metadata?.confirmationError) {
          log.warning(`Transaction was submitted but confirmation timed out.`);
          log.info(`Error: ${resultTx.metadata.confirmationError}`);
          log.info(`The transaction may still confirm later. Check the explorer.`);
        } else if (resultTx.metadata?.warning) {
          log.warning(`Transaction status uncertain: ${resultTx.metadata.warning}`);
        } else if (resultTx.metadata?.ledgerError) {
          log.error(`Ledger device communication error.`);
          log.info(`Your transaction was likely not submitted. Try again.`);
        } else if (resultTx.metadata?.errorMessage) {
          log.error(`Execution error: ${resultTx.metadata.errorMessage}`);
        } else {
          log.warning(`Transaction is still in pending status for an unknown reason.`);
        }
      } else {
        log.warning(`Transaction execution completed with status: ${resultTx.status}`);
        
        // Show any error details from metadata
        if (resultTx.metadata?.errorMessage) {
          log.error(`Error: ${resultTx.metadata.errorMessage}`);
        }
      }
      
      return true;
    } catch (error) {
      // If the error already includes an updated transaction, use it
      if (error.transaction) {
        await transactionManager.saveTransaction(error.transaction);
        
        // Display appropriate error message based on the error
        if (error.code === 'INSUFFICIENT_SIGNATURES') {
          log.error(`Not enough signatures. Required: ${error.required || error.details?.required}, Current: ${error.current || error.details?.current}`);
        } else {
          log.error(`Execution error: ${error.message}`);
          
          // Display additional error details if available
          if (error.details) {
            if (error.details.reason) {
              log.error(`Reason: ${error.details.reason}`);
            }
            if (error.details.code) {
              log.error(`Error code: ${error.details.code}`);
            }
          }
        }
        
        // Display additional information about the transaction status
        log.info(`Transaction remains in ${error.transaction.status} status.`);
        log.info(`You can try again or check the transaction status with 'safer transactions list'.`);
      } else {
        // If for some reason no error.transaction exists, fall back to the original error handling
        // but still don't mark as FAILED unless we're certain
        const pendingTransaction = transaction.updateStatus(TRANSACTION_STATUS.PENDING);
        await transactionManager.saveTransaction(pendingTransaction);
        
        log.error(`Execution error: ${error.message}`);
        log.info(`Transaction marked as PENDING. You can try again later.`);
      }
      
      if (options.verbose) {
        if (error.stack) {
          log.secondary('Error stack:');
          log.secondary(error.stack);
        }
        if (error.details && error.details.originalError) {
          log.secondary('Original error:');
          log.secondary(error.details.originalError);
        }
      }
      
      return false;
    }
  } catch (error) {
    return handleError(error, globalOptions.verbose || cmdOptions.verbose);
  }
}

module.exports = handleExecute; 