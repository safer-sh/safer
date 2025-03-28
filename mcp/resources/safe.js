/**
 * Safe resources
 * Provides access to Safe information
 */
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { services } = require('@safer-sh/core');
const { configManager } = require('@safer-sh/common/config');

/**
 * Register Safe resources to the server
 * @param {Object} server MCP server instance
 */
function registerSafeResources(server) {
  // Safe details resource
  server.resource(
    "safe-details",
    new ResourceTemplate("safe://{safeAddress}", { list: undefined }),
    async (uri, { safeAddress }) => {
      try {
        // Get chain info from config
        const { chainId, rpcUrl } = await configManager.readConfig();
        
        // Get Safe details
        const safeInfo = await services.safeService.getSafeInfo({
          safeAddress,
          rpcUrl,
          chainId
        });
        
        // Format owners with readable format
        const ownersList = safeInfo.owners.map(owner => {
          return `- ${owner}`;
        }).join('\n');
        
        // Format text response
        const textResponse = `
# Safe Wallet ${safeAddress}

## General Information
- Network: ${chainId}
- Threshold: ${safeInfo.threshold}/${safeInfo.owners.length} signatures required
- Balance: ${safeInfo.balance} ETH

## Owners
${ownersList}
        `.trim();
        
        return {
          contents: [{
            uri: uri.href,
            text: textResponse
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Error retrieving Safe information: ${error.message}`
          }]
        };
      }
    }
  );
  
  // Default Safe information resource
  server.resource(
    "default-safe-info",
    "safe://default",
    async (uri) => {
      try {
        // Get default Safe address from configuration
        const config = await configManager.readConfig();
        
        if (!config.defaultSafe) {
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify({ error: "No default Safe configured" }, null, 2)
            }],
            suggestedPrompts: ["configSetupGuide"]
          };
        }
        
        // Get Safe information
        const safeInfo = await services.safeService.getSafeInfo({
          safeAddress: config.defaultSafe,
          rpcUrl: config.rpcUrl,
          chainId: config.chainId
        });
        
        // Return Safe information
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(safeInfo, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }
    }
  );
  
  // Wallet security guide resource
  server.resource(
    "wallet-security-guide",
    "safer://wallet-security",
    async (uri) => {
      // Security guide information
      const securityGuide = {
        title: "Safer Wallet Security Guide",
        securityRecommendations: [
          {
            category: "Hardware Wallets (RECOMMENDED)",
            recommendation: "Always use hardware wallets for real assets",
            details: "Hardware wallets like Ledger keep private keys secure in an isolated environment",
            usage: "safer_wallet add --name \"My Ledger\" --type ledger --derivation-path \"live\" --account-index 0"
          },
          {
            category: "Private Key Wallets (FOR TESTING ONLY)",
            recommendation: "NEVER use private key wallets for real assets",
            details: "Private keys are stored in plaintext and are vulnerable to theft",
            warning: "ONLY use private key wallets on testnets with test funds"
          }
        ],
        bestPractices: [
          "Always verify transaction details before signing",
          "Use multi-signature wallets (like Safe) for additional security",
          "Keep your device and software updated",
          "Never share your private keys or recovery phrases",
          "Always test with small amounts first"
        ]
      };
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(securityGuide, null, 2)
        }],
        suggestedPrompts: ["walletSecurityGuide"]
      };
    }
  );
}

module.exports = { registerSafeResources }; 