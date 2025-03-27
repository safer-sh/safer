/**
 * Transaction Service Implementation
 * Provides functionality related to transaction creation and management
 */
const { ethers } = require('ethers');
const { initializeSafeSDK } = require('../utils');
const { SaferTransaction, OPERATION_TYPE, TRANSACTION_STATUS } = require('../transaction');

// Import exceptions
const { 
  InvalidParameterError, 
  InsufficientBalanceError
} = require('../exceptions');

/**
 * Transaction Service Implementation
 */
class TransactionService {
  /**
   * Create ETH transfer transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {string} params.receiverAddress - Receiver address
   * @param {string} params.amount - Amount in ETH
   * @returns {Promise<SaferTransaction>} Transaction object
   */
  async createEthTransferTx(params) {
    const { 
      safeAddress, 
      rpcUrl, 
      chainId, 
      receiverAddress, 
      amount 
    } = params;
    
    // Initialize Safe SDK (read-only mode)
    const { safeSdk, provider } = await initializeSafeSDK({
      safeAddress,
      rpcUrl,
      chainId,
      readOnly: true
    });
    
    // Validate receiver address
    if (!ethers.utils.isAddress(receiverAddress)) {
      throw new InvalidParameterError('receiverAddress', 'Invalid Ethereum address');
    }
    
    // Convert amount to BigNumber
    let amountBN;
    try {
      amountBN = ethers.utils.parseEther(amount);
    } catch (err) {
      throw new InvalidParameterError('amount', 'Invalid ETH amount');
    }
    
    // Get Safe balance
    const safeBalance = await provider.getBalance(safeAddress);
    
    // Check if balance is sufficient
    if (safeBalance.lt(amountBN)) {
      throw new InsufficientBalanceError(
        ethers.utils.formatEther(safeBalance),
        ethers.utils.formatEther(amountBN)
      );
    }
    
    // Create transaction
    const safeTransactionData = {
      to: receiverAddress,
      value: amountBN.toString(),
      data: '0x'
    };
    
    // Build transaction
    const safeTransaction = await safeSdk.createTransaction({ safeTransactionData });
    
    // Generate safeTxHash - required for signing
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    
    // Create SaferTransaction with proper metadata
    return new SaferTransaction({
      hash: safeTxHash,
      to: receiverAddress,
      value: amountBN.toString(),
      data: '0x',
      operation: OPERATION_TYPE.CALL,
      nonce: safeTransaction.data.nonce,
      status: TRANSACTION_STATUS.PENDING,
      chainId,
      metadata: {
        type: 'ethTransfer',
        safeAddress,
        to: receiverAddress,
        amount: amountBN.toString(),
        amountFormatted: ethers.utils.formatEther(amountBN)
      }
    });
  }

  /**
   * Create ERC20 transfer transaction
   * 
   * @param {Object} params - Parameters
   * @param {string} params.safeAddress - Safe address
   * @param {string} params.rpcUrl - Blockchain RPC URL
   * @param {number|string} params.chainId - Chain ID
   * @param {string} params.tokenAddress - Token contract address
   * @param {string} params.receiverAddress - Receiver address
   * @param {string} params.amount - Amount in token units
   * @returns {Promise<SaferTransaction>} Transaction object
   */
  async createErc20TransferTx(params) {
    const { 
      safeAddress, 
      rpcUrl, 
      chainId, 
      tokenAddress,
      receiverAddress, 
      amount 
    } = params;
    
    // Initialize Safe SDK (read-only mode)
    const { safeSdk, provider } = await initializeSafeSDK({
      safeAddress,
      rpcUrl,
      chainId,
      readOnly: true
    });
    
    // Validate addresses
    if (!ethers.utils.isAddress(tokenAddress)) {
      throw new InvalidParameterError('tokenAddress', 'Invalid token address');
    }
    if (!ethers.utils.isAddress(receiverAddress)) {
      throw new InvalidParameterError('receiverAddress', 'Invalid receiver address');
    }
    
    // Create ERC20 contract instance
    const erc20Contract = new ethers.Contract(
      tokenAddress,
      ['function transfer(address to, uint256 value) returns (bool)', 'function balanceOf(address owner) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
      provider
    );
    
    // Get token decimals and symbol
    const [decimals, symbol] = await Promise.all([
      erc20Contract.decimals(),
      erc20Contract.symbol()
    ]);
    
    // Convert amount to BigNumber with proper decimals
    let amountBN;
    try {
      amountBN = ethers.utils.parseUnits(amount, decimals);
    } catch (err) {
      throw new InvalidParameterError('amount', 'Invalid token amount');
    }
    
    // Get token balance
    const tokenBalance = await erc20Contract.balanceOf(safeAddress);
    
    // Check if balance is sufficient
    if (tokenBalance.lt(amountBN)) {
      throw new InsufficientBalanceError(
        ethers.utils.formatUnits(tokenBalance, decimals),
        ethers.utils.formatUnits(amountBN, decimals),
        symbol
      );
    }
    
    // Create transaction data
    const transferData = erc20Contract.interface.encodeFunctionData(
      'transfer',
      [receiverAddress, amountBN]
    );
    
    // Create transaction
    const safeTransactionData = {
      to: tokenAddress,
      value: '0',
      data: transferData
    };
    
    // Build transaction
    const safeTransaction = await safeSdk.createTransaction({ safeTransactionData });
    
    // Generate safeTxHash - required for signing
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    
    // Create SaferTransaction with proper metadata
    return new SaferTransaction({
      hash: safeTxHash,
      to: tokenAddress,
      value: '0',
      data: transferData,
      operation: OPERATION_TYPE.CALL,
      nonce: safeTransaction.data.nonce,
      status: TRANSACTION_STATUS.PENDING,
      chainId,
      metadata: {
        type: 'erc20Transfer',
        safeAddress,
        tokenAddress,
        tokenSymbol: symbol,
        tokenDecimals: decimals,
        to: receiverAddress,
        amount: amountBN.toString(),
        amountFormatted: ethers.utils.formatUnits(amountBN, decimals)
      }
    });
  }
}

// Export TransactionService singleton
module.exports = new TransactionService(); 