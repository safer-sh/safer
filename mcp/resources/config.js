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
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(config, null, 2)
        }]
      };
    }
  );
}

module.exports = { registerConfigResources }; 