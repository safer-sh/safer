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
  // Unified wallet management
  server.tool(
    "safer_wallet",
    {
      action: z.enum(["add", "list", "remove"]),
      // Action-specific parameters
      // For add
      name: z.string().optional(),
      type: z.enum(["privkey", "ledger"]).optional(),
      // For privkey type
      privateKey: z.string().optional(),
      // For ledger type
      derivationPath: z.string().optional(),
      accountIndex: z.number().optional(),
      // For both (used in different ways)
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    async (params) => {
      try {
        const { action, ...actionParams } = params;
        
        switch (action) {
          case "add":
            return await handleAddWallet(actionParams);
          case "remove":
            return await handleRemoveWallet(actionParams);
          case "list":
            return await handleListWallets();
          default:
            // Provide helpful wallet guidance if action is not specified
            const walletGuidance = `
Here's how to use safer wallet commands:

1. To list all wallets:
   safer_wallet list

2. To add a hardware wallet (RECOMMENDED for security):
   safer_wallet add --name "My Ledger" --type ledger --derivation-path "live" --account-index 0

3. To add a private key wallet (FOR TESTING ONLY):
   ⚠️ SECURITY WARNING: Private keys are stored in plaintext
   ⚠️ ONLY use this for testnets, NEVER for real assets
   safer_wallet add --name "Test Wallet" --type privkey --private-key <your-private-key>

4. To remove a wallet:
   safer_wallet remove --owner-address <wallet-address>
`;
            throw new Error(`Unknown action: ${action}. ${walletGuidance}`);
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
    // Validate required fields
    if (!type) {
      const walletGuidance = `
Please specify the wallet type and required parameters:

1. For Ledger Hardware Wallets (RECOMMENDED for security):
   safer_wallet add --name "My Ledger" --type ledger --derivation-path "live" --account-index 0
   
   - Derivation Path: Can be one of the following:
     * "live" - Ledger Live path (BIP44 standard: m/44'/60'/x'/0/0)
     * "legacy" - Legacy Ledger path (m/44'/60'/0'/x)
     * Or a custom path with optional placeholders: {account}, {change}, {address_index}
   - Account Index: A number (usually 0, 1, 2, etc.) representing the account number
   - Make sure your Ledger device is connected, unlocked, and has the Ethereum app open

2. For Private Key Wallets (FOR TESTING ONLY):
   ⚠️ SECURITY WARNING: Private keys are stored in plaintext
   ⚠️ ONLY use this for testnets, NEVER for real assets
   safer_wallet add --name "Test Wallet" --type privkey --private-key <your-private-key>
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
⚠️ SECURITY WARNING: PRIVATE KEYS ARE STORED IN PLAINTEXT ⚠️

Private key wallets should ONLY be used for testing on testnets - NEVER for real assets!

To add a private key wallet, you need to provide:
1. Wallet Name: An easily recognizable name
2. Private Key: Your Ethereum private key (with or without 0x prefix)

For production use and real assets, please use a hardware wallet instead:
safer_wallet add --name "My Ledger" --type ledger --derivation-path "live" --account-index 0`;

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
          message: type === 'privkey' 
            ? `Private key wallet '${walletConfig.name}' added successfully - ⚠️ REMEMBER: This should only be used for testing!` 
            : `Ledger wallet '${walletConfig.name}' added successfully`,
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
    
    if (errorMessage.includes('derivation path')) {
      suggestion = 'Standard derivation paths are "live" (Ledger Live) or "legacy" (older Ledger).';
    } else if (errorMessage.includes('Ledger')) {
      suggestion = 'Make sure your Ledger is connected, unlocked, and has the Ethereum app open.';
    } else if (errorMessage.includes('private key')) {
      suggestion = '⚠️ WARNING: Make sure your private key is valid, 64 characters long, and includes the 0x prefix if needed. NEVER import private keys that control real assets - private keys are stored in plaintext and should ONLY be used for testing.';
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
            type: 'Wallet type: "ledger" (recommended) or "privkey" (testing only)',
            derivationPath: 'Required for type "ledger" - Use "live" (Ledger Live) or "legacy" (older Ledger)',
            accountIndex: 'Optional account index for Ledger (default: 0)',
            ownerAddress: 'Optional for Ledger wallets - will be derived from device if not provided',
            privateKey: 'Required for type "privkey" - ⚠️ WARNING: Use for testing only, keys are stored in plaintext!'
          },
          examples: [
            'safer_wallet add --name "Hardware Wallet" --type ledger --derivation-path "live" --account-index 0',
            'safer_wallet add --name "Test Wallet" --type privkey --private-key 0x1234... (FOR TESTING ONLY)'
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