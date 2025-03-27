/**
 * CLI Error Handlers
 * Utility functions for handling errors in the CLI interface
 */
const { log } = require('./logger');
const { 
  InvalidParameterError,
  SigningError,
  SafeNotConfiguredError,
  TransactionNotFoundError,
  InsufficientBalanceError,
  ExecutionError
} = require('@safer-sh/core').exceptions;

/**
 * Unified error handler for CLI commands
 * 
 * @param {Error} err - The error to handle
 * @param {boolean} verbose - Whether to show detailed error information
 * @returns {boolean} Always returns false to indicate error
 */
function handleError(err, verbose = false) {
  // Handle specific error types
  if (err instanceof InvalidParameterError) {
    log.error(`Invalid parameter: ${err.paramName}`);
    if (err.message) {
      log.secondary(`  ${err.message}`);
    }
  } else if (err instanceof InsufficientBalanceError) {
    log.error(`Insufficient balance: ${err.available} ${err.token} < ${err.required} ${err.token}`);
  } else if (err instanceof TransactionNotFoundError) {
    log.error(`Transaction not found: ${err.txHash}`);
  } else if (err instanceof SafeNotConfiguredError) {
    log.error(`Safe not configured: ${err.message}`);
    log.secondary('  Use --safe parameter or set a default Safe address');
  } else if (err instanceof SigningError) {
    log.error(`Signing error: ${err.message}`);
    if (err.details && verbose) {
      log.secondary(`  Details: ${JSON.stringify(err.details)}`);
    }
  } else if (err instanceof ExecutionError) {
    log.error(`Execution error: ${err.message}`);
    if (err.details && verbose) {
      log.secondary(`  Details: ${JSON.stringify(err.details)}`);
    }
  } else if (err.code) {
    // Handle errors with codes (usually from libraries)
    log.error(`Error: ${err.message}`);
    if (verbose) {
      log.secondary(`  Code: ${err.code}`);
    }
  } else {
    // Unexpected errors
    log.error(`Unexpected error: ${err.message}`);
    
    // Show stack trace in verbose mode
    if (verbose) {
      log.secondary('\nStack trace:');
      log.secondary(err.stack);
    } else {
      log.warning('Run with --verbose flag for more details');
    }
  }
  
  return false;
}

module.exports = {
  handleError
}; 