/**
 * Configuration prompts
 * Provides templates for configuration-related interactions
 */
const { z } = require('zod');
const { NETWORKS } = require('@safer-sh/common/constants');

/**
 * Register configuration-related prompts to the server
 * @param {Object} server MCP server instance
 */
function registerConfigPrompts(server) {
  // Configuration setup guide
  server.prompt(
    "configSetupGuide",
    {
      chain: z.string().optional(),
      defaultSafe: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    ({ chain, defaultSafe = "no default safe" }) => {
      // Get available networks for display
      const availableNetworks = Object.values(NETWORKS)
        .map(network => `- ${network.name}: ${network.label}`)
        .join('\n');
      
      const chainMessage = chain 
        ? `You've selected: ${chain}` 
        : `Please choose a network from the available options:\n${availableNetworks}\n\nYou can set it with: safer_config set --chain <network-name>`;
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me set up my wallet configuration.

Network Configuration:
${chainMessage}

Default Safe: ${defaultSafe !== "no default safe" ? defaultSafe : "I don't have a default Safe yet"}

Please assist me with:
1. Setting the correct configuration values for my environment
2. Verifying the chain details (chainId, RPC URL) are properly set
3. Showing my current configuration after changes are applied

Important notes:
- A valid RPC URL is required for blockchain interactions (you can find public RPC URLs at https://chainlist.org)
- The chain setting determines which network my transactions will target
- Setting a default Safe makes it easier to work with a frequently used Safe

Wallet Security:
- For production use and real assets, ALWAYS use a hardware wallet with: safer_wallet add --name <name> --type ledger
- CAUTION: Private keys are stored in plaintext and should ONLY be used for testing
            `.trim()
          }
        }]
      };
    }
  );
  
  // Wallet configuration guide
  server.prompt(
    "walletConfigGuide",
    {},
    () => {
      // Get available networks for display
      const availableNetworks = Object.values(NETWORKS)
        .map(network => `- ${network.name}: ${network.label}`)
        .join('\n');
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me manage my wallet configuration.

I need to:
1. View my current wallet configuration
2. Set up proper network configuration
3. Configure a default Safe if possible

Available networks:
${availableNetworks}

Please assist me by:
1. Showing my current configuration settings
2. Suggesting improvements or missing configurations
3. Guiding me through setting up any missing configurations

Important notes:
- Network configuration is required for interacting with the blockchain
- A default Safe simplifies transactions and signatures
- RPC URL configuration is essential for network connectivity (you can find public RPC URLs at https://chainlist.org)

Wallet Security:
- For production use and real assets, ALWAYS use a hardware wallet with: safer_wallet add --name <name> --type ledger
- CAUTION: Private keys are stored in plaintext and should ONLY be used for testing
            `.trim()
          }
        }]
      };
    }
  );
  
  // Initialization guide prompt - explicitly guides first-time users with security focus
  server.prompt(
    "initializationGuide",
    {},
    () => {
      // Get available networks for display
      const availableNetworks = Object.values(NETWORKS)
        .map(network => `- ${network.name}: ${network.label}`)
        .join('\n');
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
I need help setting up Safer for the first time. Please guide me through the complete initialization process.

Here are the setup steps in order of priority:

1. FIRST: Check my current configuration
   safer_config get

2. SECOND: Set up the network (choose one from below):
   Available networks:
   ${availableNetworks}
   
   safer_config set --chain <network-name> --rpc-url <rpc-url>
   (You can find public RPC URLs at https://chainlist.org)

3. THIRD: Add a wallet (IMPORTANT SECURITY CONSIDERATIONS):
   
   ⚠️ STRONGLY RECOMMENDED: Use a hardware wallet for real assets
   safer_wallet add --name "My Ledger" --type ledger --derivation-path "live" --account-index 0
   
   ⚠️ USE ONLY FOR TESTING: Private key wallets store keys in plaintext
   safer_wallet add --name "Test Wallet" --type privkey --private-key <your-private-key>
   
   NEVER use private keys for wallets that hold real assets!

4. FOURTH: Set a default Safe (if you have one):
   safer_config set --default-safe <safe-address>

Please help me follow these steps securely, clearly explaining each option and emphasizing proper security practices.
            `.trim()
          }
        }]
      };
    }
  );
}

module.exports = { registerConfigPrompts }; 