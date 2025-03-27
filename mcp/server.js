/**
 * MCP Server for Safer wallet
 * Implements the Model Context Protocol to provide AI assistant capabilities
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { registerAllResources } = require('./resources');
const { registerAllTools } = require('./tools');
const { registerAllPrompts } = require('./prompts');

/**
 * Create and configure the MCP server
 * @returns {McpServer} Configured MCP server instance
 */
function createMcpServer() {
  // Create MCP server instance
  const server = new McpServer({
    name: "Safer Wallet",
    version: "0.1.0",
    options: {
      // Increase default timeout to 5 minutes for long-running operations like transaction execution
      timeout: 300000, // 5 minutes in milliseconds
      maxTotalTimeout: 600000 // 10 minutes maximum total timeout
    }
  });

  // Register resources, tools and prompts
  registerAllResources(server);
  registerAllTools(server);
  registerAllPrompts(server);

  return server;
}

module.exports = { createMcpServer }; 