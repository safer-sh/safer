/**
 * CLI Logger
 * Centralized logging utility for CLI interface
 */
const { ethers } = require('ethers');
const { COLORS } = require('@safer-sh/common/constants');

/**
 * Format text with ANSI color codes
 * 
 * @param {string} text - Text to format
 * @param {string} color - Color code from COLORS constant
 * @param {boolean} bold - Whether to make text bold
 * @returns {string} Formatted text
 */
function formatText(text, color, bold = false) {
  const boldCode = bold ? COLORS.BOLD : '';
  return `${color}${boldCode}${text}${COLORS.RESET}`;
}

/**
 * Format success message
 * 
 * @param {string} text - Success message
 * @returns {string} Formatted success message
 */
function success(text) {
  return formatText(`✓ ${text}`, COLORS.GREEN);
}

/**
 * Format error message
 * 
 * @param {string} text - Error message
 * @returns {string} Formatted error message
 */
function error(text) {
  return formatText(`✗ ${text}`, COLORS.RED);
}

/**
 * Format warning message
 * 
 * @param {string} text - Warning message
 * @returns {string} Formatted warning message
 */
function warning(text) {
  return formatText(`! ${text}`, COLORS.YELLOW);
}

/**
 * Format info message
 * 
 * @param {string} text - Info message
 * @returns {string} Formatted info message
 */
function info(text) {
  return formatText(`ℹ ${text}`, COLORS.BLUE);
}

/**
 * Format secondary info (less important information)
 * 
 * @param {string} text - Secondary info
 * @returns {string} Formatted secondary info
 */
function secondary(text) {
  return formatText(text, COLORS.GRAY);
}

/**
 * Format a header text
 * 
 * @param {string} text - Header text
 * @returns {string} Formatted header
 */
function header(text) {
  return formatText(text, COLORS.CYAN, true);
}

/**
 * Format transaction hash
 * 
 * @param {string} hash - Transaction hash
 * @returns {string} Formatted transaction hash
 */
function hash(hash) {
  return formatText(hash, COLORS.YELLOW);
}

/**
 * Format address
 * 
 * @param {string} address - Ethereum address
 * @returns {string} Formatted address
 */
function address(address) {
  return formatText(address, COLORS.MAGENTA);
}

/**
 * Format ETH amount
 * 
 * @param {string|ethers.BigNumber} amount - Amount in wei
 * @returns {string} Formatted ETH amount
 */
function amount(amount, tokenSymbol = 'ETH') {
  const formattedAmount = ethers.BigNumber.isBigNumber(amount) 
    ? ethers.utils.formatEther(amount) 
    : amount;
  return formatText(`${formattedAmount} ${tokenSymbol}`, COLORS.GREEN);
}

/**
 * Format debug message
 * 
 * @param {string} text - Debug message
 * @returns {string} Formatted debug message
 */
function debug(text) {
  return formatText(`[DEBUG] ${text}`, COLORS.GRAY);
}

// Logging Functionality

/**
 * Standard logger that handles normal output
 */
const log = {
  /**
   * Log a success message
   * @param {string} message - Success message
   */
  success: (message) => console.log(success(message)),
  
  /**
   * Log an error message
   * @param {string} message - Error message
   */
  error: (message) => console.error(error(message)),
  
  /**
   * Log a warning message
   * @param {string} message - Warning message
   */
  warning: (message) => console.log(warning(message)),
  
  /**
   * Log an info message
   * @param {string} message - Info message
   */
  info: (message) => console.log(info(message)),
  
  /**
   * Log a secondary message
   * @param {string} message - Secondary message
   */
  secondary: (message) => console.log(secondary(message)),
  
  /**
   * Log a header
   * @param {string} message - Header message
   */
  header: (message) => console.log(header(message)),
  
  /**
   * Log a plain message
   * @param {string} message - Plain message
   */
  plain: (message) => console.log(message),
  
  /**
   * Log an empty line
   */
  empty: () => console.log('')
};

/**
 * Create a verbose logger that only logs when verbose mode is enabled
 * 
 * @param {boolean} isVerbose - Whether verbose mode is enabled
 * @returns {Object} Verbose logger
 */
function createVerboseLogger(isVerbose) {
  return {
    /**
     * Log a debug message if verbose mode is enabled
     * @param {string} message - Debug message
     */
    debug: (message) => {
      if (isVerbose) {
        console.log(debug(message));
      }
    },
    
    /**
     * Log a success message if verbose mode is enabled
     * @param {string} message - Success message
     */
    success: (message) => {
      if (isVerbose) {
        console.log(success(message));
      }
    },
    
    /**
     * Log an info message if verbose mode is enabled
     * @param {string} message - Info message
     */
    info: (message) => {
      if (isVerbose) {
        console.log(info(message));
      }
    }
  };
}

/**
 * Print loading message (for async operations)
 * 
 * @param {string} text - Loading message
 */
function loading(text) {
  console.log(formatText(`${text}...`, COLORS.CYAN));
}

/**
 * Format ETH transfer information
 * 
 * @param {Object} result - Transfer result object
 */
function formatETHTransfer(result) {
  const { metadata } = result;
  
  log.empty();
  log.header('ETH TRANSFER DETAILS');
  log.plain(`Safe Address: ${address(metadata.safeAddress)}`);
  log.plain(`Transfer Amount: ${amount(metadata.amountFormatted)}`);
  log.plain(`Recipient: ${address(metadata.to)}`);
}

/**
 * Format ERC20 transfer information
 * 
 * @param {Object} result - Transfer result object
 */
function formatERC20Transfer(result) {
  const { metadata } = result;
  
  log.empty();
  log.header('ERC20 TRANSFER DETAILS');
  log.plain(`Safe Address: ${address(metadata.safeAddress)}`);
  log.plain(`Token Contract: ${address(metadata.tokenAddress)}`);
  log.plain(`Token Symbol: ${formatText(metadata.tokenSymbol, COLORS.YELLOW)}`);
  log.plain(`Transfer Amount: ${amount(metadata.amountFormatted, metadata.tokenSymbol)}`);
  log.plain(`Recipient: ${address(metadata.to)}`);
}

/**
 * Format transaction signing information
 * 
 * @param {Object} result - Signing result object
 */
function formatSigningResult(result) {
  const { txHash, signerAddress } = result;
  
  log.empty();
  log.header('TRANSACTION SIGNED');
  log.plain(`Transaction: ${hash(txHash)}`);
  log.plain(`Signer: ${address(signerAddress)}`);
}

/**
 * Format transaction execution information
 * 
 * @param {Object} result - Execution result object
 */
function formatExecutionResult(result) {
  log.empty();
  log.header('TRANSACTION EXECUTED');
  
  // Handle different result formats for backward compatibility
  const safeTxHash = result.safeTxHash || result.txHash;
  const executionHash = result.executionHash || result.ethTxHash;
  
  log.plain(`Safe Transaction: ${hash(safeTxHash)}`);
  if (executionHash) {
    log.plain(`Ethereum Transaction: ${hash(executionHash)}`);
  } else {
    log.warning('No blockchain transaction hash available.');
  }
  
  // Add additional information if available
  if (result.executionBlock) {
    log.plain(`Block Number: ${result.executionBlock}`);
  }
  
  if (result.executionGasUsed) {
    log.plain(`Gas Used: ${result.executionGasUsed}`);
  }
}

module.exports = {
  // Formatting functions
  formatText,
  success,
  error,
  warning,
  info,
  secondary,
  header,
  hash,
  address,
  amount,
  debug,
  
  // Direct logging functions
  log,
  
  // Verbose logging
  createVerboseLogger,
  
  // Specialized formatting functions
  loading,
  formatETHTransfer,
  formatERC20Transfer,
  formatSigningResult,
  formatExecutionResult
}; 