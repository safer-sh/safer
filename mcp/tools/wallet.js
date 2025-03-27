/**
 * Wallet tools for MCP
 * Provides tools to manage wallet accounts
 */
const { z } = require('zod');
const { configManager } = require('@safer-sh/common/config');
const { ethers } = require('ethers');

/**
 * Register wallet tools to the server
 * @param {Object} server MCP server instance
 */
function registerWalletTools(server) {
  // Unified wallet management tool
  server.tool(
    "safer_wallet",
    {
      action: z.enum(["add", "remove", "list"]),
      // Add wallet parameters
      name: z.string().optional(),
      type: z.enum(["privkey", "ledger"]).optional(),
      privateKey: z.string().optional(),
      derivationPath: z.string().optional(),
      accountIndex: z.number().optional(),
      // Remove wallet parameters
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    async (params) => {
      const { action, ...actionParams } = params;
      
      try {
        switch (action) {
          case "add":
            return await handleAddWallet(actionParams);
          case "remove":
            return await handleRemoveWallet(actionParams);
          case "list":
            return await handleListWallets();
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Error in wallet operation: ${error.message}`
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Get full derivation path from path alias or template
 * @param {string} derivationPath Path or path alias (live, legacy)
 * @param {number} accountIndex Account index
 * @returns {string} Full derivation path
 */
function getFullDerivationPath(derivationPath, accountIndex) {
  // Handle path aliases
  if (derivationPath === 'live') {
    // Ledger Live path (BIP44 standard)
    return `m/44'/60'/${accountIndex}'/0/0`;
  } else if (derivationPath === 'legacy') {
    // Legacy Ledger path
    return `m/44'/60'/0'/${accountIndex}`;
  }
  
  // Return custom path with replacements
  return derivationPath
    .replace('{account}', accountIndex || 0)
    .replace('{change}', 0)
    .replace('{address_index}', 0);
}

/**
 * Handle add wallet operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleAddWallet({ name, type, privateKey, derivationPath, accountIndex, ownerAddress }) {
  try {
    // Validate required parameters
    if (!type) {
      // Provide detailed guidance on adding a wallet
      let walletGuidance = `
To add a new wallet, please provide the following information:

1. Wallet Type (required):
   - For hardware wallets: "ledger"
   - For private key wallets: "privkey"

2. Wallet Name (optional):
   - A friendly name to identify this wallet

3. For Ledger Hardware Wallets:
   - Derivation Path: Can be one of the following:
     * "live" - Ledger Live path (BIP44 standard: m/44'/60'/x'/0/0)
     * "legacy" - Legacy Ledger path (m/44'/60'/0'/x)
     * Or a custom path with optional placeholders: {account}, {change}, {address_index}
   - Account Index: A number (usually 0, 1, 2, etc.) representing the account number
   - Make sure your Ledger device is connected, unlocked, and has the Ethereum app open

4. For Private Key Wallets:
   - Wallet Name: Give this wallet an easily recognizable name
   - Private Key: Your Ethereum private key (with or without 0x prefix)
   
   ⚠️ SECURITY WARNING: Never import private keys that control real assets.
   ⚠️ Private keys are stored locally but may be exposed. Use for testing only.
`;

      throw new Error(`Wallet type is required. ${walletGuidance}`);
    }
    
    if (!name) {
      name = type === 'privkey' ? 'Private Key Wallet' : 'Ledger Wallet';
    }
    
    // Create wallet config object
    const walletConfig = {
      name,
      type
    };
    
    // Handle private key wallet
    if (type === 'privkey') {
      if (!privateKey) {
        const privateKeyWarning = `
To add a private key wallet, you need to provide the following information:

1. Wallet Name: Give this wallet an easily recognizable name
2. Private Key: Your Ethereum private key (with or without 0x prefix)

⚠️ SECURITY WARNING: Please remember, never import private keys that control real assets.
⚠️ Private keys are stored locally but may be exposed. Use for testing purposes only.

Please provide this information, and I will help you add the private key wallet.
After adding, we can set it as an owner of your Safe.`;

        throw new Error(`Private key is required for private key wallet. ${privateKeyWarning}`);
      }
      
      // Validate and normalize private key
      let normalizedKey = privateKey;
      if (!normalizedKey.startsWith('0x')) {
        normalizedKey = `0x${normalizedKey}`;
      }
      
      try {
        const wallet = new ethers.Wallet(normalizedKey);
        walletConfig.privateKey = normalizedKey;
        walletConfig.address = wallet.address;
      } catch (error) {
        throw new Error(`Invalid private key: ${error.message}`);
      }
    }
    
    // Handle Ledger wallet
    else if (type === 'ledger') {
      if (!derivationPath) {
        throw new Error('Derivation path is required for Ledger wallet. Please specify "live" (BIP44 standard), "legacy", or a custom path.');
      }
      
      let fullDerivationPath;
      
      // Check if derivationPath is a full path or an alias
      if (derivationPath.startsWith('m/')) {
        // If it's a full path, use it directly
        fullDerivationPath = derivationPath;
      } else {
        // If it's an alias, require accountIndex
        if (accountIndex === undefined) {
          accountIndex = 0;
        }
        // Process the derivation path (handle path aliases)
        fullDerivationPath = getFullDerivationPath(derivationPath, accountIndex);
      }
      
      // Store the full derivation path
      walletConfig.derivationPath = fullDerivationPath;
      
      // If ownerAddress is not provided, get it from the Ledger
      if (!ownerAddress) {
        try {
          // Load provider from config
          const config = configManager.readConfig();
          const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
          
          // Use LedgerSigner to get address
          const { LedgerSigner } = require('@safer-sh/ledger-signer');
          const ledgerSigner = await new LedgerSigner(provider).init({
            path: fullDerivationPath
          });
          
          // Get address from the signer
          ownerAddress = await ledgerSigner.getAddress();
        } catch (error) {
          throw new Error(`Failed to get address from Ledger: ${error.message}. Make sure your Ledger is connected, unlocked, and has the Ethereum app open.`);
        }
      }
      
      walletConfig.address = ownerAddress;
    }
    
    // Add wallet to configuration - Using synchronous API call
    const result = configManager.setOwner(walletConfig);
    
    // Return success message with wallet details
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `${type === 'privkey' ? 'Private key' : 'Ledger'} wallet '${walletConfig.name}' added successfully`,
          wallet: {
            address: walletConfig.address,
            type: walletConfig.type,
            name: walletConfig.name,
            privateKey: type === 'privkey' ? '********' : undefined,
            derivationPath: type === 'ledger' ? walletConfig.derivationPath : undefined
          },
          nextSteps: [
            'View all wallets: safer_wallet list',
            'Set up a Safe wallet: safer_config set --default-safe <safe-address>',
            'Create a transaction: safer_transaction createEthTransfer --recipient <address> --amount <amount>'
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    // Format error response with helpful suggestions
    const errorMessage = error.message;
    let suggestion = '';
    
    if (errorMessage.includes('private key')) {
      suggestion = 'Make sure your private key is valid, 64 characters long, and includes the 0x prefix if needed. ⚠️ WARNING: Never import private keys that control real assets.';
    } else if (errorMessage.includes('derivation path')) {
      suggestion = 'Standard derivation paths are "live" (Ledger Live) or "legacy" (older Ledger).';
    } else if (errorMessage.includes('Ledger')) {
      suggestion = 'Make sure your Ledger is connected, unlocked, and has the Ethereum app open.';
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          message: `Failed to add wallet: ${errorMessage}`,
          suggestion: suggestion,
          parameters: {
            name: 'A friendly name for the wallet',
            type: 'Wallet type: "privkey" or "ledger"',
            privateKey: 'Required for type "privkey" - WARNING: Use for testing only!',
            derivationPath: 'Required for type "ledger" - Use "live" (Ledger Live) or "legacy" (older Ledger)',
            accountIndex: 'Optional account index for Ledger (default: 0)',
            ownerAddress: 'Optional for Ledger wallets - will be derived from device if not provided'
          },
          examples: [
            'safer_wallet add --name "Main Wallet" --type privkey --private-key 0x1234...',
            'safer_wallet add --name "Hardware Wallet" --type ledger --derivation-path "live" --account-index 1'
          ]
        }, null, 2)
      }],
      isError: true
    };
  }
}

/**
 * Handle remove wallet operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleRemoveWallet({ ownerAddress }) {
  try {
    if (!ownerAddress) {
      throw new Error('Owner address is required to remove a wallet');
    }
    
    // Get current wallets for verification - Using synchronous API call
    const wallets = configManager.getOwners();
    const walletToRemove = wallets.find(w => 
      w.address.toLowerCase() === ownerAddress.toLowerCase()
    );
    
    if (!walletToRemove) {
      throw new Error(`Wallet with address ${ownerAddress} not found`);
    }
    
    // Remove wallet - Using synchronous API call
    const removed = configManager.removeOwner(ownerAddress);
    
    if (!removed) {
      throw new Error(`Failed to remove wallet ${ownerAddress}`);
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Wallet removed successfully`,
          address: ownerAddress,
          name: walletToRemove.name,
          remainingWallets: wallets.length - 1,
          nextSteps: [
            'View remaining wallets: safer_wallet list',
            'Add new wallet: safer_wallet add --name <name> --type <type> ...'
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          message: `Failed to remove wallet: ${error.message}`,
          suggestion: 'Use "safer_wallet list" to see available wallets and their addresses'
        }, null, 2)
      }],
      isError: true
    };
  }
}

/**
 * Handle list wallets operation
 * @returns {Object} Operation result with list of wallets
 */
async function handleListWallets() {
  try {
    // Get all wallets - Using synchronous API call
    const wallets = configManager.getOwners();
    
    // If no wallets, provide guidance on adding wallets
    if (wallets.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: 'No wallets found',
            wallets: [],
            suggestion: 'Add a wallet with: safer_wallet add --name <name> --type <type> ...',
            examples: [
              'safer_wallet add --name "Main Wallet" --type privkey --private-key 0x1234...',
              'safer_wallet add --name "Hardware Wallet" --type ledger --derivation-path "m/44\'/60\'/0\'/0/0" --owner-address 0x5678...'
            ]
          }, null, 2)
        }]
      };
    }
    
    // Format wallet information (hide sensitive data)
    const formattedWallets = wallets.map((wallet, index) => ({
      index: index + 1,
      name: wallet.name,
      address: wallet.address,
      type: wallet.type,
      // Include type-specific information, but hide sensitive data
      derivationPath: wallet.type === 'ledger' ? wallet.derivationPath : undefined,
      accountIndex: wallet.type === 'ledger' ? wallet.accountIndex : undefined,
      hasPrivateKey: wallet.type === 'privkey' ? true : undefined
    }));
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Found ${wallets.length} wallet${wallets.length > 1 ? 's' : ''}`,
          wallets: formattedWallets,
          usage: 'Use wallet name, address, or index number to reference wallets in commands',
          nextSteps: [
            'Create a transaction: safer_transaction createEthTransfer --recipient <address> --amount <amount>',
            'Sign a transaction: safer_transaction sign --tx-hash <hash> --signer <wallet name, address, or index>'
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          message: `Failed to list wallets: ${error.message}`,
          suggestion: 'Make sure your configuration is properly set up'
        }, null, 2)
      }],
      isError: true
    };
  }
}

module.exports = { registerWalletTools }; 