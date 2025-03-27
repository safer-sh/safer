/**
 * Resources index
 * Exports all resource registration functions
 */
const { registerConfigResources } = require('./config');
const { registerSafeResources } = require('./safe');
const { registerTransactionResources } = require('./transaction');

/**
 * Register all resources to the server
 * @param {Object} server MCP server instance
 */
function registerAllResources(server) {
  registerConfigResources(server);
  registerSafeResources(server);
  registerTransactionResources(server);
}

module.exports = { registerAllResources }; 