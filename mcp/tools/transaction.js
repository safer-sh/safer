/**
 * Transaction tools for MCP
 * Provides tools to manage transactions, including creation, signing, execution, import, and export
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { configManager, transactionManager, ipfsManager } = require('@safer-sh/common/config');
const { PATHS } = require('@safer-sh/common/constants');
const { services } = require('@safer-sh/core');
const { z } = require('zod');
const { resolveOwnerFromIdentifier, initializeSigner } = require('@safer-sh/common/config/utils');
const { ethers } = require('ethers');

/**
 * Register transaction tools to the server
 * @param {Object} server MCP server instance
 */
function registerTransactionTools(server) {
  // Unified transaction management tool
  server.tool(
    "safer_transaction",
    {
      action: z.enum([
        "createEthTransfer", "createErc20Transfer", "sign", "execute", 
        "list", "getDetails", "export", "import", "openDirectory"
      ]),
      // Create transaction parameters (required for create operations only)
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      amount: z.string().min(1).optional(),
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      // Transaction identification parameters
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      nonce: z.string().optional(),
      // Signer and executor parameters
      signerIdentifier: z.string().optional(),
      executorIdentifier: z.string().optional(),
      // Gas parameters
      gasBoost: z.string().optional(),
      gasLimit: z.string().optional(),
      gasPrice: z.string().optional(),
      maxFeePerGas: z.string().optional(),
      maxPriorityFeePerGas: z.string().optional(),
      // Import/export parameters
      source: z.string().optional(),
      destination: z.string().optional(),
      // List parameters
      status: z.string().optional()
    },
    async (params) => {
      try {
        const { action, ...actionParams } = params;
        
        switch (action) {
          case "createEthTransfer":
            return await handleCreateEthTransfer(actionParams);
          case "createErc20Transfer":
            return await handleCreateErc20Transfer(actionParams);
          case "sign":
            return await handleSignTransaction(actionParams);
          case "execute":
            return await handleExecuteTransaction(actionParams);
          case "list":
            return await handleListTransactions(actionParams);
          case "getDetails":
            return await handleGetTransactionDetails(actionParams);
          case "export":
            return await handleExportTransaction(actionParams);
          case "import":
            return await handleImportTransaction(actionParams);
          case "openDirectory":
            return await handleOpenTransactionDirectory();
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Error in transaction operation: ${error.message}`
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Handle create ETH transfer operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleCreateEthTransfer({ safeAddress, recipient, amount }) {
  // Get chain info from config
  const { chain, rpcUrl, chainId } = await configManager.readConfig();
  
  // Validate parameters
  if (!safeAddress) {
    throw new Error('Safe address is required. Please provide a valid Safe address.');
  }
  if (!recipient) {
    throw new Error('Recipient address is required. Please provide a valid recipient address.');
  }
  if (!amount) {
    throw new Error('Amount is required. Please provide a valid amount to transfer.');
  }
  
  try {
    // Create transaction
    const result = await services.transactionService.createEthTransferTx({
      safeAddress,
      rpcUrl,
      chainId,
      receiverAddress: recipient,
      amount
    });
    
    // Get Safe information
    const safeInfo = await services.safeService.getSafeInfo({
      safeAddress,
      rpcUrl,
      chainId
    });
    
    // Add owners to metadata if not already present
    if (!result.metadata.owners) {
      result.metadata.owners = safeInfo.owners;
    }
    
    // Save transaction
    await transactionManager.saveTransaction(result);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `ETH transfer transaction created successfully!`,
          details: {
            txHash: result.hash,
            safeAddress,
            recipient,
            amount,
            network: chain,
            chainId
          },
          nextSteps: [
            `Sign this transaction: safer_transaction sign --tx-hash ${result.hash} --signer <identifier>`,
            `View transaction details: safer_transaction getDetails --tx-hash ${result.hash}`
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    // Provide more specific error messages and suggestions
    let message = error.message;
    let suggestion = '';
    
    if (error.message.includes('Safe') && error.message.includes('deployed')) {
      message = `Safe address ${safeAddress} is not deployed on ${chain} (Chain ID: ${chainId})`;
      suggestion = 'Please check that your Safe address is correct and deployed on the selected network.';
    } else if (error.message.includes('insufficient funds')) {
      message = `Insufficient funds in Safe wallet ${safeAddress}`;
      suggestion = 'Please make sure your Safe has enough ETH to cover this transaction.';
    } else if (error.message.includes('RPC')) {
      message = `Network connection error with RPC endpoint`;
      suggestion = 'Please check your internet connection and RPC URL configuration.';
    }
    
    throw new Error(`Failed to create transaction: ${message}. ${suggestion}`);
  }
}

/**
 * Handle create ERC20 transfer operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleCreateErc20Transfer({ safeAddress, tokenAddress, recipient, amount }) {
  // Get chain info from config
  const { rpcUrl, chainId } = await configManager.readConfig();

  // Create transaction
  const result = await services.transactionService.createErc20TransferTx({
    safeAddress,
    rpcUrl,
    chainId,
    tokenAddress,
    receiverAddress: recipient,
    amount
  });
  
  // Get Safe information
  const safeInfo = await services.safeService.getSafeInfo({
    safeAddress,
    rpcUrl,
    chainId
  });
  
  // Add owners to metadata if not already present
  if (!result.metadata.owners) {
    result.metadata.owners = safeInfo.owners;
  }
  
  // Save transaction
  await transactionManager.saveTransaction(result);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: `ERC20 transfer transaction created successfully`,
        txHash: result.hash,
        safeAddress,
        tokenAddress,
        recipient,
        amount
      }, null, 2)
    }]
  };
}

/**
 * Handle sign transaction operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleSignTransaction({ txHash, nonce, signerIdentifier, safeAddress }) {
  try {
    // Load transaction using either txHash or nonce
    const transaction = await transactionManager.loadTransaction(txHash || nonce);
    
    // Get chain info from config
    const { chainId, rpcUrl, owners } = await configManager.readConfig();
    
    // Use provided safeAddress, transaction safeAddress, or default from config
    let targetSafeAddress = safeAddress || transaction.metadata.safeAddress;
    
    // If still no safeAddress, get the default from config
    if (!targetSafeAddress) {
      targetSafeAddress = config.defaultSafe;
    }
    
    // If still no safeAddress, throw error
    if (!targetSafeAddress) {
      throw new Error('No Safe address specified. Please provide a safeAddress parameter or set a default Safe in your configuration.');
    }
    
    // Find owner configuration
    if (!owners || !Array.isArray(owners) || owners.length === 0) {
      throw new Error('No owners configured');
    }
    
    // Find owner using the identifier resolver function
    const ownerConfig = resolveOwnerFromIdentifier(signerIdentifier, owners);
    
    if (!ownerConfig) {
      throw new Error(`Owner not found with identifier: ${signerIdentifier}`);
    }
    
    // Initialize signer
    const signer = await initializeSigner(ownerConfig, rpcUrl);
    
    // Sign transaction
    const signResult = await services.signService.signTransaction({
      safeAddress: targetSafeAddress,
      rpcUrl,
      chainId,
      transaction,
      signer
    });
    
    // Save signed transaction
    await transactionManager.saveTransaction(signResult.transaction);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Transaction signed successfully by ${ownerConfig.address}`,
          txHash: signResult.transaction.hash,
          safeAddress: targetSafeAddress,
          signerAddress: ownerConfig.address
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to sign transaction: ${error.message}`);
  }
}

/**
 * Handle execute transaction operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleExecuteTransaction({ 
  txHash, nonce, executorIdentifier, gasLimit, 
  gasPrice, gasBoost, safeAddress
}) {
  try {
    // Load transaction using either txHash or nonce
    const transaction = await transactionManager.loadTransaction(txHash || nonce);
    
    // Get chain info from config
    const { chainId, rpcUrl, owners } = await configManager.readConfig();
    
    // Use provided safeAddress, transaction safeAddress, or default from config
    let targetSafeAddress = safeAddress || transaction.metadata.safeAddress;
    
    // If still no safeAddress, get the default from config
    if (!targetSafeAddress) {
      targetSafeAddress = config.defaultSafe;
    }
    
    // If still no safeAddress, throw error
    if (!targetSafeAddress) {
      throw new Error('No Safe address specified. Please provide a safeAddress parameter or set a default Safe in your configuration.');
    }
    
    // Get executor wallet (if specified, otherwise use default)
    let ownerConfig;
    if (executorIdentifier) {
      // Find owner configuration
      if (!owners || !Array.isArray(owners) || owners.length === 0) {
        throw new Error('No owners configured');
      }
      
      // Find owner using the identifier resolver function
      ownerConfig = resolveOwnerFromIdentifier(executorIdentifier, owners);
      
      if (!ownerConfig) {
        throw new Error(`Owner not found with identifier: ${executorIdentifier}`);
      }
    } else {
      // Use first available owner
      const owners = await configManager.getOwners();
      if (owners.length === 0) {
        throw new Error(`No owners available for execution`);
      }
      ownerConfig = owners[0];
    }
    
    // Initialize signer
    const executor = await initializeSigner(ownerConfig, rpcUrl);
    
    // Create a provider to get current gas price if needed
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Prepare execution options
    const options = {};
    if (gasLimit) options.gasLimit = gasLimit;
    
    // Handle gas price and boost
    if (gasPrice) {
      // User provided gas price
      options.gasPrice = gasPrice;
    } else if (gasBoost) {
      // No gas price but boost provided - get current network price
      const currentFeeData = await provider.getFeeData();
      const currentGasPriceGwei = ethers.utils.formatUnits(currentFeeData.gasPrice, 'gwei');
      options.gasPrice = currentGasPriceGwei;
    }
    
    // Apply boost if provided
    if (gasBoost) {
      const boost = 100 + parseInt(gasBoost, 10);
      const originalPrice = parseFloat(options.gasPrice);
      const boostedGasPrice = (originalPrice * boost / 100).toFixed(9);
      options.gasPrice = boostedGasPrice.toString();
    }
    
    // Execute transaction
    const executedTransaction = await services.executeService.executeTransaction({
      safeAddress: targetSafeAddress,
      rpcUrl,
      chainId,
      transaction,
      signer: executor,
      ...options
    });
    
    // Save executed transaction
    await transactionManager.saveTransaction(executedTransaction);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Transaction executed successfully by ${ownerConfig.address}`,
          txHash: executedTransaction.hash,
          safeAddress: targetSafeAddress,
          executorAddress: ownerConfig.address,
          transactionHash: executedTransaction.metadata.transactionHash
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to execute transaction: ${error.message}`);
  }
}

/**
 * Handle list transactions operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result with list of transactions
 */
async function handleListTransactions({ safeAddress, status }) {
  // Get all transactions
  const transactions = await transactionManager.listTransactions();
  
  // Filter by safe address if provided
  let filteredTransactions = transactions;
  if (safeAddress) {
    filteredTransactions = filteredTransactions.filter(tx => 
      tx.safeAddress.toLowerCase() === safeAddress.toLowerCase()
    );
  }
  
  // Filter by status if provided
  if (status) {
    filteredTransactions = filteredTransactions.filter(tx => 
      tx.status === status
    );
  }
  
  // Format transactions for display
  const formattedTransactions = filteredTransactions.map(tx => ({
    hash: tx.hash,
    safeAddress: tx.safeAddress,
    to: tx.to,
    value: tx.value,
    status: tx.status,
    nonce: tx.nonce,
    data: tx.data ? tx.data.substring(0, 32) + '...' : null,
    signatures: tx.signatures ? Object.keys(tx.signatures).length : 0,
    created: tx.metadata.created
  }));
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        count: formattedTransactions.length,
        transactions: formattedTransactions
      }, null, 2)
    }]
  };
}

/**
 * Handle get transaction details operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result with transaction details
 */
async function handleGetTransactionDetails({ txHash, nonce, safeAddress }) {
  try {
    // Load transaction using either txHash or nonce
    const transaction = await transactionManager.loadTransaction(txHash || nonce);
    
    // Get chain info from config to access the default Safe address if needed
    const { defaultSafe } = await configManager.readConfig();
    
    // Use provided safeAddress, transaction safeAddress, or default from config
    let targetSafeAddress = safeAddress || transaction.metadata.safeAddress;
    
    // If still no safeAddress, get the default from config
    if (!targetSafeAddress) {
      targetSafeAddress = defaultSafe;
    }
    
    // Format signatures if present
    const signatures = {};
    if (transaction.signatures) {
      for (const [address, signature] of Object.entries(transaction.signatures)) {
        signatures[address] = {
          signature,
          timestamp: transaction.metadata.signatureTimestamps?.[address] || null
        };
      }
    }
    
    // Format transaction for display
    const formattedTransaction = {
      hash: transaction.hash,
      safeAddress: targetSafeAddress,
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
      status: transaction.status,
      signatures,
      metadata: {
        created: transaction.metadata.created,
        description: transaction.metadata.description,
        owners: transaction.metadata.owners,
        threshold: transaction.metadata.threshold,
        transactionHash: transaction.metadata.transactionHash,
        ipfs: transaction.metadata.ipfs
      }
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          transaction: formattedTransaction
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to get transaction details: ${error.message}`);
  }
}

/**
 * Handle export transaction operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleExportTransaction({ txHash, nonce, destination }) {
        destination = destination || 'ipfs';

        // Load transaction using either txHash or nonce
        const transaction = await transactionManager.loadTransaction(txHash || nonce);

        // Handle IPFS export
        if (destination === 'ipfs') {
          // Check for Pinata API credentials in config
          const { pinataApiKey, pinataSecretApiKey } = await configManager.readConfig();
          
          if (!pinataApiKey || !pinataSecretApiKey || 
              pinataApiKey === 'YOUR_PINATA_API_KEY' || 
              pinataSecretApiKey === 'YOUR_PINATA_SECRET_API_KEY') {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  result: "error",
                  message: `Pinata API credentials not configured. Use "safer config --set-pinata-api-key <your_api_key> --set-pinata-secret <your_secret_key>"`
                }, null, 2)
              }],
              isError: true
            };
          }
          
          // Upload to IPFS
          const updatedTransaction = await ipfsManager.saveTransactionToIPFS(transaction);
          
          // Get IPFS metadata
          const ipfsMetadata = updatedTransaction.metadata.ipfs;
          
          // Save updated transaction with IPFS metadata
          await transactionManager.saveTransaction(updatedTransaction);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Transaction exported to IPFS successfully`,
                txHash: transaction.hash,
                nonce: transaction.nonce,
                cid: ipfsMetadata.cid,
                url: ipfsMetadata.url,
                gateway: ipfsMetadata.gateway
              }, null, 2)
            }]
          };
        }
        
        // Handle local file export
        let outDir = destination || path.join(os.homedir(), 'safer-exports');
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        
        // Export to local file using configProvider's transactionToFile method
        const fileData = transactionManager.transactionToFile(transaction);
        const outPath = path.join(outDir, fileData.filename);
        fs.writeFileSync(outPath, fileData.content);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Transaction exported successfully`,
              txHash: transaction.hash,
              nonce: transaction.nonce,
              outPath: outPath
            }, null, 2)
          }]
        };
}

/**
 * Handle import transaction operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleImportTransaction({ source }) {
        let transaction;
        
        // Check if it's an IPFS link
  if (source.startsWith("ipfs://") || source.includes("ipfs.io")) {
          try {
            // Extract IPFS CID
      const cid = ipfsManager.parseCidFromUri(source);
            
            // Load from IPFS
      transaction = await ipfsManager.loadTransactionFromIPFS(cid);
          } catch (error) {
      throw new Error(`Failed to fetch from IPFS: ${error.message}`);
          }
        } else {
          // Local file
          if (!fs.existsSync(source)) {
      throw new Error(`File not found: ${source}`);
          }
          
          // Read local file
    const fileContent = fs.readFileSync(source, "utf8");
          
          // Import transaction from file content
    transaction = await transactionManager.importTransaction(fileContent);
        }
        
        // Save imported transaction
  await transactionManager.saveTransaction(transaction);
        
        return {
    content: [
      {
            type: "text",
        text: JSON.stringify(
          {
              success: true,
              message: `Transaction imported successfully`,
              txHash: transaction.hash,
            safeAddress: transaction.safeAddress,
            status: transaction.status,
            signatures: transaction.signatures
              ? Object.keys(transaction.signatures).length
              : 0,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handle open transaction directory operation
 * @returns {Object} Operation result
 */
async function handleOpenTransactionDirectory() {
  // Get transactions directory path
  const dirPath = PATHS.TRANSACTIONS_DIR;
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Open directory based on platform
        let command;
        switch (process.platform) {
          case 'darwin':
      command = `open "${dirPath}"`;
            break;
          case 'win32':
      command = `explorer "${dirPath}"`;
            break;
          case 'linux':
      command = `xdg-open "${dirPath}"`;
            break;
          default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
  
  // Execute command without error logging
  exec(command, () => {});
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
        message: `Opening transactions directory: ${dirPath}`
            }, null, 2)
          }]
        };
}

module.exports = { registerTransactionTools }; 