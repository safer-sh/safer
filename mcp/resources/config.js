/**
 * Config resource
 * Provides access to global configuration
 */
const { configManager } = require('@safer-sh/common/config');

/**
 * Register config resources to the server
 * @param {Object} server MCP server instance
 */
function registerConfigResources(server) {
  // Global config resource
  server.resource(
    "global-config",
    "config://global",
    async (uri) => {
      const config = await configManager.readConfig();
      
      // Check if this is a new installation
      const isNewInstallation = !config.chain && !config.rpcUrl && !config.defaultSafe;
      
      // Always provide security guidance as part of response metadata
      const securityAdvisory = {
        securityWarning: "NEVER use private keys for wallets that hold real assets!",
        recommendation: "For real assets, ALWAYS use a hardware wallet (Ledger)",
        privateKeyWarning: "Private keys are stored in plaintext and should ONLY be used for testing",
        walletPriority: ["ledger", "privkey"]
      };
      
      // Enhanced configuration with security advisory
      const enhancedConfig = {
        ...config,
        _securityAdvisory: securityAdvisory
      };
      
      // Always suggest security-focused prompts, but prioritize initialization for new installs
      if (isNewInstallation) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(enhancedConfig, null, 2)
          }],
          suggestedPrompts: ["initializationGuide", "walletSecurityGuide", "walletSetupGuide"]
        };
      } else {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(enhancedConfig, null, 2)
          }],
          suggestedPrompts: ["walletSecurityGuide"]
        };
      }
    }
  );
}

module.exports = { registerConfigResources }; 