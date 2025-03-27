/**
 * Configuration utilities
 * Helper functions for working with configuration
 */
const { NETWORKS } = require('../constants');
const { ethers } = require('ethers');

/**
 * Resolve an owner from identifier (address, name, or partial identifier)
 * 
 * @param {string} addressInput - The address or identifier input
 * @param {Array} configOwners - Array of configured owners
 * @returns {Object|null} - The matched owner config or null if not found
 */
function resolveOwnerFromIdentifier(addressInput, configOwners) {
  if (!addressInput || !configOwners || configOwners.length === 0) return null;
  
  // Case 1: Complete Ethereum address - match directly
  if (addressInput.startsWith('0x') && addressInput.length === 42) {
    return configOwners.find(
      owner => owner.address.toLowerCase() === addressInput.toLowerCase()
    );
  }
  
  // Case 2: Exact owner name match
  const exactNameMatch = configOwners.find(
    owner => owner.name && owner.name.toLowerCase() === addressInput.toLowerCase()
  );
  if (exactNameMatch) {
    return exactNameMatch;
  }
  
  // Case 3: Address tail - check if input matches end of any address
  if (addressInput.length >= 3 && addressInput.length < 42) {
    const tailMatch = configOwners.find(
      owner => owner.address.toLowerCase().endsWith(addressInput.toLowerCase())
    );
    if (tailMatch) {
      return tailMatch;
    }
  }
  
  // Case 4: Numeric index - if input is a number, prioritize index matching
  if (!isNaN(addressInput)) {
    const index = parseInt(addressInput, 10) - 1;
    if (index >= 0 && index < configOwners.length) {
      return configOwners[index];
    }
  }
  
  // Case 5: Partial owner name match (only for non-numeric input)
  if (isNaN(addressInput)) {
    const partialNameMatches = configOwners.filter(
      owner => owner.name && owner.name.toLowerCase().includes(addressInput.toLowerCase())
    );
    
    if (partialNameMatches.length === 1) {
      // If only one match, use it
      return partialNameMatches[0];
    } else if (partialNameMatches.length > 1) {
      // For the MCP/API approach, just returning null is better
      // The calling code should handle the ambiguity with a clear error message
      return { 
        error: 'multiple_matches',
        matches: partialNameMatches 
      };
    }
  }
  
  // If we get here, no match was found
  return null;
}

/**
 * Parse chain parameter to get network name and chain ID
 * 
 * @param {string} chainInput - Chain input (network name or chain ID)
 * @returns {Object} Object with networkName and chainId properties
 */
function parseChain(chainInput) {
  if (/^\d+$/.test(chainInput)) {
    // Input is a number, treat as chain ID
    const chainId = chainInput;
    const network = NETWORKS[chainId];
    
    if (network) {
      return { networkName: network.name, chainId };
    } else {
      // Return generated name for unknown chain IDs
      return { networkName: `chain-${chainId}`, chainId };
    }
  } else {
    // Input is a name, treat as network name
    const networkName = chainInput.toLowerCase();
    
    // Find matching network by name
    const entry = Object.entries(NETWORKS).find(
      ([_, info]) => info.name === networkName
    );
    
    if (entry) {
      return { networkName, chainId: entry[0] };
    } else {
      // No matching chainId found for the network name
      return { networkName, chainId: null };
    }
  }
}

/**
 * Extract INFURA API key from URL
 * 
 * @param {string} url - RPC URL
 * @returns {string|null} Extracted API key or null
 */
function extractInfuraApiKey(url) {
  if (url && url.includes('infura.io/v3/')) {
    const apiKeyMatch = url.match(/infura\.io\/v3\/([a-zA-Z0-9]+)/);
    if (apiKeyMatch && apiKeyMatch[1]) {
      return apiKeyMatch[1];
    }
  }
  return null;
}

/**
 * Initialize signer from configuration
 * 
 * @param {Object} ownerConfig - Owner configuration
 * @param {string} rpcUrl - RPC URL
 * @returns {Promise<ethers.Signer>} Ethereum signer
 */
async function initializeSigner(ownerConfig, rpcUrl) {
  try {
    // Create provider
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    let signer;
    
    // Create signer based on type
    if (ownerConfig.type === 'privkey') {
      if (!ownerConfig.privateKey) {
        throw new Error('Private key is required for PrivateKeySigner');
      }
      
      // For private key wallets, use ethers wallet signer
      signer = new ethers.Wallet(ownerConfig.privateKey, provider);
    } else if (ownerConfig.type === 'ledger') {
      // For Ledger wallets, use LedgerSigner
      const { LedgerSigner } = require('@safer-sh/ledger-signer');
      
      // Initialize LedgerSigner
      signer = await new LedgerSigner(provider).init({
        path: ownerConfig.derivationPath,
        label: ownerConfig.name || 'Ledger'
      });
    } else {
      throw new Error(`Unsupported signer type: ${ownerConfig.type}`);
    }
    
    // Verify address if provided
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== ownerConfig.address.toLowerCase()) {
      throw new Error(`Signer address mismatch. Expected: ${ownerConfig.address}, Got: ${signerAddress}`);
    }
    
    return signer;
  } catch (error) {
    throw new Error(`Failed to initialize signer: ${error.message}`);
  }
}

module.exports = {
  parseChain,
  extractInfuraApiKey,
  resolveOwnerFromIdentifier,
  initializeSigner
}; 