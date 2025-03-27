/**
 * CLI info command
 */
const { services } = require('@safer-sh/core');
const { 
  loading, 
  address, 
  amount,
  log,
  createVerboseLogger
} = require('../logger');
const { handleError } = require('../error-handlers');
const { getSafeAddress, getChainInfo } = require('./config');
const { configManager } = require('@safer-sh/common/config');

/**
 * Format and display Safe info
 * 
 * @param {Object} safeInfo - Safe information
 */
function displaySafeInfo(safeInfo) {
  const {
    safeAddress,
    ethBalanceFormatted,
    owners,
    threshold,
    nonce,
    chainId,
    version
  } = safeInfo;
  
  log.empty();
  log.header('SAFE WALLET INFORMATION');
  log.plain(`Safe Address: ${address(safeAddress)}`);
  log.plain(`ETH Balance: ${amount(ethBalanceFormatted)}`);
  log.plain(`Required Confirmations: ${threshold} of ${owners.length}`);
  log.plain(`Transaction Nonce: ${nonce}`);
  log.plain(`Chain ID: ${chainId}`);
  log.plain(`Safe Version: ${version}`);
  
  log.empty();
  log.header('OWNERS');
  owners.forEach((owner, index) => {
    const ownerConfig = configManager.findOwnerByAddress(owner);
    const ownerName = ownerConfig ? ownerConfig.name : null;
    const ownerType = ownerConfig ? ` (${ownerConfig.type})` : '';
    const ownerLabel = ownerName ? ` - ${ownerName}${ownerType}` : ownerType;
    log.plain(`[${index + 1}] ${address(owner)}${ownerLabel}`);
  });
}

/**
 * Handle info command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} cmdOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleInfo(globalOptions, cmdOptions) {
  try {
    // Merge options
    const options = { ...globalOptions, ...cmdOptions };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Info command started');
    
    // Get Safe address and chain info
    const safeAddress = await getSafeAddress(options);
    const { rpcUrl, chainId } = await getChainInfo(options);
    verboseLogger.debug(`Using Safe address: ${safeAddress}, chain ID: ${chainId}, RPC URL: ${rpcUrl}`);
    
    // Get Safe info
    loading('Getting Safe information');
    verboseLogger.debug('Retrieving Safe information from blockchain...');
    const safeInfo = await services.safeService.getSafeInfo({
      safeAddress,
      rpcUrl,
      chainId
    });
    
    verboseLogger.debug(`Safe info retrieved: threshold=${safeInfo.threshold}, owners=${safeInfo.owners.length}, balance=${safeInfo.ethBalanceFormatted}, nonce=${safeInfo.nonce}`);
    
    // Display Safe info
    displaySafeInfo(safeInfo);
    
    return true;
  } catch (err) {
    return handleError(err, globalOptions.verbose);
  }
}

module.exports = handleInfo; 