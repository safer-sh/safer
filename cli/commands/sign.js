/**
 * CLI sign command
 */
const { services } = require('@safer-sh/core');
const {
  loading,
  log,
  createVerboseLogger
} = require('../logger');
const { handleError } = require('../error-handlers');
const { getChainInfo, getOwnerAddress } = require('./config');
const { configManager, transactionManager } = require('@safer-sh/common/config');
const { displayTransactionDetails } = require('./transactions');
const { initializeSigner } = require('@safer-sh/common/config/utils');

/**
 * Sign transaction
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleSignTransaction(globalOptions, cmdOptions) {
  try {
    // Merge options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    
    // Check transaction hash
    if (!options.tx) {
      log.error('Missing transaction hash parameter');
      return false;
    }
    
    // Resolve transaction hash (support for nonce or hash shortcuts)
    let transaction;
    try {
      verboseLogger.debug(`Loading transaction: ${options.tx}`);
      loading('Loading transaction');
      transaction = await transactionManager.loadTransaction(options.tx);
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
    
    // Check signer address
    if (!options.signWith) {
      log.error('No signer specified. Use --sign-with <identifier> to specify a signer.');
      log.secondary('Identifier can be:');
      log.secondary('- Full Ethereum address (0x...)');
      log.secondary('- Owner name as configured');
      log.secondary('- Last few characters of address');
      log.secondary('- Numeric index (1, 2, etc.)');
      return false;
    }
    
    verboseLogger.debug(`Using signer identifier: ${options.signWith}`);
    
    // Get chain information
    const { rpcUrl, chainId } = await getChainInfo(options);
    
    // Create signer
    try {
      // Resolve owner address from identifier
      loading('Initializing signer');
      const ownerAddress = await getOwnerAddress(options.signWith);
      if (!ownerAddress) {
        throw new Error(`Could not resolve owner address from: ${options.signWith}`);
      }
      
      // Find owner configuration
      const ownerConfig = configManager.findOwnerByAddress(ownerAddress);
      if (!ownerConfig) {
        throw new Error(`Owner not found in configuration: ${ownerAddress}`);
      }
      
      verboseLogger.debug(`Resolved signer address: ${ownerAddress}`);
      verboseLogger.debug(`Owner type: ${ownerConfig.type}`);
      
      // Initialize signer directly
      const signer = await initializeSigner(ownerConfig, rpcUrl);
      
      // Sign transaction using SignService
      loading('Signing transaction');
      const signResult = await services.signService.signTransaction({
        safeAddress,
        rpcUrl,
        chainId,
        transaction,
        signer
      });
      
      // Get the updated transaction with the new signature
      const updatedTransaction = signResult.transaction;
      
      // Update transaction in storage
      await transactionManager.saveTransaction(updatedTransaction);
      
      // Get signature status
      
      // Show success message
      log.success('Transaction signed successfully');
      log.info(`Transaction hash: ${updatedTransaction.hash}`);
      log.info(`Transaction nonce: ${updatedTransaction.nonce}`);
      log.info(`Signed by: ${ownerAddress}`);
      
      return true;
    } catch (err) {
      log.error(`Signing error: ${err.message}`);
      if (options.verbose && err.stack) {
        log.secondary(err.stack);
      }
      return false;
    }
  } catch (err) {
    return handleError(err, globalOptions.verbose || cmdOptions.verbose);
  }
}

module.exports = {
  signTransaction: handleSignTransaction
}; 