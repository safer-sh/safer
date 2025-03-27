/**
 * Prompts index
 * Exports all prompt registration functions
 */
const { registerTransferPrompts } = require('./transfer');
const { registerAdminPrompts } = require('./admin');
const { registerTransactionPrompts } = require('./transaction');
const { registerConfigPrompts } = require('./config');

/**
 * Register all prompts to the server
 * @param {Object} server MCP server instance
 */
function registerAllPrompts(server) {
  registerTransferPrompts(server);
  registerAdminPrompts(server);
  registerTransactionPrompts(server);
  registerConfigPrompts(server);
}

module.exports = { registerAllPrompts }; 