/**
 * Exceptions for Safer wallet
 * This file contains custom exception classes used across the application
 */

/**
 * Base error class for all Safer errors
 */
class SaferError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SaferError';
    this.code = code;
  }
}

/**
 * Error thrown when a parameter is missing or invalid
 */
class InvalidParameterError extends SaferError {
  constructor(paramName, message) {
    super(message || `Invalid parameter: ${paramName}`, 'INVALID_PARAMETER');
    this.name = 'InvalidParameterError';
    this.paramName = paramName;
  }
}

/**
 * Error thrown when balance is insufficient for transaction
 */
class InsufficientBalanceError extends SaferError {
  constructor(available, required, token = 'ETH') {
    super(`Insufficient balance: ${available} ${token} < ${required} ${token}`, 'INSUFFICIENT_BALANCE');
    this.name = 'InsufficientBalanceError';
    this.available = available;
    this.required = required;
    this.token = token;
  }
}

/**
 * Error thrown when a transaction is not found
 */
class TransactionNotFoundError extends SaferError {
  constructor(txHash) {
    super(`Transaction not found: ${txHash}`, 'TX_NOT_FOUND');
    this.name = 'TransactionNotFoundError';
    this.txHash = txHash;
  }
}

/**
 * Error thrown when a Safe wallet is not configured
 */
class SafeNotConfiguredError extends SaferError {
  constructor(message) {
    super(message || 'No Safe address specified', 'SAFE_NOT_CONFIGURED');
    this.name = 'SafeNotConfiguredError';
  }
}

/**
 * Error thrown when a signing operation fails
 */
class SigningError extends SaferError {
  constructor(message, details) {
    super(message, 'SIGNING_ERROR');
    this.name = 'SigningError';
    this.details = details;
  }
}

/**
 * Error thrown when an execution operation fails
 */
class ExecutionError extends SaferError {
  constructor(message, details) {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
    this.details = details;
  }
}

/**
 * Error thrown when there are insufficient signatures to execute a transaction
 */
class InsufficientSignaturesError extends SaferError {
  constructor(message, current, required) {
    super(message || `Insufficient signatures to execute: ${current}/${required}`, 'INSUFFICIENT_SIGNATURES');
    this.name = 'InsufficientSignaturesError';
    this.current = current;
    this.required = required;
  }
}

/**
 * Error thrown when a transaction execution fails
 */
class TransactionExecutionError extends SaferError {
  constructor(message, details) {
    super(message, 'TX_EXECUTION_ERROR');
    this.name = 'TransactionExecutionError';
    this.details = details;
  }
}

/**
 * Error thrown when gas estimation fails
 */
class GasEstimationError extends SaferError {
  constructor(message, details) {
    super(message, 'GAS_ESTIMATION_ERROR');
    this.name = 'GasEstimationError';
    this.details = details;
  }
}

module.exports = {
  SaferError,
  InvalidParameterError,
  InsufficientBalanceError,
  TransactionNotFoundError,
  SafeNotConfiguredError,
  SigningError,
  ExecutionError,
  InsufficientSignaturesError,
  TransactionExecutionError,
  GasEstimationError
}; 