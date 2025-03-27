/**
 * File-based configuration manager implementation
 * Provides read and write operations for configuration files
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ethers } = require('ethers');
const { parseChain } = require('./utils');

class FileConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.safer');
    this.configPath = path.join(this.configDir, 'config.json');
  }

  /**
   * Ensure configuration directory exists
   */
  ensureConfigDirectory() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Read configuration file
   * @returns {Object} Configuration object
   */
  readConfig() {
    this.ensureConfigDirectory();
    
    if (!fs.existsSync(this.configPath)) {
      return { 
        defaultSafe: null, 
        rpcUrl: null,
        chain: null,
        owners: []  // Initialize empty owners array
      };
    }
    
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      config.chainId = parseChain(config.chain).chainId;
      return config;
    } catch (error) {
      throw new Error(`Unable to read configuration file: ${error.message}`);
    }
  }

  /**
   * Save configuration file
   * @param {Object} config - Configuration object
   */
  saveConfig(config) {
    this.ensureConfigDirectory();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Get all configured owners
   * @returns {Array} List of owner configurations
   */
  getOwners() {
    const config = this.readConfig();
    return config.owners || [];
  }

  /**
   * Add or update owner configuration
   * @param {Object} ownerConfig - Owner configuration
   * @param {string} ownerConfig.address - Owner's Ethereum address
   * @param {string} ownerConfig.type - Owner type (privkey, ledger)
   * @param {string} [ownerConfig.privateKey] - Private key (for privkey type)
   * @param {string} [ownerConfig.derivationPath] - Derivation path (for ledger type)
   * @param {number} [ownerConfig.accountIndex] - Account index (for ledger type)
   * @returns {Object} Added or updated owner configuration
   */
  setOwner(ownerConfig) {
    if (!ownerConfig || !ownerConfig.address || !ownerConfig.type) {
      throw new Error('Owner configuration must include address and type');
    }
    
    try {
      // Normalize address format
      const normalizedAddress = ethers.utils.getAddress(ownerConfig.address);
      
      const config = this.readConfig();
      
      // Check owner type
      if (ownerConfig.type !== 'privkey' && ownerConfig.type !== 'ledger') {
        throw new Error(`Unsupported owner type: ${ownerConfig.type}`);
      }
      
      // Validate required parameters
      if (ownerConfig.type === 'privkey' && !ownerConfig.privateKey) {
        throw new Error('Private key is required for privkey type owner');
      }
      
      if (ownerConfig.type === 'ledger' && !ownerConfig.derivationPath) {
        throw new Error('Derivation path is required for ledger type owner');
      }
      
      // Find existing owner
      const existingOwnerIndex = config.owners.findIndex(
        owner => owner.address.toLowerCase() === normalizedAddress.toLowerCase()
      );
      
      // Create owner configuration
      const owner = {
        address: normalizedAddress,
        type: ownerConfig.type,
        name: ownerConfig.name || `Owner ${config.owners.length + 1}`
      };
      
      // Add type-specific fields
      if (ownerConfig.type === 'privkey') {
        owner.privateKey = ownerConfig.privateKey;
      } else if (ownerConfig.type === 'ledger') {
        owner.derivationPath = ownerConfig.derivationPath;
      }
      
      // Update or add owner
      if (existingOwnerIndex >= 0) {
        config.owners[existingOwnerIndex] = owner;
      } else {
        config.owners.push(owner);
      }
      
      // Save configuration
      this.saveConfig(config);
      
      return { success: true, owner };
    } catch (error) {
      throw new Error(`Failed to set owner: ${error.message}`);
    }
  }

  /**
   * Remove owner configuration
   * @param {string} address - Address of owner to remove
   * @returns {boolean} true if owner was removed, false if not found
   */
  removeOwner(address) {
    try {
      const normalizedAddress = ethers.utils.getAddress(address);
      const config = this.readConfig();
      
      const initialLength = config.owners.length;
      config.owners = config.owners.filter(
        owner => owner.address.toLowerCase() !== normalizedAddress.toLowerCase()
      );
      
      // If list length hasn't changed, no matching owner was found
      if (config.owners.length === initialLength) {
        return false;
      }
      
      this.saveConfig(config);
      return true;
    } catch (error) {
      throw new Error(`Failed to remove owner: ${error.message}`);
    }
  }

  /**
   * Find owner by address
   * @param {string} address - Owner address
   * @returns {Object|null} Owner configuration or null
   */
  findOwnerByAddress(address) {
    try {
      if (!address) return null;
      
      const normalizedAddress = ethers.utils.getAddress(address);
      const owners = this.getOwners();
      
      return owners.find(
        owner => owner.address.toLowerCase() === normalizedAddress.toLowerCase()
      ) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get default Safe address
   * @returns {string|null} Safe address
   */
  getSafeAddress() {
    const config = this.readConfig();
    return config.defaultSafe;
  }

  /**
   * Set default Safe address
   * @param {string} safeAddress - Safe address
   */
  setSafeAddress(safeAddress) {
    if (!safeAddress) {
      throw new Error('Please provide a valid Safe address');
    }
    
    const config = this.readConfig();
    config.defaultSafe = safeAddress;
    this.saveConfig(config);
  }

  /**
   * Get default RPC URL
   * @returns {string|null} RPC URL
   */
  getRpcUrl() {
    const config = this.readConfig();
    return config.rpcUrl;
  }

  /**
   * Set default RPC URL
   * @param {string} rpcUrl - RPC URL
   */
  setRpcUrl(rpcUrl) {
    if (!rpcUrl) {
      throw new Error('Please provide a valid RPC URL');
    }
    
    const config = this.readConfig();
    config.rpcUrl = rpcUrl;
    this.saveConfig(config);
  }

  /**
   * Get default chain configuration
   * @returns {string|null} Chain ID or name
   */
  getChain() {
    const config = this.readConfig();
    return config.chain;
  }

  getChainId() {
    const config = this.readConfig();
    return config.chainId;
  }

  /**
   * Set default chain configuration
   * @param {string} chain - Chain ID or name
   */
  setChain(chain) {
    if (!chain) {
      throw new Error('Please provide a valid chain configuration');
    }
    
    const config = this.readConfig();
    config.chain = chain;
    this.saveConfig(config);
  }

  /**
   * Display current configuration
   * @returns {Object} Current configuration information
   */
  showConfig() {
    const config = this.readConfig();
    return {
      defaultSafe: config.defaultSafe,
      chain: config.chain,
      rpcUrl: config.rpcUrl,
      owners: config.owners
    };
  }
}

module.exports = FileConfigManager; 