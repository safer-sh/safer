/**
 * Info tools
 * Implements Safe info, configuration, and transaction query functionality
 */
const { z } = require('zod');
const { services } = require('@safer-sh/core');
const { ethers } = require('ethers');
const { configManager, transactionManager } = require('@safer-sh/common/config');

/**
 * Register info-related tools to the server
 * @param {Object} server MCP server instance
 */
function registerInfoTools(server) {
  // Get Safe info tool
  server.tool(
    "getSafeInfo",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    async ({ safeAddress }) => {
      try {
        // Get chain info from config
        const { chainId, rpcUrl } = await configManager.readConfig();
        
        // If no safeAddress provided, use default from config
        if (!safeAddress) {
          safeAddress = config.defaultSafe;
          if (!safeAddress) {
            throw new Error('No Safe address provided and no default Safe configured');
          }
        }
        
        // Normalize address - first convert to lowercase to avoid checksum errors
        try {
          safeAddress = ethers.utils.getAddress(safeAddress.toLowerCase());
        } catch (err) {
          throw new Error(`Invalid address format: ${err.message}`);
        }
        
        // Get Safe info
        const safeInfo = await services.safeService.getSafeInfo({
          safeAddress,
          rpcUrl,
          chainId
        });
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              safeAddress,
              ethBalance: safeInfo.balance,
              ethBalanceFormatted: safeInfo.ethBalanceFormatted,
              owners: safeInfo.owners,
              threshold: safeInfo.threshold,
              nonce: safeInfo.nonce,
              chainId: safeInfo.chainId,
              version: safeInfo.version
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting Safe info: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Get config tool
  server.tool(
    "getConfig",
    {},
    async () => {
      try {
        // Read configuration
        const config = await configManager.readConfig();
        
        // Format owners for better display
        const formattedOwners = config.owners.map(owner => {
          const formatted = { ...owner };
          if (owner.privateKey) {
            formatted.privateKey = '********'; // Mask private key for security
          }
          return formatted;
        });
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              defaultSafe: config.defaultSafe,
              chain: config.chain,
              rpcUrl: config.rpcUrl,
              owners: formattedOwners
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting configuration: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Set config tool
  server.tool(
    "setConfig",
    {
      defaultSafe: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      rpcUrl: z.string().optional(),
      chain: z.string().optional()
    },
    async ({ defaultSafe, rpcUrl, chain }) => {
      try {
        // Read current configuration
        const config = await configManager.readConfig();
        
        // Update values if provided
        if (defaultSafe) {
          config.defaultSafe = defaultSafe;
        }
        
        if (rpcUrl) {
          config.rpcUrl = rpcUrl;
        }
        
        if (chain) {
          config.chain = chain;
        }
        
        // Save configuration
        await configManager.saveConfig(config);
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              message: "Configuration updated successfully",
              updatedFields: {
                defaultSafe: defaultSafe ? true : false,
                rpcUrl: rpcUrl ? true : false,
                chain: chain ? true : false
              },
              config: {
                defaultSafe: config.defaultSafe,
                chain: config.chain,
                rpcUrl: config.rpcUrl
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating configuration: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Add wallet tool
  server.tool(
    "addWallet",
    {
      name: z.string(),
      type: z.enum(["privkey", "ledger"]),
      privateKey: z.string().optional(),
      derivationPath: z.string().optional(),
      accountIndex: z.number().optional()
    },
    async ({ name, type, privateKey, derivationPath, accountIndex }) => {
      try {
        // Validate input based on wallet type
        if (type === "privkey" && !privateKey) {
          throw new Error("Private key is required for privkey wallet type");
        }
        
        if (type === "ledger" && !derivationPath) {
          throw new Error("Derivation path is required for ledger wallet type");
        }
        
        // Set default account index if not provided
        if (type === "ledger" && accountIndex === undefined) {
          accountIndex = 0;
        }
        
        // Process wallet data based on type
        if (type === "privkey") {
          // For private key wallet, get address from private key
          try {
            // Use ethers.js to derive address from private key
            const ethers = require('ethers');
            const walletInstance = new ethers.Wallet(privateKey);
            
            // Use configProvider.setOwner to add the wallet
            const result = await configManager.setOwner({
              address: walletInstance.address,
              type: 'privkey',
              privateKey: privateKey,
              name: name
            });
            
            // Return success response
            const responseWallet = { ...result.owner };
            if (responseWallet.privateKey) {
              responseWallet.privateKey = "********";
            }
            
            return {
              content: [{
                type: "text", 
                text: JSON.stringify({
                  success: true,
                  message: `Private key wallet '${name}' added successfully`,
                  wallet: responseWallet
                }, null, 2)
              }]
            };
          } catch (error) {
            throw new Error(`Invalid private key: ${error.message}`);
          }
        } else if (type === "ledger") {
          // Process the derivation path
          let fullDerivationPath;
          
          // Convert common path types to full derivation paths
          switch (derivationPath.toLowerCase()) {
            case 'live':
              // Ledger Live path (BIP44 standard)
              fullDerivationPath = `m/44'/60'/${accountIndex}'/0/0`;
              break;
            case 'legacy':
              fullDerivationPath = `m/44'/60'/${accountIndex}'/0`;
              break;
            default:
              // Use derivation path as is for custom paths
              fullDerivationPath = derivationPath;
          }
          
          try {
            // Load provider from config
            const config = await configManager.readConfig();
            const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
            
            // Use LedgerSigner to get address
            const { LedgerSigner } = require('@safer-sh/ledger-signer');
            const ledgerSigner = await new LedgerSigner(provider).init({
              path: fullDerivationPath
            });
            
            // Get address from the signer
            const ledgerAddress = await ledgerSigner.getAddress();
            
            // Use configProvider.setOwner to add the wallet
            const result = await configManager.setOwner({
              address: ledgerAddress,
              type: 'ledger',
              derivationPath: fullDerivationPath,
              name: name
            });
            
            return {
              content: [{
                type: "text", 
                text: JSON.stringify({
                  success: true,
                  message: `Ledger wallet '${name}' added successfully`,
                  wallet: result.owner
                }, null, 2)
              }]
            };
          } catch (error) {
            throw new Error(`Failed to add Ledger wallet: ${error.message}`);
          }
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error adding wallet: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Remove wallet tool
  server.tool(
    "removeWallet",
    {
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    },
    async ({ ownerAddress }) => {
      try {
        // Validate input
        if (!ownerAddress) {
          throw new Error("Owner address is required");
        }
        
        // First check if owner exists
        const owner = await configManager.findOwnerByAddress(ownerAddress);
        if (!owner) {
          throw new Error(`Owner with address ${ownerAddress} not found`);
        }
        
        // Remove owner using configProvider
        const result = await configManager.removeOwner(ownerAddress);
        
        if (!result) {
          throw new Error(`Failed to remove owner with address ${ownerAddress}`);
        }
        
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              message: `Wallet with address ${ownerAddress} removed successfully`,
              removedOwner: {
                address: ownerAddress,
                name: owner.name,
                type: owner.type
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error removing wallet: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // List transactions tool
  server.tool(
    "listTransactions",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      status: z.string().optional()
    },
    async ({ safeAddress, status }) => {
      try {
        // Get config
        const config = await configManager.readConfig();
        
        // If no safeAddress provided, use default
        if (!safeAddress) {
          safeAddress = config.defaultSafe;
          if (!safeAddress) {
            throw new Error('No Safe address provided and no default Safe configured');
          }
        }
        
        // Load all transactions
        const allTransactions = await transactionManager.listTransactions();
        
        // Filter transactions for the specified Safe
        let transactions = allTransactions.filter(tx => 
          (tx.metadata && tx.metadata.safeAddress && tx.metadata.safeAddress.toLowerCase() === safeAddress.toLowerCase()) ||
          (tx.safeAddress && tx.safeAddress.toLowerCase() === safeAddress.toLowerCase())
        );
        
        // Filter by status if specified
        if (status) {
          transactions = transactions.filter(tx => tx.status === status);
        }
        
        // Sort by creation date (newest first)
        transactions.sort((a, b) => {
          return new Date(b.createDate || 0) - new Date(a.createDate || 0);
        });
        
        // Format transactions for display
        const formattedTransactions = transactions.map(tx => {
          // Format transaction type
          let type = 'Unknown';
          if (tx.metadata && tx.metadata.type) {
            switch (tx.metadata.type) {
              case 'ethTransfer':
                type = `ETH Transfer (${tx.metadata.amountFormatted || tx.metadata.amount || '0'})`;
                break;
              case 'erc20Transfer':
                type = `${tx.metadata.tokenSymbol || 'ERC20'} Transfer (${tx.metadata.amountFormatted || tx.metadata.amount || '0'})`;
                break;
              case 'addOwner':
                type = `Add Owner (${tx.metadata.newOwner || tx.metadata.newOwnerAddress || 'Unknown'})`;
                break;
              case 'removeOwner':
                type = `Remove Owner (${tx.metadata.removedOwner || tx.metadata.ownerAddress || 'Unknown'})`;
                break;
              case 'changeThreshold':
                type = `Change Threshold (${tx.metadata.oldThreshold || '?'} → ${tx.metadata.newThreshold || tx.metadata.threshold || '?'})`;
                break;
              default:
                type = tx.metadata.type;
            }
          }
          
          // Count signatures
          const signaturesCount = tx.signatures ? Object.keys(tx.signatures).length : 0;
          
          return {
            hash: tx.hash,
            type: type,
            status: tx.status || 'pending',
            signaturesCount: signaturesCount,
            created: tx.createDate ? new Date(tx.createDate).toISOString() : 'Unknown',
            executed: tx.executionDate ? new Date(tx.executionDate).toISOString() : null,
            transactionHash: tx.transactionHash || null
          };
        });
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              safeAddress,
              count: formattedTransactions.length,
              transactions: formattedTransactions
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing transactions: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Get transaction details tool
  server.tool(
    "getTransactionDetails",
    {
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
    },
    async ({ txHash }) => {
      try {
        // Load transaction
        const transaction = await transactionManager.loadTransaction(txHash);
        
        // Get signatures
        const signatures = transaction.signatures || {};
        const signaturesList = Object.keys(signatures).map(signer => {
          return {
            signer,
            signature: typeof signatures[signer] === 'object' ? signatures[signer].data : signatures[signer]
          };
        });
        
        // Format transaction metadata
        const metadata = transaction.metadata || {};
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              hash: transaction.hash,
              safeAddress: metadata.safeAddress || transaction.safeAddress,
              type: metadata.type || 'Unknown',
              status: transaction.status || 'pending',
              created: transaction.createDate || 'Unknown',
              executed: transaction.executionDate || null,
              transactionHash: metadata.transactionHash || null,
              to: transaction.to,
              value: transaction.value,
              data: transaction.data,
              nonce: transaction.nonce,
              operation: transaction.operation,
              signatures: signaturesList,
              signaturesCount: signaturesList.length,
              metadata: metadata,
              ipfs: metadata.ipfs || null,
              failureReason: transaction.failureReason || null
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting transaction details: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}

module.exports = { registerInfoTools }; 