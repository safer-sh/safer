/**
 * Transfer tools
 * Implements ETH and ERC20 transfer functionality
 */
const { z } = require('zod');
const { services } = require('@safer-sh/core');
const { configManager, transactionManager } = require('@safer-sh/common/config');

/**
 * Register transfer-related tools to the server
 * @param {Object} server MCP server instance
 */
function registerTransferTools(server) {
  // ETH transfer tool
  server.tool(
    "createEthTransfer",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      amount: z.string().min(1)
    },
    async ({ safeAddress, recipient, amount }) => {
      try {
        // Get chain info from config
        const { chainId, rpcUrl } = await configManager.readConfig();
        
        // Create transaction
        const result = await services.transactionService.createEthTransferTx({
          safeAddress,
          rpcUrl,
          chainId,
          receiverAddress: recipient,
          amount
        });
        
        // Get Safe information
        const safeInfo = await services.safeService.getSafeInfo({
          safeAddress,
          rpcUrl,
          chainId
        });
        
        // Add owners to metadata if not already present
        if (!result.metadata.owners) {
          result.metadata.owners = safeInfo.owners;
        }
        
        // Save transaction using configProvider
        await transactionManager.saveTransaction(result);
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              txHash: result.hash,
              safeAddress,
              recipient,
              amount,
              estimated_gas: result.estimatedGas?.toString() || 'unknown'
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error creating ETH transfer: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // ERC20 transfer tool
  server.tool(
    "createErc20Transfer",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      amount: z.string().min(1)
    },
    async ({ safeAddress, tokenAddress, recipient, amount }) => {
      try {
        // Get chain info from config
        const { chainId, rpcUrl } = await configManager.readConfig();
        
        // Create transaction
        const result = await services.transactionService.createErc20TransferTx({
          safeAddress,
          rpcUrl,
          chainId,
          tokenAddress,
          receiverAddress: recipient,
          amount
        });
        
        // Get Safe information
        const safeInfo = await services.safeService.getSafeInfo({
          safeAddress,
          rpcUrl,
          chainId
        });
        
        // Add owners to metadata if not already present
        if (!result.metadata.owners) {
          result.metadata.owners = safeInfo.owners;
        }
        
        // Save transaction using configProvider
        await transactionManager.saveTransaction(result);
        
        // Return formatted response
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              txHash: result.hash,
              safeAddress,
              tokenAddress,
              recipient,
              amount,
              tokenSymbol: result.metadata.tokenSymbol,
              estimated_gas: result.estimatedGas?.toString() || 'unknown'
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error creating ERC20 transfer: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}

module.exports = { registerTransferTools }; 