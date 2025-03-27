/**
 * Admin tools for MCP
 * Provides tools to manage Safe owners and thresholds
 */
const { z } = require('zod');
const { services } = require('@safer-sh/core');
const { configManager, transactionManager } = require('@safer-sh/common/config');

/**
 * Register admin tools to the server
 * @param {Object} server MCP server instance
 */
function registerAdminTools(server) {
  // Unified admin management tool
  server.tool(
    "safer_admin",
    {
      action: z.enum(["getInfo", "addOwner", "removeOwner", "changeThreshold"]),
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      // Add owner parameters
      newOwnerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      // Remove owner parameters
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      // Threshold parameters
      threshold: z.number().optional()
    },
    async (params) => {
      const { action, ...actionParams } = params;
      
      try {
        switch (action) {
          case "getInfo":
            return await handleGetSafeInfo(actionParams);
          case "addOwner":
            return await handleAddOwner(actionParams);
          case "removeOwner":
            return await handleRemoveOwner(actionParams);
          case "changeThreshold":
            return await handleChangeThreshold(actionParams);
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Error in admin operation: ${error.message}`
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Handle get Safe info operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result with Safe info
 */
async function handleGetSafeInfo({ safeAddress }) {
  // Get chain info from config
  const { chainId, rpcUrl } = await configManager.readConfig();
  
  // Get Safe info from service
  const safeInfo = await services.safeService.getSafeInfo({
    safeAddress,
    rpcUrl,
    chainId
  });
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        safeInfo
      }, null, 2)
    }]
  };
}

/**
 * Handle add owner operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleAddOwner({ safeAddress, newOwnerAddress, threshold }) {
  // Get chain info from config
  const { chainId, rpcUrl } = await configManager.readConfig();
  
  try {
    // Create transaction using safeService instead of transactionService
    const transaction = await services.safeService.createAddOwnerTx({
      safeAddress,
      rpcUrl,
      chainId,
      newOwnerAddress,
      threshold: parseInt(threshold)
    });
    
    // Save transaction
    await transactionManager.saveTransaction(transaction);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Add owner transaction created successfully`,
          txHash: transaction.hash,
          safeAddress,
          newOwnerAddress,
          threshold,
          nextSteps: [
            `Sign this transaction: safer_transaction sign --tx-hash ${transaction.hash} --signer <identifier>`,
            `View transaction details: safer_transaction getDetails --tx-hash ${transaction.hash}`
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create add owner transaction: ${error.message}`);
  }
}

/**
 * Handle remove owner operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleRemoveOwner({ safeAddress, ownerAddress, threshold }) {
  // Get chain info from config
  const { chainId, rpcUrl } = await configManager.readConfig();
  
  try {
    // Create transaction using safeService instead of transactionService
    const transaction = await services.safeService.createRemoveOwnerTx({
      safeAddress,
      rpcUrl,
      chainId,
      ownerAddress,
      threshold: parseInt(threshold)
    });
    
    // Save transaction
    await transactionManager.saveTransaction(transaction);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Remove owner transaction created successfully`,
          txHash: transaction.hash,
          safeAddress,
          ownerAddress,
          threshold,
          nextSteps: [
            `Sign this transaction: safer_transaction sign --tx-hash ${transaction.hash} --signer <identifier>`,
            `View transaction details: safer_transaction getDetails --tx-hash ${transaction.hash}`
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create remove owner transaction: ${error.message}`);
  }
}

/**
 * Handle change threshold operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleChangeThreshold({ safeAddress, threshold }) {
  // Get chain info from config
  const { chainId, rpcUrl } = await configManager.readConfig();
  
  try {
    // Create transaction using safeService instead of transactionService
    const transaction = await services.safeService.createChangeThresholdTx({
      safeAddress,
      rpcUrl,
      chainId,
      threshold: parseInt(threshold)
    });
    
    // Save transaction
    await transactionManager.saveTransaction(transaction);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Change threshold transaction created successfully`,
          txHash: transaction.hash,
          safeAddress,
          threshold,
          nextSteps: [
            `Sign this transaction: safer_transaction sign --tx-hash ${transaction.hash} --signer <identifier>`,
            `View transaction details: safer_transaction getDetails --tx-hash ${transaction.hash}`
          ]
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create change threshold transaction: ${error.message}`);
  }
}

module.exports = { registerAdminTools };