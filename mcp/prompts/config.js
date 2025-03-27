/**
 * Configuration prompts
 * Provides templates for configuration-related interactions
 */
const { z } = require('zod');

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
    ({ chain = "sepolia", defaultSafe = "no default safe" }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me set up my wallet configuration with the following preferences:

Chain: ${chain}
Default Safe: ${defaultSafe !== "no default safe" ? defaultSafe : "I don't have a default Safe yet"}

Please assist me with:
1. Setting the correct configuration values for my environment
2. Verifying the chain details (chainId, RPC URL) are properly set
3. Showing my current configuration after changes are applied

Important notes:
- A valid RPC URL is required for blockchain interactions
- The chain setting determines which network my transactions will target
- Setting a default Safe makes it easier to work with a frequently used Safe
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

Please assist me by:
1. Showing my current configuration settings
2. Suggesting improvements or missing configurations
3. Guiding me through setting up any missing configurations

Important notes:
- Network configuration is required for interacting with the blockchain
- A default Safe simplifies transactions and signatures
- RPC URL configuration is essential for network connectivity
            `.trim()
          }
        }]
      };
    }
  );
}

module.exports = { registerConfigPrompts }; 