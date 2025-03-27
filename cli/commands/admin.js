/**
 * CLI admin command
 */
const { ethers } = require('ethers');
const { services } = require('@safer-sh/core');
const { configManager, transactionManager } = require('@safer-sh/common/config');
const { 
  loading, 
  address, 
  secondary,
  log,
  createVerboseLogger
} = require('../logger');
const { handleError } = require('../error-handlers');
const { 
  getSafeAddress, 
  getChainInfo 
} = require('./config');

/**
 * Handle add owner command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleAddOwner(globalOptions, cmdOptions) {
  try {
    // Merge options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Add owner command started');
    
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
    
    // Parse threshold if provided
    let threshold;
    if (options.threshold) {
      threshold = parseInt(options.threshold, 10);
      if (isNaN(threshold)) {
        log.error('Invalid threshold, must be a number');
        return false;
      }
      verboseLogger.debug(`Using threshold: ${threshold}`);
    }
    
    // Create transaction using the new service
    loading('Creating transaction');
    verboseLogger.debug('Creating add owner transaction...');
    const transaction = await services.safeService.createAddOwnerTx({
      safeAddress,
      rpcUrl,
      chainId,
      newOwnerAddress: options.owner,
      threshold
    });
    
    // Add owners and threshold to metadata
    transaction.metadata.owners = safeInfo.owners;
    transaction.metadata.threshold = safeInfo.threshold;
    
    // Save transaction
    verboseLogger.debug('Saving transaction to storage...');
    const savedTx = await transactionManager.saveTransaction(transaction);
    verboseLogger.debug(`Transaction saved with hash: ${savedTx.hash}`);
    
    // Show confirmation
    log.empty();
    log.header('ADD OWNER TRANSACTION CREATED');
    log.plain(`Transaction: ${secondary(savedTx.hash)}`);
    log.plain(`Owner to add: ${address(options.owner)}`);
    if (threshold) {
      log.plain(`New threshold: ${threshold}`);
    }
    log.empty();
    log.success('Transaction created successfully');
    
    // If sign flag is set or signWith is provided, sign the transaction
    if (options.sign || options.signWith) {
      log.empty();
      log.header('SIGNING TRANSACTION');
      verboseLogger.debug('Proceeding to sign the transaction...');
      
      const { signTransaction } = require('./sign');
      return await signTransaction(globalOptions, {
        ...cmdOptions,
        tx: savedTx.hash
      });
    }
    
    return true;
  } catch (err) {
    return handleError(err, globalOptions.verbose || cmdOptions.verbose);
  }
}

/**
 * Handle remove owner command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleRemoveOwner(globalOptions, cmdOptions) {
  try {
    // Merge options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Remove owner command started');
    
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
    
    // Parse threshold if provided
    let threshold;
    if (options.threshold) {
      threshold = parseInt(options.threshold, 10);
      if (isNaN(threshold)) {
        log.error('Invalid threshold, must be a number');
        return false;
      }
      verboseLogger.debug(`Using threshold: ${threshold}`);
    }
    
    // Create transaction using the new service
    loading('Creating transaction');
    verboseLogger.debug('Creating remove owner transaction...');
    const transaction = await services.safeService.createRemoveOwnerTx({
      safeAddress,
      rpcUrl,
      chainId,
      ownerAddress: options.owner,
      threshold
    });
    
    // Add owners and threshold to metadata
    transaction.metadata.owners = safeInfo.owners;
    transaction.metadata.threshold = safeInfo.threshold;
    
    // Save transaction
    verboseLogger.debug('Saving transaction to storage...');
    const savedTx = await transactionManager.saveTransaction(transaction);
    verboseLogger.debug(`Transaction saved with hash: ${savedTx.hash}`);
    
    // Show confirmation
    log.empty();
    log.header('REMOVE OWNER TRANSACTION CREATED');
    log.plain(`Transaction: ${secondary(savedTx.hash)}`);
    log.plain(`Owner to remove: ${address(options.owner)}`);
    if (threshold) {
      log.plain(`New threshold: ${threshold}`);
    }
    log.empty();
    log.success('Transaction created successfully');
    
    // If sign flag is set or signWith is provided, sign the transaction
    if (options.sign || options.signWith) {
      log.empty();
      log.header('SIGNING TRANSACTION');
      verboseLogger.debug('Proceeding to sign the transaction...');
      
      const { signTransaction } = require('./sign');
      return await signTransaction(globalOptions, {
        ...cmdOptions,
        tx: savedTx.hash
      });
    }
    
    return true;
  } catch (err) {
    return handleError(err, globalOptions.verbose || cmdOptions.verbose);
  }
}

/**
 * Handle change threshold command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleChangeThreshold(globalOptions, cmdOptions) {
  try {
    // Merge options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Change threshold command started');
    
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
    
    // Parse threshold
    const currentThreshold = safeInfo.threshold;
    const threshold = parseInt(options.threshold, 10);
    
    if (isNaN(threshold)) {
      log.error('Invalid threshold, must be a number');
      return false;
    }
    
    verboseLogger.debug(`Current threshold: ${currentThreshold}`);
    verboseLogger.debug(`New threshold: ${threshold}`);
    
    // Create transaction using the new service
    loading('Creating transaction');
    verboseLogger.debug('Creating change threshold transaction...');
    const transaction = await services.safeService.createChangeThresholdTx({
      safeAddress,
      rpcUrl,
      chainId,
      threshold
    });
    
    // Add owners and threshold to metadata
    transaction.metadata.owners = safeInfo.owners;
    transaction.metadata.threshold = safeInfo.threshold;
    
    // Save transaction
    verboseLogger.debug('Saving transaction to storage...');
    const savedTx = await transactionManager.saveTransaction(transaction);
    verboseLogger.debug(`Transaction saved with hash: ${savedTx.hash}`);
    
    // Show confirmation
    log.empty();
    log.header('CHANGE THRESHOLD TRANSACTION CREATED');
    log.plain(`Transaction: ${secondary(savedTx.hash)}`);
    log.plain(`Current threshold: ${currentThreshold}`);
    log.plain(`New threshold: ${threshold}`);
    log.empty();
    log.success('Transaction created successfully');
    
    // If sign flag is set or signWith is provided, sign the transaction
    if (options.sign || options.signWith) {
      log.empty();
      log.header('SIGNING TRANSACTION');
      verboseLogger.debug('Proceeding to sign the transaction...');
      
      const { signTransaction } = require('./sign');
      return await signTransaction(globalOptions, {
        ...cmdOptions,
        tx: savedTx.hash
      });
    }
    
    return true;
  } catch (err) {
    return handleError(err, globalOptions.verbose || cmdOptions.verbose);
  }
}

/**
 * Handle admin command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleAdmin(globalOptions, cmdOptions) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(cmdOptions.verbose);
    verboseLogger.debug('Admin command started');
    
    // Combine options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Get options
    const { addOwner, removeOwner, threshold, sign, signWith } = options;
    verboseLogger.debug(`Command options: addOwner=${addOwner}, removeOwner=${removeOwner}, threshold=${threshold}, sign=${sign}, signWith=${signWith}`);
    
    // If signWith is specified but sign is not, treat it as if sign was specified
    if (signWith && !sign) {
      options.sign = true;
      cmdOptions.sign = true;
      verboseLogger.debug('signWith provided without sign flag; enabling sign flag');
    }
    
    // Handle add owner
    if (addOwner) {
      verboseLogger.debug(`Handling add owner: ${addOwner}`);
      if (!ethers.utils.isAddress(addOwner)) {
        log.error('Invalid owner address');
        return false;
      }
      return await handleAddOwner(globalOptions, { ...cmdOptions, owner: addOwner });
    }
    
    // Handle remove owner
    if (removeOwner) {
      verboseLogger.debug(`Handling remove owner: ${removeOwner}`);
      if (!ethers.utils.isAddress(removeOwner)) {
        log.error('Invalid owner address');
        return false;
      }
      return await handleRemoveOwner(globalOptions, { ...cmdOptions, owner: removeOwner });
    }
    
    // Handle change threshold
    if (threshold) {
      verboseLogger.debug(`Handling change threshold: ${threshold}`);
      return await handleChangeThreshold(globalOptions, cmdOptions);
    }
    
    // If we get here, no valid command was specified
    verboseLogger.debug('No valid command specified');
    log.error('No valid admin command specified. Use --add-owner, --remove-owner, or --threshold.');
    log.info('For Safe information, use the "info" command instead.');
    return false;
  } catch (err) {
    return handleError(err, globalOptions.verbose || cmdOptions.verbose);
  }
}

module.exports = handleAdmin; 