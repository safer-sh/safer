/**
 * File-based transaction manager implementation
 * Provides read and write operations for transaction files
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import required dependencies
const { PATHS } = require('../constants');
const { SaferTransaction } = require('@safer-sh/core');
const { TransactionNotFoundError } = require('@safer-sh/core').exceptions;
const { parseChain } = require('./utils');

class FileTransactionManager {
  constructor(configManager) {
    // Base transaction directory
    this.baseTxDirectory = path.join(os.homedir(), PATHS.TX_DIR);
    
    // Store reference to configManager if provided
    this.configManager = configManager;
  }

  /**
   * Get transaction directory for the specified safeAddress and chain
   * @param {string} safeAddress - Safe address
   * @param {string|number} chain - Chain name or ID
   * @returns {string} Path to the transaction directory
   */
  getTxDirectory(safeAddress, chain) {
    if(!safeAddress) {
      safeAddress = this.configManager.getSafeAddress();
    }
    if(!chain) {
      chain = this.configManager.getChain();
    }

    // Parse chain to get networkName
    const { networkName } = parseChain(chain);
    
    // Create and return path with structure: ~/.safer/transactions/{safeAddress}/{networkName}
    return path.join(this.baseTxDirectory, safeAddress, networkName);
  }

  /**
   * Ensure transaction directory exists
   * @param {string} safeAddress - Safe address (optional)
   * @param {string|number} chain - Chain name or ID (optional)
   * @returns {string} Path to the created/existing directory
   */
  ensureTxDirectory(safeAddress, chain) {
    // Get the directory path
    const txDirectory = this.getTxDirectory(safeAddress, chain);
    
    // Create if it doesn't exist
    if (!fs.existsSync(txDirectory)) {
      fs.mkdirSync(txDirectory, { recursive: true });
    }
    
    return txDirectory;
  }

  /**
   * Save transaction to file
   * 
   * @param {SaferTransaction} transaction - Transaction to save
   * @returns {Promise<SaferTransaction>} Saved transaction
   */
  async saveTransaction(transaction) {
    // Validate input
    if (!(transaction instanceof SaferTransaction)) {
      throw new Error('Transaction must be a SaferTransaction instance');
    }
    
    try {
      // Get safeAddress from transaction.metadata
      const safeAddress = transaction.metadata?.safeAddress;
      
      // Get chainId from transaction and use it as chain parameter
      const chain = transaction.chainId;
      
      // Ensure transaction directory exists with the specific safeAddress and chain
      const txDirectory = this.ensureTxDirectory(safeAddress, chain);
      
      // Get file data using the transactionToFile method
      const fileData = this.transactionToFile(transaction);
      
      // Get file path using the filename from fileData
      const txFilePath = path.join(txDirectory, fileData.filename);
      
      // Write to file
      fs.writeFileSync(txFilePath, fileData.content);
      
      return transaction;
    } catch (error) {
      throw new Error(`Failed to save transaction: ${error.message}`);
    }
  }
  
  /**
   * Load transaction from file
   * 
   * @param {string} txInput - Transaction hash, partial hash, or nonce
   * @param {string} safeAddress - Safe address (optional)
   * @param {string|number} chain - Chain name or ID (optional)
   * @returns {Promise<SaferTransaction>} Loaded transaction
   * @throws {TransactionNotFoundError} If transaction is not found
   */
  async loadTransaction(txInput, safeAddress, chain) {
    try {
      if (!safeAddress) {
        safeAddress = this.configManager.getSafeAddress();
      }
      if (!chain) {
        chain = this.configManager.getChain();
      }
      
      // Get transaction directory based on safeAddress and chain
      const txDirectory = this.ensureTxDirectory(safeAddress, chain);
      
      // If specific directory doesn't exist or is empty, check the base directory
      let searchDirectories = [txDirectory];
      
      // Only add base directory if it's different from the specific directory
      if (txDirectory !== this.baseTxDirectory && fs.existsSync(this.baseTxDirectory)) {
        searchDirectories.push(this.baseTxDirectory);
      }
      
      // Search in each directory
      for (const directory of searchDirectories) {
        if (!fs.existsSync(directory)) {
          continue;
        }
        
        const files = fs.readdirSync(directory).filter(f => f.endsWith('.safer'));
        
        if (files.length === 0) {
          continue;
        }
        
        // Case 1: Full hash (0x...)
        if (typeof txInput === 'string' && txInput.startsWith('0x')) {
          const txHash = txInput.toLowerCase();
          
          // For full hash, first try loading all transactions and find an exact match
          const transactions = [];
          
          for (const file of files) {
            try {
              const filePath = path.join(directory, file);
              const fileContent = fs.readFileSync(filePath, 'utf8');
              const tx = this.transactionFromFile(fileContent);
              transactions.push(tx);
              
              // Early return if we find an exact match
              if (tx.hash.toLowerCase() === txHash) {
                return tx;
              }
            } catch (error) {
              // Skip if we can't parse a transaction file
              continue;
            }
          }
          
          // If we reach here, we didn't find an exact match
          // For a full hash, also try the last 8 characters to match the file naming convention
          if (txHash.length === 66) {
            const shortHash = txHash.slice(-8);
            
            const matchingFile = files.find(file => file.includes(shortHash));
            
            if (matchingFile) {
              const txFilePath = path.join(directory, matchingFile);
              const fileContent = fs.readFileSync(txFilePath, 'utf8');
              return this.transactionFromFile(fileContent);
            }
          }
          
          // If not found in this directory, continue to the next
          continue;
        }
        // Case 2: Numeric input (nonce)
        else if (!isNaN(txInput)) {
          const nonce = parseInt(txInput, 10);
          // Find file that starts with the nonce followed by a dash
          const matchingFile = files.find(file => {
            const parts = file.split('-');
            return parts.length > 1 && parseInt(parts[0], 10) === nonce;
          });
          
          if (matchingFile) {
            const txFilePath = path.join(directory, matchingFile);
            const fileContent = fs.readFileSync(txFilePath, 'utf8');
            return this.transactionFromFile(fileContent);
          }
          
          // If not found in this directory, continue to the next
          continue;
        }
        // Case 3: Partial hash (non-numeric string)
        else if (typeof txInput === 'string') {
          const partialHash = txInput.toLowerCase();
          
          // Try to match against file names
          const matchingFiles = files.filter(file => 
            file.toLowerCase().includes(partialHash)
          );
          
          if (matchingFiles.length === 0) {
            // If not found in this directory, continue to the next
            continue;
          }
          
          // If multiple files match, sort by nonce (higher nonce first)
          if (matchingFiles.length > 1) {
            matchingFiles.sort((a, b) => {
              const nonceA = parseInt(a.split('-')[0], 10);
              const nonceB = parseInt(b.split('-')[0], 10);
              return nonceB - nonceA; // Higher nonce first (more recent)
            });
          }
          
          // Take the first (highest nonce) matching file
          const txFilePath = path.join(directory, matchingFiles[0]);
          const fileContent = fs.readFileSync(txFilePath, 'utf8');
          return this.transactionFromFile(fileContent);
        }
      }
      
      // If we reach here, transaction was not found in any directory
      throw new TransactionNotFoundError(`Invalid input: ${txInput}`);
    } catch (error) {
      if (error instanceof TransactionNotFoundError) {
        throw error;
      }
      throw new Error(`Failed to load transaction: ${error.message}`);
    }
  }
  
  /**
   * List all transactions
   * 
   * @param {Object} options - Options for listing transactions
   * @param {boolean} [options.ascending=false] - Sort in ascending order by createDate
   * @param {string} [options.sortBy='createDate'] - Field to sort by
   * @param {string} [options.safeAddress] - Filter by safe address
   * @param {string|number} [options.chain] - Filter by chain name or ID
   * @returns {Promise<SaferTransaction[]>} List of transactions
   */
  async listTransactions(options = {}) {
    const sortBy = options?.sortBy || 'createDate';
    const ascending = options?.ascending !== undefined ? options.ascending : false;
    const safeAddress = options?.safeAddress;
    const chain = options?.chain;
    
    try {
      // Get the transaction directory based on safeAddress and chain
      const txDirectory = this.ensureTxDirectory(safeAddress, chain);
      
      // Collect all transaction files from the directory
      let files = [];
      if (fs.existsSync(txDirectory)) {
        files = fs.readdirSync(txDirectory).filter(f => f.endsWith('.safer'));
      }
      
      // Load each transaction
      const transactionList = [];
      for (const file of files) {
        const filePath = path.join(txDirectory, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const transaction = this.transactionFromFile(fileContent);
        transactionList.push(transaction);
      }
      
      // Sort transactions
      transactionList.sort((a, b) => {
        // First, sort by nonce (higher nonce first by default)
        const nonceA = parseInt(a.nonce, 10);
        const nonceB = parseInt(b.nonce, 10);
        
        if (nonceA !== nonceB) {
          return ascending ? nonceA - nonceB : nonceB - nonceA;
        }
        
        // If nonces are equal, sort by the specified field
        if (sortBy === 'createDate') {
          const dateA = new Date(a.createDate).getTime();
          const dateB = new Date(b.createDate).getTime();
          return ascending ? dateA - dateB : dateB - dateA;
        }
        
        // For any other fields
        const valueA = a[sortBy];
        const valueB = b[sortBy];
        
        if (valueA < valueB) return ascending ? -1 : 1;
        if (valueA > valueB) return ascending ? 1 : -1;
        return 0;
      });
      
      return transactionList;
    } catch (error) {
      throw new Error(`Failed to list transactions: ${error.message}`);
    }
  }
  
  /**
   * Update transaction status
   * 
   * @param {string} txHash - Transaction hash
   * @param {string} status - New status
   * @param {Object} [additionalData={}] - Additional data to update
   * @param {string} [safeAddress] - Safe address
   * @param {string|number} [chain] - Chain name or ID
   * @returns {Promise<SaferTransaction>} Updated transaction
   */
  async updateTransactionStatus(txHash, status, additionalData = {}, safeAddress, chain) {
    try {
      // Load existing transaction
      const transaction = await this.loadTransaction(txHash, safeAddress, chain);
      
      // Update status
      const updatedTransaction = transaction.updateStatus(status);
      
      // Update additional data in metadata
      if (Object.keys(additionalData).length > 0) {
        updatedTransaction.metadata = {
          ...updatedTransaction.metadata,
          ...additionalData
        };
      }
      
      // Save updated transaction
      return await this.saveTransaction(updatedTransaction);
    } catch (error) {
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }

  /**
   * Import transaction from file
   * 
   * @param {string} fileContent - Transaction file content
   * @returns {Promise<SaferTransaction>} Imported transaction
   */
  async importTransaction(fileContent) {
    try {
      // Parse file content and create SaferTransaction
      return this.transactionFromFile(fileContent);
    } catch (error) {
      throw new Error(`Failed to import transaction: ${error.message}`);
    }
  }

  /**
   * Convert a SaferTransaction to file format
   * 
   * @param {SaferTransaction} transaction - The transaction to convert
   * @returns {Object} Object with filename and file content
   */
  transactionToFile(transaction) {
    if (!(transaction instanceof SaferTransaction)) {
      throw new Error('Transaction must be a SaferTransaction instance');
    }
    
    // Get last 8 characters of hash
    const hashSuffix = transaction.hash.slice(-8);
    
    // Generate filename using nonce instead of timestamp
    const filename = `${transaction.nonce}-${hashSuffix}.safer`;
    
    // Create serializable object (exclude methods)
    const fileData = {
      version: '0.1.1', // For future compatibility
      type: 'SaferTransaction',
      data: {
        hash: transaction.hash,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        operation: transaction.operation,
        safeTxGas: transaction.safeTxGas,
        baseGas: transaction.baseGas,
        gasPrice: transaction.gasPrice,
        gasToken: transaction.gasToken,
        refundReceiver: transaction.refundReceiver,
        nonce: transaction.nonce,
        signatures: transaction.signatures,
        createDate: transaction.createDate,
        status: transaction.status,
        metadata: transaction.metadata,
        chainId: transaction.chainId,
        executionDate: transaction.executionDate,
        isExecuted: transaction.isExecuted,
        isSuccessful: transaction.isSuccessful
      }
    };
    
    // Serialize to JSON
    const fileContent = JSON.stringify(fileData, null, 2);
    
    return {
      filename,
      content: fileContent
    };
  }

  /**
   * Create a SaferTransaction from file content
   * 
   * @param {string} fileContent - JSON file content
   * @returns {SaferTransaction} SaferTransaction instance
   * @throws {Error} If file content is invalid
   */
  transactionFromFile(fileContent) {
    // Parse JSON
    let fileData;
    try {
      fileData = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    
    // Validate file structure
    if (!fileData.version) {
      throw new Error('Missing file version');
    }
    
    if (fileData.type !== 'SaferTransaction') {
      throw new Error(`Invalid file type: ${fileData.type}`);
    }
    
    if (!fileData.data) {
      throw new Error('Missing transaction data');
    }
    
    const txData = fileData.data;
    
    // Validate required fields
    if (!txData.hash) {
      throw new Error('Missing transaction hash');
    }
    
    if (!txData.to) {
      throw new Error('Missing transaction to address');
    }
    
    if (txData.nonce === undefined) {
      throw new Error('Missing transaction nonce');
    }

    if (!txData.chainId) {
      throw new Error('Missing transaction chainId');
    }
    
    // Create SaferTransaction instance
    return new SaferTransaction({
      hash: txData.hash,
      to: txData.to,
      value: txData.value,
      data: txData.data,
      operation: txData.operation,
      safeTxGas: txData.safeTxGas,
      baseGas: txData.baseGas,
      gasPrice: txData.gasPrice,
      gasToken: txData.gasToken,
      refundReceiver: txData.refundReceiver,
      nonce: txData.nonce,
      signatures: txData.signatures || {},
      createDate: txData.createDate,
      status: txData.status,
      metadata: txData.metadata || {},
      chainId: txData.chainId,
      executionDate: txData.executionDate,
      isExecuted: txData.isExecuted,
      isSuccessful: txData.isSuccessful
    });
  }
}

module.exports = FileTransactionManager; 