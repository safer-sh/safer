/**
 * Safe resources
 * Provides access to Safe wallet information
 */
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { services } = require('@safer-sh/core');
const { configManager } = require('@safer-sh/common/config');

/**
 * Register Safe-related resources to the server
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
}

module.exports = { registerSafeResources }; 