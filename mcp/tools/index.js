/**
 * Tools index
 * Exports all tool registration functions
 */
const { registerWalletTools } = require('./wallet');
const { registerAdminTools } = require('./admin');
const { registerTransactionTools } = require('./transaction');
const { registerConfigTools } = require('./config');

/**
 * Register all tools to the server
 * @param {Object} server MCP server instance
 */
function registerAllTools(server) {
  registerWalletTools(server);
  registerAdminTools(server);
  registerTransactionTools(server);
  registerConfigTools(server);
}

module.exports = { registerAllTools }; 