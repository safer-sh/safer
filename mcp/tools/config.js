/**
 * Configuration tools for MCP
 * Provides tools to manage configuration for Safer
 */
const { configManager } = require('@safer-sh/common/config');
const { parseChain } = require('@safer-sh/common/config/utils');
const { z } = require('zod');

/**
 * Register configuration tools to the server
 * @param {Object} server MCP server instance
 */
function registerConfigTools(server) {
  // Unified configuration management
  server.tool(
    "safer_config",
    {
      action: z.enum(["get", "set"]),
      chain: z.string().optional(),
      rpcUrl: z.string().optional(),
      defaultSafe: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    async (params) => {
      try {
        const { action, ...configParams } = params;
        
        switch (action) {
          case "get":
            return await handleGetConfig();
          case "set":
            return await handleSetConfig(configParams);
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Error in configuration operation: ${error.message}`,
              suggestion: getErrorSuggestion(error.message)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Get suggestions for common errors
 * @param {string} errorMessage The error message
 * @returns {string} Suggestion for fixing the error
 */
function getErrorSuggestion(errorMessage) {
  if (errorMessage.includes("getOwners")) {
    return "Configuration system is being initialized. Please try setting up your configuration first with 'safer_config set'.";
  }
  if (errorMessage.includes("network")) {
    return "Network connection issue. Please check your internet connection and RPC URL.";
  }
  if (errorMessage.includes("permission")) {
    return "Permission denied when accessing configuration files. Check your file permissions.";
  }
  return "Please check your input parameters and try again.";
}

/**
 * Handle get configuration operation
 * @returns {Object} Operation result
 */
async function handleGetConfig() {
  try {
    // Adapt to synchronous API - direct call without await
    const config = configManager.readConfig();
    const owners = configManager.getOwners();
    
    // Format configuration for display
    const formattedConfig = {
      // Network configuration
      network: {
        chain: config.chain || "Not set",
        rpcUrl: config.rpcUrl || "Not set", 
        defaultSafe: config.defaultSafe || "Not set"
      },
      // Wallet configuration
      wallets: {
        count: owners.length,
        owners: owners.map(owner => ({
          name: owner.name,
          address: owner.address,
          type: owner.type
        }))
      }
    };
    
    // Add network-specific info
    if (config.chain) {
      const { NETWORKS } = require('@safer-sh/common/constants');
      const networkInfo = parseChain(config.chain);
      
      if (networkInfo && networkInfo.chainId) {
        formattedConfig.network.chainId = networkInfo.chainId;
        
        // Include explorer URL if available
        const network = NETWORKS[networkInfo.chainId];
        if (network && network.explorer) {
          formattedConfig.network.explorer = network.explorer;
        }
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          config: formattedConfig,
          nextSteps: getNextStepsForConfig(formattedConfig)
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to get configuration: ${error.message}`);
  }
}

/**
 * Get next steps based on current configuration
 * @param {Object} config Current configuration
 * @returns {Array} List of suggested next steps
 */
function getNextStepsForConfig(config) {
  const steps = [];
  
  // Check if network is configured
  if (config.network.chain === "Not set" || config.network.rpcUrl === "Not set") {
    steps.push("Set up your network: safer_config set --chain <chain-name> --rpc-url <rpc-url>");
  }
  
  // Check if Safe is configured
  if (config.network.defaultSafe === "Not set") {
    steps.push("Set your default Safe wallet: safer_config set --default-safe <safe-address>");
  }
  
  // Check if wallets are configured
  if (config.wallets.count === 0) {
    steps.push("Add an owner wallet: safer_wallet add --name <name> --type privkey --private-key <private-key>");
  }
  
  // If everything is configured, suggest next actions
  if (steps.length === 0) {
    steps.push("Create a transaction: safer_transaction createEthTransfer --recipient <address> --amount <amount>");
    steps.push("View your Safe info: safer_admin getInfo --safe-address <address>");
  }
  
  return steps;
}

/**
 * Handle set configuration operation
 * @param {Object} params Operation parameters
 * @returns {Object} Operation result
 */
async function handleSetConfig(params) {
  const { chain, rpcUrl, defaultSafe } = params;
  const changes = [];
  
  try {
    // Adapt to synchronous API - direct call without await
    const config = configManager.readConfig();
    
    // Update chain if provided
    if (chain) {
      // Adapt to synchronous API - direct call without await
      configManager.setChain(chain);
      changes.push(`Chain set to: ${chain}`);
    }
    
    // Update RPC URL if provided
    if (rpcUrl) {
      // Adapt to synchronous API - direct call without await
      configManager.setRpcUrl(rpcUrl);
      changes.push(`RPC URL set to: ${rpcUrl}`);
    }
    
    // Update default Safe if provided
    if (defaultSafe) {
      // Adapt to synchronous API - direct call without await
      configManager.setSafeAddress(defaultSafe);
      changes.push(`Default Safe set to: ${defaultSafe}`);
    }
    
    // If no parameters provided, show message
    if (changes.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            message: "No configuration parameters provided.",
            availableParams: {
              chain: "Network name (e.g., mainnet, goerli, sepolia)",
              rpcUrl: "RPC endpoint URL",
              defaultSafe: "Default Safe address"
            },
            example: "safer_config set --chain sepolia --rpc-url https://ethereum-sepolia.publicnode.com"
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Get updated configuration for response
    // Adapt to synchronous API - direct call without await
    const updatedConfig = configManager.readConfig();
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: "Configuration updated successfully",
          changes: changes,
          currentConfig: {
            chain: updatedConfig.chain || "Not set",
            rpcUrl: updatedConfig.rpcUrl || "Not set",
            defaultSafe: updatedConfig.defaultSafe || "Not set"
          },
          nextSteps: getSuggestedNextSteps(updatedConfig)
        }, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to update configuration: ${error.message}`);
  }
}

/**
 * Get suggested next steps based on updated configuration
 * @param {Object} config Updated configuration
 * @returns {Array} List of suggested next steps
 */
function getSuggestedNextSteps(config) {
  const steps = [];
  
  // Add missing configuration suggestions
  if (!config.chain || !config.rpcUrl) {
    steps.push("Set up your network: safer_config set --chain <chain-name> --rpc-url <rpc-url>");
  }
  
  if (!config.defaultSafe) {
    steps.push("Set your default Safe wallet: safer_config set --default-safe <safe-address>");
  }
  
  // If basic configuration is complete, suggest next actions
  if (config.chain && config.rpcUrl && config.defaultSafe) {
    steps.push("Add owner wallets: safer_wallet add --name <name> --type privkey --private-key <key>");
    steps.push("View Safe information: safer_admin getInfo --safe-address <address>");
    steps.push("Create a transaction: safer_transaction createEthTransfer --recipient <address> --amount <amount>");
  }
  
  return steps;
}

module.exports = { registerConfigTools }; 