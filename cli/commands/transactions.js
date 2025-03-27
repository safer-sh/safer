/**
 * CLI transactions command
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const {
  success,
  error,
  secondary,
  hash,
  address,
  amount,
  header,
  log,
  createVerboseLogger
} = require('../logger');
const { handleError } = require('../error-handlers');
const { configManager, transactionManager, ipfsManager } = require('@safer-sh/common/config');
const { PATHS } = require('@safer-sh/common/constants');
const { TRANSACTION_STATUS } = require('@safer-sh/core');

/**
 * Format transaction type for display
 * 
 * @param {SaferTransaction} tx - SaferTransaction object
 * @returns {string} Formatted transaction type
 */
function formatTransactionType(tx) {
  if (!tx.metadata || !tx.metadata.type) {
    return secondary('Unknown');
  }
  
  switch (tx.metadata.type) {
    case 'ethTransfer':
      return `ETH Transfer (${amount(tx.metadata.amountFormatted)})`;
    case 'erc20Transfer':
      return `${tx.metadata.tokenSymbol} Transfer (${amount(tx.metadata.amountFormatted, tx.metadata.tokenSymbol)})`;
    case 'addOwner':
      return `Add Owner (${address(tx.metadata.newOwner)})`;
    case 'removeOwner':
      return `Remove Owner (${address(tx.metadata.removedOwner)})`;
    case 'changeThreshold':
      return `Change Threshold (${tx.metadata.oldThreshold} → ${tx.metadata.newThreshold})`;
    default:
      return tx.metadata.type;
  }
}

/**
 * Format transaction status for display
 * 
 * @param {SaferTransaction} tx - SaferTransaction object
 * @returns {string} Formatted transaction status
 */
function formatTransactionStatus(tx) {
  switch (tx.status) {
    case TRANSACTION_STATUS.PENDING:
      return secondary('Pending');
    case TRANSACTION_STATUS.SUBMITTED:
      return secondary('Submitted');
    case TRANSACTION_STATUS.CONFIRMED:
      return secondary('Confirmed');
    case TRANSACTION_STATUS.EXECUTED:
      return success('Executed');
    case TRANSACTION_STATUS.SUCCESSFUL:
      return success('Successful');
    case TRANSACTION_STATUS.FAILED:
      return error('Failed');
    case TRANSACTION_STATUS.CANCELLED:
      return error('Cancelled');
    default:
      return secondary(tx.status || 'Unknown');
  }
}

/**
 * Format signatures count for display
 * 
 * @param {SaferTransaction} tx - SaferTransaction object
 * @returns {string} Formatted signatures count
 */
function formatSignaturesCount(tx) {
  const signatureCount = tx.getSigners().length;
  const threshold = tx.metadata?.threshold || tx.metadata?.confirmationsRequired;
  const thresholdStr = threshold ? ` / ${threshold}` : '';
  return `${signatureCount}${thresholdStr}`;
}

/**
 * Handle listing all transactions
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleListTransactions(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('List transactions command started');
    
    // Load all transactions with sorting
    verboseLogger.debug('Loading transactions');
    const txList = await transactionManager.listTransactions({
      sortBy: 'createDate',
      ascending: false,
      status: options.status,
      type: options.type,
      safeAddress: options.safe
    });
    verboseLogger.debug(`Found ${txList.length} transactions`);
    
    if (txList.length === 0) {
      log.empty();
      log.plain('No transactions found');
      return true;
    }
    
    // Print transactions table
    log.empty();
    log.header('TRANSACTIONS');
    log.secondary('ID  | Nonce | Type                | Status    | Signatures | Created');
    log.secondary('----+-------+---------------------+-----------+------------+-------------------');
    
    let index = 1;
    for (const tx of txList) {
      const date = tx.createDate 
        ? new Date(tx.createDate).toLocaleString() 
        : 'Unknown';
      
      const type = formatTransactionType(tx);
      const status = formatTransactionStatus(tx);
      const signatures = formatSignaturesCount(tx);
      const nonce = tx.nonce || 'N/A';
      
      verboseLogger.debug(`TX #${index}: ${tx.hash}, nonce=${nonce}, type=${tx.metadata?.type || 'unknown'}, status=${tx.status || 'pending'}`);
      log.plain(`${index.toString().padEnd(3)} | ${nonce.toString().padEnd(5)} | ${type.padEnd(20)} | ${status.padEnd(10)} | ${signatures.padEnd(10)} | ${date}`);
      log.plain(`     ${hash(tx.hash)}`);
      index++;
    }
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Display transaction details
 * 
 * @param {SaferTransaction} tx - Transaction object
 */
function displayTransactionDetails(tx) {
  const borderChar = '─';
  const borderWidth = 80;
  const corner = '┌┐└┘';
  const vertical = '│';
  
  // Header border
  log.plain(`${corner[0]}${borderChar.repeat(borderWidth - 2)}`);
  
  // Display transaction details - use blue header outside the box
  log.plain(`${vertical} ${header('TRANSACTION DETAILS')}`);
  log.plain(`${vertical} ${secondary('SafeTxHash:')}${hash(tx.hash)}`);
  log.plain(`${vertical} ${secondary('Type:')} ${formatTransactionType(tx)}`);
  log.plain(`${vertical} ${secondary('Status:')} ${formatTransactionStatus(tx)}`);
  log.plain(`${vertical} ${secondary('Created:')} ${tx.createDate ? new Date(tx.createDate).toLocaleString() : 'Unknown'}`);
  
  if (tx.isExecuted && tx.transactionHash) {
    log.plain(`${vertical} ${secondary('Executed:')} ${tx.executionDate ? new Date(tx.executionDate).toLocaleString() : 'Unknown'}`);
    log.plain(`${vertical} ${secondary('Onchain TX:')}${hash(tx.transactionHash)}`);
  }
  
  if (tx.status === TRANSACTION_STATUS.FAILED && tx.metadata.failureReason) {
    log.plain(`${vertical} ${secondary('Failure Reason:')}${error(tx.metadata.failureReason)}`);
  }
  
  // Middle border
  log.plain(`${vertical}${borderChar.repeat(borderWidth - 2)}`);
  
  // Display transaction data - use blue header outside the box
  log.plain(`${vertical} ${header('TRANSACTION DATA')}`);
  log.plain(`${vertical} ${secondary('To:')}${address(tx.to)}`);
  log.plain(`${vertical} ${secondary('Value:')}${tx.value === '0' ? '0 ETH' : amount(ethers.utils.formatEther(tx.value))}`);
  log.plain(`${vertical} ${secondary('Nonce:')}${tx.nonce}`);
  
  // Middle border
  log.plain(`${vertical}${borderChar.repeat(borderWidth - 2)}`);
  
  // Display signatures - use blue header outside the box
  log.plain(`${vertical} ${header('SIGNATURES')}`);
  
  const signers = tx.getSigners();
  
  if (signers.length === 0) {
    log.plain(`${vertical} No signatures`);
  } else {
    signers.forEach((signer, index) => {
      log.plain(`${vertical} ${index + 1}. ${address(signer)}`);
    });
  }
  
  // Show threshold if available
  const threshold = tx.metadata?.threshold || tx.threshold;
  if (threshold) {
    log.plain(`${vertical} Threshold: ${signers.length}/${threshold}`);
  }
  
  // Footer border
  log.plain(`${corner[2]}${borderChar.repeat(borderWidth - 2)}`);
  log.empty();
}

/**
 * Handle showing transaction details
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleTransactionDetails(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Transaction details command started');
    
    const txInput = options.show;
    
    if (!txInput) {
      log.error('Transaction hash must be provided');
      return false;
    }
    
    // Resolve transaction hash (support for nonce or hash)
    let tx;
    try {
      verboseLogger.debug(`Loading transaction data for: ${txInput}`);
      tx = await transactionManager.loadTransaction(txInput);
      verboseLogger.debug(`Transaction loaded: type=${tx.metadata?.type || 'unknown'}, status=${tx.status || 'pending'}`);
    } catch (error) {
      log.error(error.message);
      return false;
    }
    
    displayTransactionDetails(tx);
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Handle exporting a transaction to IPFS
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleExportTransaction(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Export transaction command started');
    
    const txInput = options.export;
    
    if (!txInput) {
      log.error('Transaction hash must be provided');
      return false;
    }
    
    // Load transaction
    verboseLogger.debug('Loading transaction data');
    const tx = await transactionManager.loadTransaction(txInput);
    verboseLogger.debug(`Transaction loaded: type=${tx.metadata?.type || 'unknown'}, status=${tx.status || 'pending'}`);
    
    // Check destination type (directory or ipfs)
    const destination = options.to;
    
    // Handle IPFS export
    if (destination === 'ipfs') {
      verboseLogger.debug('IPFS export requested');
      
      // Check for Pinata API credentials in config
      const config = await configManager.readConfig();
      const pinataApiKey = config.pinataApiKey;
      const pinataSecretApiKey = config.pinataSecretApiKey;
      
      if (!pinataApiKey || !pinataSecretApiKey || 
          pinataApiKey === 'YOUR_PINATA_API_KEY' || 
          pinataSecretApiKey === 'YOUR_PINATA_SECRET_API_KEY') {
        log.error('Pinata API credentials not configured');
        log.plain('To use IPFS export, please configure your Pinata API credentials:');
        log.plain('  safer config --set-pinata-api-key <your_api_key>');
        log.plain('  safer config --set-pinata-secret <your_secret_key>');
        log.plain('\nYou can get these credentials by signing up at https://pinata.cloud/');
        return false;
      }
      
      try {
        // Upload to IPFS
        verboseLogger.debug('Uploading to IPFS via Pinata');
        const updatedTx = await ipfsManager.saveTransactionToIPFS(tx);
        
        // Get IPFS metadata
        const ipfsMetadata = updatedTx.metadata.ipfs;
        
        // Save updated transaction with IPFS metadata
        await transactionManager.saveTransaction(updatedTx);
        
        log.empty();
        log.success(`Transaction exported to IPFS successfully`);
        log.plain(`IPFS CID: ${ipfsMetadata.cid}`);
        log.plain(`IPFS URI: ${ipfsMetadata.url}`);
        log.plain(`Gateway URL: ${ipfsMetadata.gateway}`);
        
        return true;
      } catch (error) {
        log.error(`Failed to export to IPFS: ${error.message}`);
        return false;
      }
    }
    
    // Handle local file export
    verboseLogger.debug('Local file export requested');
    
    // Determine output directory
    let outDir = destination || path.join(os.homedir(), 'safer-exports');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    // Export to local file using configProvider's transactionToFile method
    const fileData = transactionManager.transactionToFile(tx);
    const outPath = path.join(outDir, fileData.filename);
    fs.writeFileSync(outPath, fileData.content);
    
    log.success(`Transaction exported successfully`);
    log.plain(`Path: ${outPath}`);
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Handle importing a transaction from file or IPFS
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleImportTransaction(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Import transaction command started');
    
    const filePath = options.import;
    verboseLogger.debug(`Import path: ${filePath}`);
    
    let tx;
    
    // Check if it's an IPFS link
    if (filePath.startsWith('ipfs://') || filePath.includes('ipfs.io')) {
      verboseLogger.debug('IPFS link detected, attempting to fetch');
      
      try {
        // Extract IPFS CID
        const cid = ipfsManager.parseCidFromUri(filePath);
        verboseLogger.debug(`IPFS CID: ${cid}`);
        
        // Load from IPFS
        tx = await ipfsManager.loadTransactionFromIPFS(cid);
        verboseLogger.debug('Successfully loaded transaction from IPFS');
      } catch (error) {
        log.error(`Failed to fetch from IPFS: ${error.message}`);
        return false;
      }
    } else {
      // Local file
      if (!fs.existsSync(filePath)) {
        log.error(`File not found: ${filePath}`);
        return false;
      }
      
      verboseLogger.debug('Reading local file');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      tx = await transactionManager.importTransaction(fileContent);
      verboseLogger.debug('Successfully loaded transaction from file');
    }
    
    // Save transaction
    verboseLogger.debug(`Saving transaction with hash: ${tx.hash}`);
    await transactionManager.saveTransaction(tx);
    
    log.empty();
    log.success(`Transaction imported successfully`);
    log.plain(`Transaction Hash: ${hash(tx.hash)}`);
    log.plain(`Type: ${formatTransactionType(tx)}`);
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Handle opening the transactions directory
 * 
 * @param {Object} options - CLI options
 * @returns {boolean} Success or failure
 */
async function handleOpenDirectory(options) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(options.verbose);
    verboseLogger.debug('Open transactions directory command started');
    
    // Get the transactions directory path
    const txDir = path.join(os.homedir(), PATHS.TX_DIR);
    verboseLogger.debug(`Transactions directory: ${txDir}`);
    
    // Ensure the directory exists
    if (!fs.existsSync(txDir)) {
      verboseLogger.debug('Creating transactions directory');
      fs.mkdirSync(txDir, { recursive: true });
    }
    
    // Determine the open command based on the platform
    let command;
    switch (process.platform) {
      case 'darwin':
        command = `open "${txDir}"`;
        break;
      case 'win32':
        command = `explorer "${txDir}"`;
        break;
      case 'linux':
        command = `xdg-open "${txDir}"`;
        break;
      default:
        log.error(`Unsupported platform: ${process.platform}`);
        return false;
    }
    
    verboseLogger.debug(`Executing command: ${command}`);
    
    // Execute the command to open the directory
    exec(command, (err) => {
      if (err) {
        log.error(`Failed to open directory: ${err.message}`);
        return;
      }
      verboseLogger.debug('Directory opened successfully');
    });
    
    log.empty();
    log.success(`Opening transactions directory: ${txDir}`);
    
    return true;
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

/**
 * Handle transactions command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} options - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleTransactions(globalOptions, options) {
  try {
    // Combine options
    const combinedOptions = { ...globalOptions, ...options };
    
    // Define verbose logger
    const verboseLogger = createVerboseLogger(combinedOptions.verbose);
    verboseLogger.debug('Transactions command started');
    
    if (options.import) {
      verboseLogger.debug(`Importing transaction from: ${options.import}`);
      return await handleImportTransaction(options);
    } else if (options.export) {
      verboseLogger.debug(`Exporting transaction: ${options.export}`);
      return await handleExportTransaction(options);
    } else if (options.openDir) {
      verboseLogger.debug('Opening transactions directory');
      return await handleOpenDirectory(options);
    } else if (options.show) {
      verboseLogger.debug(`Show transaction details for: ${options.show}`);
      return await handleTransactionDetails(options);
    } else {
      verboseLogger.debug('Listing all transactions');
      return await handleListTransactions(options);
    }
  } catch (err) {
    return handleError(err, options.verbose);
  }
}

module.exports = handleTransactions;

// export displayTransactionDetails as a named export
module.exports.displayTransactionDetails = displayTransactionDetails; 