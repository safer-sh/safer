#!/usr/bin/env node
/**
 * Safer MCP Server
 * Command line interface for Safer wallet MCP server
 */

const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./server.js');

// Create MCP server
const server = createMcpServer();

// Start the server using stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch(err => {
  process.exit(1);
}); 