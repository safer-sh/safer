/**
 * CLI transfer command
 */
const { services } = require('@safer-sh/core');
const { transactionManager } = require('@safer-sh/common/config');
const { 
  formatETHTransfer,
  formatERC20Transfer,
  loading,
  log,
  createVerboseLogger
} = require('../logger');
const { handleError } = require('../error-handlers');
const { signTransaction: handleSignTransaction } = require('./sign');
const { 
  getSafeAddress, 
  getChainInfo
} = require('./config');

/**
 * Handle ETH transfer command
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleTransferETH(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('ETH transfer command started');
    
    // Validate required parameters
    if (!options.to) {
      log.error('Missing recipient address parameter');
      return false;
    }
    
    if (!options.amount) {
      log.error('Missing transfer amount parameter');
      return false;
    }
    
    verboseLogger.debug(`Transfer parameters: to=${options.to}, amount=${options.amount}`);
    
    // Get Safe address
    const safeAddress = await getSafeAddress(options);
    verboseLogger.debug(`Using Safe address: ${safeAddress}`);
    
    // Get chain info for RPC URL
    const { rpcUrl, chainId } = await getChainInfo(options);
    verboseLogger.debug(`Using chain ID: ${chainId}, RPC URL: ${rpcUrl}`);
    
    // Get Safe information
    loading('Getting Safe information');
    verboseLogger.debug('Retrieving Safe information...');
    const safeInfo = await services.safeService.getSafeInfo({
      safeAddress,
      rpcUrl,
      chainId
    });
    verboseLogger.debug(`Safe info retrieved: owners=${safeInfo.owners.length}, threshold=${safeInfo.threshold}`);
    
    // Create transaction using the new TransactionService
    loading('Creating transaction');
    verboseLogger.debug('Creating ETH transfer transaction...');
    const transaction = await services.transactionService.createEthTransferTx({
      safeAddress,
      receiverAddress: options.to,
      amount: options.amount,
      rpcUrl,
      chainId
    });
    verboseLogger.debug('ETH transfer transaction created successfully');
    
    // Add owners and threshold to metadata
    transaction.metadata.owners = safeInfo.owners;
    transaction.metadata.threshold = safeInfo.threshold;
    
    // Format and display transfer details
    formatETHTransfer(transaction);
    
    // Save transaction
    loading('Saving transaction');
    verboseLogger.debug('Saving transaction to storage...');
    
    // Save transaction using configProvider
    const savedTx = await transactionManager.saveTransaction(transaction);
    verboseLogger.debug(`Transaction saved with hash: ${savedTx.hash}`);
    
    log.success(`Transaction created with hash: ${savedTx.hash}`);
    
    // Sign transaction if requested
    if (options.signWith) {
      log.empty();
      loading('Signing transaction');
      verboseLogger.debug(`Proceeding to sign with identifier: ${options.signWith}`);
      
      // Extract the global options and command options
      const { to, amount, contract, ...globalOpts } = options;
      return await handleSignTransaction(globalOpts, {
        tx: savedTx.hash,
        signWith: options.signWith
      });
    }
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Handle ERC20 token transfer command
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleTransferERC20(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('ERC20 transfer command started');
    
    // Validate required parameters
    if (!options.to) {
      log.error('Missing recipient address parameter');
      return false;
    }
    
    if (!options.amount) {
      log.error('Missing transfer amount parameter');
      return false;
    }
    
    if (!options.contract) {
      log.error('Missing token contract address parameter');
      return false;
    }
    
    verboseLogger.debug(`Transfer parameters: to=${options.to}, amount=${options.amount}, contract=${options.contract}`);
    
    // Get Safe address
    const safeAddress = await getSafeAddress(options);
    verboseLogger.debug(`Using Safe address: ${safeAddress}`);
    
    // Get chain info for RPC URL
    const { rpcUrl, chainId } = await getChainInfo(options);
    verboseLogger.debug(`Using chain ID: ${chainId}, RPC URL: ${rpcUrl}`);
    
    // Get Safe information
    loading('Getting Safe information');
    verboseLogger.debug('Retrieving Safe information...');
    const safeInfo = await services.safeService.getSafeInfo({
      safeAddress,
      rpcUrl,
      chainId
    });
    verboseLogger.debug(`Safe info retrieved: owners=${safeInfo.owners.length}, threshold=${safeInfo.threshold}`);
    
    // Create transaction using the new TransactionService
    loading('Creating transaction');
    verboseLogger.debug('Creating ERC20 transfer transaction...');
    const transaction = await services.transactionService.createErc20TransferTx({
      safeAddress,
      receiverAddress: options.to,
      amount: options.amount,
      tokenAddress: options.contract,
      rpcUrl,
      chainId
    });
    verboseLogger.debug(`ERC20 transfer transaction created successfully (token: ${transaction.metadata.tokenSymbol})`);
    
    // Add owners and threshold to metadata
    transaction.metadata.owners = safeInfo.owners;
    transaction.metadata.threshold = safeInfo.threshold;
    
    // Format and display transfer details
    formatERC20Transfer(transaction);
    
    // Save transaction
    loading('Saving transaction');
    verboseLogger.debug('Saving transaction to storage...');
    
    // Save transaction using configProvider
    const savedTx = await transactionManager.saveTransaction(transaction);
    verboseLogger.debug(`Transaction saved with hash: ${savedTx.hash}`);
    
    log.success(`Transaction created with hash: ${savedTx.hash}`);
    
    // Sign transaction if requested
    if (options.signWith) {
      log.empty();
      loading('Signing transaction');
      verboseLogger.debug(`Proceeding to sign with identifier: ${options.signWith}`);
      
      // Extract the global options and command options
      const { to, amount, contract, ...globalOpts } = options;
      return await handleSignTransaction(globalOpts, {
        tx: savedTx.hash,
        signWith: options.signWith
      });
    }
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Process transfer command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleTransfer(globalOptions, cmdOptions) {
  // Combine options
  const options = { ...globalOptions, ...cmdOptions };
  
  // Determine if it's an ETH or ERC20 transfer
  if (options.contract) {
    return handleTransferERC20(options);
  } else {
    return handleTransferETH(options);
  }
}

module.exports = handleTransfer; 