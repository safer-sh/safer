/**
 * CLI config command
 */
const { ethers } = require('ethers');
const {
  loading,
  address,
  secondary,
  log,
  createVerboseLogger
} = require('../logger');
const { handleError } = require('../error-handlers');
const { configManager } = require('@safer-sh/common/config');
const { DEFAULTS } = require('@safer-sh/common/constants');
const { parseChain, resolveOwnerFromIdentifier } = require('@safer-sh/common/config/utils');
const { getAddressFromLedger } = require('@safer-sh/ledger-signer');
/**
 * Get address from Ledger device
 * @param {string} pathTypeOrCustomPath - Path type ('live', 'legacy') or custom derivation path
 * @param {number} accountIndex - Account index
 * @returns {Promise<string>} Ethereum address
 */
async function getLedgerAddress(pathTypeOrCustomPath, accountIndex) {
  try {
    // Connect to Ledger device
    loading('Connecting to Ledger device');
    
    let fullPath;
    if (pathTypeOrCustomPath.startsWith('m/')) {
      // If it's a full path, use it directly
      fullPath = pathTypeOrCustomPath;
      loading(`Getting address from Ledger at path ${fullPath}`);
    } else {
      // If it's an alias, use accountIndex
      const { address, fullPath: derivedPath } = await getAddressFromLedger(pathTypeOrCustomPath, accountIndex);
      fullPath = derivedPath;
      loading(`Getting address from Ledger at path ${fullPath} (${pathTypeOrCustomPath}, account ${accountIndex})`);
    }
    
    // Get address from Ledger
    const { address } = await getAddressFromLedger(fullPath);
    
    return {
      address: ethers.utils.getAddress(address),
      fullPath: fullPath
    };
  } catch (err) {
    throw new Error(`Failed to get address from Ledger: ${err.message}`);
  }
}

/**
 * Handle config command
 * 
 * @param {Object} globalOptions - Global CLI options
 * @param {Object} commandOptions - Command specific options
 * @returns {boolean} Success or failure
 */
async function handleConfig(globalOptions, commandOptions) {
  try {
    // Define verbose logger
    const verboseLogger = createVerboseLogger(commandOptions.verbose);
    verboseLogger.debug('Config command started');
    
    // Track if any configuration changes were made
    let configChanged = false;
    
    // Handle Pinata API keys settings - allow setting both in one command
    if (commandOptions.setPinataApiKey || commandOptions.setPinataSecret) {
      verboseLogger.debug('Setting Pinata API credentials');
      const config = await configManager.readConfig();
      
      if (commandOptions.setPinataApiKey) {
        verboseLogger.debug('Setting Pinata API key');
        config.pinataApiKey = commandOptions.setPinataApiKey;
        log.success('Pinata API key has been set');
      }
      
      if (commandOptions.setPinataSecret) {
        verboseLogger.debug('Setting Pinata Secret API key');
        config.pinataSecretApiKey = commandOptions.setPinataSecret;
        log.success('Pinata Secret API key has been set');
      }
      
      await configManager.saveConfig(config);
      configChanged = true;
    }
    
    // Handle adding a new private key owner
    if (commandOptions.addPrivkeyOwner) {
      verboseLogger.debug('Adding private key owner');
      const privateKey = commandOptions.privateKey;
      
      if (!privateKey) {
        log.error('Missing --private-key parameter');
        return false;
      }
      
      try {
        // Create wallet from private key to validate format and get address
        const wallet = new ethers.Wallet(privateKey);
        const ownerAddress = wallet.address;
        verboseLogger.debug(`Wallet address from private key: ${ownerAddress}`);
        
        loading(`Adding privkey owner with address ${address(ownerAddress)}`);
        
        // Set owner
        await configManager.setOwner({
          address: ownerAddress,
          type: 'privkey',
          privateKey: privateKey,
          name: commandOptions.name || `Private Key Owner`
        });
        verboseLogger.debug('Owner successfully saved to configuration');
        
        log.success(`Added owner ${address(ownerAddress)} with private key`);
        configChanged = true;
        return true;
      } catch (err) {
        log.error(`Invalid private key: ${err.message}`);
        return false;
      }
    } 
    // Handle adding a new Ledger owner
    else if (commandOptions.addLedgerOwner) {
      const pathType = commandOptions.path || 'live';
      const accountIndex = parseInt(commandOptions.account || '0', 10);
      verboseLogger.debug(`Adding Ledger owner with path type: ${pathType}, account: ${accountIndex}`);
      
      try {
        // Get address from Ledger
        verboseLogger.debug('Attempting to connect to Ledger device...');
        const { address: ownerAddress, fullPath } = await getLedgerAddress(pathType, accountIndex);
        verboseLogger.debug(`Got address from Ledger: ${ownerAddress}`);
        
        // Set owner
        await configManager.setOwner({
          address: ownerAddress,
          type: 'ledger',
          derivationPath: fullPath,
          name: commandOptions.name || `Ledger Owner (${pathType}, account ${accountIndex})`
        });
        verboseLogger.debug('Owner successfully saved to configuration');
        
        log.success(`Added Ledger owner ${address(ownerAddress)} with path ${fullPath}`);
        configChanged = true;
        return true;
      } catch (err) {
        log.error(`Failed to add Ledger owner: ${err.message}`);
        return false;
      }
    }
    // Handle removing owner
    else if (commandOptions.removeOwner) {
      verboseLogger.debug(`Remove owner: ${commandOptions.removeOwner}`);
      const result = await configManager.removeOwner(commandOptions.removeOwner);
      
      if (result) {
        log.success(`Owner removed: ${address(commandOptions.removeOwner)}`);
        configChanged = true;
      } else {
        log.error(`Failed to remove owner: ${address(commandOptions.removeOwner)}`);
        return false;
      }
    }
    // Handle setting default Safe address
    if (commandOptions.setSafe) {
      verboseLogger.debug(`Setting default Safe address: ${commandOptions.setSafe}`);
      
      // Validate address format
      try {
        ethers.utils.getAddress(commandOptions.setSafe);
      } catch (error) {
        log.error(`Invalid Ethereum address: ${commandOptions.setSafe}`);
        return false;
      }
      
      configManager.setSafeAddress(commandOptions.setSafe);
      log.success(`Default Safe address set to: ${address(commandOptions.setSafe)}`);
      configChanged = true;
    }
    
    // Handle setting default chain
    if (commandOptions.setChain) {
      verboseLogger.debug(`Setting default chain: ${commandOptions.setChain}`);
      configManager.setChain(commandOptions.setChain);
      log.success(`Default chain set to: ${commandOptions.setChain}`);
      configChanged = true;
    }
    
    // Handle setting default RPC URL
    if (commandOptions.setRpcUrl) {
      verboseLogger.debug(`Setting default RPC URL: ${commandOptions.setRpcUrl}`);
      configManager.setRpcUrl(commandOptions.setRpcUrl);
      log.success(`Default RPC URL set to: ${commandOptions.setRpcUrl}`);
      configChanged = true;
    }
    
    // Display current configuration if no specific action or after changes
    if (!configChanged) {
      // Load current configuration
      verboseLogger.debug('Loading current configuration');
      const defaultSafe = configManager.getSafeAddress();
      const defaultChain = configManager.getChain();
      const defaultRpcUrl = configManager.getRpcUrl();
      
      // Read full config for Pinata API keys
      const fullConfig = await configManager.readConfig();
      const hasPinataKeys = fullConfig.pinataApiKey && fullConfig.pinataSecretApiKey;
      
      // Print configuration info
      log.empty();
      log.header('CURRENT CONFIGURATION');
      log.plain(`Default Safe: ${defaultSafe ? address(defaultSafe) : secondary('Not set')}`);
      log.plain(`Default Chain: ${defaultChain || secondary('Not set')}`);
      log.plain(`Default RPC URL: ${defaultRpcUrl || secondary('Not set')}`);
      log.plain(`Pinata API Keys: ${hasPinataKeys ? secondary('Configured') : secondary('Not set')}`);
      
      log.empty();
      log.header('WALLETS');
      
      const owners = configManager.getOwners();
      verboseLogger.debug(`Found ${owners.length} owners`);
      
      if (owners.length === 0) {
        log.secondary('No owners configured');
      } else {
        owners.forEach((owner, index) => {
          const ownerType = owner.type === 'ledger' ? 'Ledger' : 'Private Key';
          log.plain(`${index + 1}. ${owner.name || address(owner.address)} (${ownerType})`);
          log.secondary(`   ${address(owner.address)}`);
        });
      }
    }
    
    return true;
  } catch (err) {
    return handleError(err, globalOptions.verbose);
  }
}

// Import functions from config-helper.js
/**
 * Get Safe address, priority: command line > configuration
 * 
 * @param {Object} options - CLI options
 * @returns {Promise<string>} Safe address
 */
async function getSafeAddress(options) {
  // Try to get Safe address from command line
  if (options && options.safe) {
    return options.safe;
  }

  // Try to get default Safe address from configuration
  const configSafe = await configManager.getSafeAddress();
  if (configSafe) {
    return configSafe;
  }

  throw new Error('Safe address not specified. Please use --safe parameter or set default Safe address via "safer config --set-safe"');
}

/**
 * Get chain information
 * 
 * @param {Object} options - CLI options
 * @returns {Promise<Object>} Chain information
 */
async function getChainInfo(options) {
  let chainId, chainName, rpcUrl;
  
  // Get default RPC URL from configuration
  const defaultRpcUrl = await configManager.getRpcUrl();
  
  // Use command line RPC URL if specified
  if (options && options.rpcUrl) {
    rpcUrl = options.rpcUrl;
  } else {
    // Get chain identifier, priority: command line > configuration > default
    if (options && options.chain) {
      // User specified chain in command line
      const chainIdentifier = options.chain;
      const chainInfo = parseChain(chainIdentifier);
      chainId = chainInfo.chainId;
      chainName = chainInfo.networkName;
      rpcUrl = defaultRpcUrl;
    } else {
      // Try to get default chain from configuration
      const defaultChain = await configManager.getChain();
      if (defaultChain) {
        const chainInfo = parseChain(defaultChain);
        chainId = chainInfo.chainId;
        chainName = chainInfo.networkName;
        rpcUrl = defaultRpcUrl;
      } else {
        // Use default chain from DEFAULTS
        const chainInfo = parseChain(DEFAULTS.CHAIN_NAME);
        chainId = chainInfo.chainId || DEFAULTS.CHAIN_ID;
        chainName = chainInfo.networkName || DEFAULTS.CHAIN_NAME;
        rpcUrl = defaultRpcUrl;
      }
    }
    
    // If still no RPC URL, use default
    if (!rpcUrl) {
      rpcUrl = defaultRpcUrl;
    }
  }
  
  if (!rpcUrl) {
    throw new Error('No RPC URL available. Please use --rpc-url parameter, set --chain, or configure default RPC URL');
  }
  
  return { chainId, chainName, rpcUrl };
}

/**
 * Get chain ID
 * 
 * @param {Object} options - CLI options
 * @returns {Promise<string>} Chain ID
 */
async function getChainId(options) {
  const { chainId } = await getChainInfo(options);
  return chainId;
}

/**
 * Get owner address based on various input formats
 * 
 * @param {string} addressInput - Owner identifier (address, name, tail, index)
 * @returns {Promise<string>} Complete Ethereum address, or null if not found
 */
async function getOwnerAddress(addressInput) {
  if (!addressInput) return null;
  
  // Case 1: Complete Ethereum address - return directly (after normalization)
  if (addressInput.startsWith('0x') && addressInput.length === 42) {
    try {
      return ethers.utils.getAddress(addressInput);
    } catch (e) {
      log.warning(`Invalid Ethereum address format: ${addressInput}`);
      return null;
    }
  }
  
  // Get all configured owners
  const configOwners = await configManager.getOwners();
  if (!configOwners || configOwners.length === 0) {
    log.warning('No owners found in configuration');
    return null;
  }
  
  // Use the common resolveOwnerFromIdentifier function
  const owner = resolveOwnerFromIdentifier(addressInput, configOwners);
  
  if (!owner) {
    log.warning(`Could not find owner address for "${addressInput}"`);
    
    // If we have configured owners, show available options as helpful hint
    if (configOwners.length > 0) {
      log.warning('Available owners:');
      configOwners.forEach((owner, index) => {
        let name = owner.name || `Owner ${index + 1}`;
        let shortAddress = owner.address.substring(0, 6) + '...' + owner.address.substring(owner.address.length - 4);
        log.plain(`  ${index + 1}. ${name} (${shortAddress})`);
      });
    }
    
    return null;
  } else if (owner.error === 'multiple_matches') {
    // If multiple matches, show options but return null
    log.warning(`Multiple owners contain "${addressInput}" in their name:`);
    owner.matches.forEach(match => {
      log.plain(`  - ${match.name}: ${match.address}`);
    });
    log.warning('Please use a more specific name or address');
    return null;
  }
  
  // Return the normalized address
  return ethers.utils.getAddress(owner.address);
}

module.exports = {
  handleConfig,
  getSafeAddress,
  getChainInfo,
  getChainId,
  getOwnerAddress,
};