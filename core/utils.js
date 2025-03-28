/**
 * Core utilities for Safer wallet
 * Pure business logic without UI/CLI dependencies
 */
const { ethers } = require('ethers');
const Safe = require('@safe-global/protocol-kit').default;
const { EthersAdapter } = require('@safe-global/protocol-kit');
const { SafeNotConfiguredError } = require('./exceptions');

// SDK instance cache for singleton pattern
const sdkInstances = {
  // key format: `${chainId}:${safeAddress}:${readOnly}`
};

/**
 * Initialize Safe SDK with singleton pattern
 * 
 * @param {Object} params - Parameters for SDK initialization
 * @param {string} [params.safeAddress] - Safe wallet address
 * @param {ethers.Signer} [params.signer] - Ethers signer 
 * @param {string} [params.rpcUrl] - RPC URL
 * @param {number|string} [params.chainId] - Chain ID
 * @param {boolean} [params.readOnly=false] - Whether to initialize in read-only mode
 * @param {boolean} [params.forceNew=false] - Force creation of a new instance even if one exists
 * @returns {Object} Object containing safeSdk, provider and signer
 */
async function initializeSafeSDK(params) {
  const { 
    safeAddress, 
    signer: existingSigner, 
    rpcUrl, 
    chainId, 
    readOnly = false,
    forceNew = false
  } = params;
  
  // Validate chainId is provided
  if (!chainId) {
    throw new Error('Chain ID is required for Safe SDK initialization. Please configure a network.');
  }
  
  // Create a cache key based on parameters
  const cacheKey = `${chainId}:${safeAddress || 'no-safe'}:${readOnly}`;
  
  // Check if we already have an instance and should reuse it
  if (!forceNew && sdkInstances[cacheKey]) {
    return sdkInstances[cacheKey];
  }
  
  // Validate RPC URL
  if (!rpcUrl) {
    throw new Error('No RPC URL provided for SDK initialization');
  }
  
  // Create Provider
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // Check if we need a signer
  let signer = existingSigner;
  
  if (!signer && !readOnly) {
    // Create a dummy signer for non-read-only operations if not provided
    // This is just for SDK initialization, the real signer should be passed when actually signing
    const somePrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    signer = new ethers.Wallet(somePrivateKey, provider);
  } else if (!signer && readOnly) {
    // Use a dummy signer for read-only mode
    const somePrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    signer = new ethers.Wallet(somePrivateKey, provider);
  }
  
  // Create ethersAdapter
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer || provider
  });
  
  // Only create SDK if Safe address is provided
  let safeSdk = null;
  if (safeAddress) {
    // Create Safe instance
    safeSdk = await Safe.create({ ethAdapter, safeAddress });
  } else if (!readOnly) {
    throw new SafeNotConfiguredError();
  }
  
  const result = { safeSdk, signer, provider };
  
  // Cache the instance
  sdkInstances[cacheKey] = result;
  
  return result;
}

/**
 * Clear Safe SDK instances from cache
 * 
 * @param {string} [safeAddress] - Optional safe address to clear specific instance
 * @param {string} [chainId] - Optional chain ID to clear instances for a chain
 * @returns {number} Number of instances cleared
 */
function clearSafeSDKInstances(safeAddress, chainId) {
  let count = 0;
  
  if (safeAddress && chainId) {
    // Clear specific instance
    const patterns = [
      `${chainId}:${safeAddress}:true`, 
      `${chainId}:${safeAddress}:false`
    ];
    
    patterns.forEach(pattern => {
      if (sdkInstances[pattern]) {
        delete sdkInstances[pattern];
        count++;
      }
    });
  } else if (chainId) {
    // Clear all instances for a specific chain
    Object.keys(sdkInstances).forEach(key => {
      if (key.startsWith(`${chainId}:`)) {
        delete sdkInstances[key];
        count++;
      }
    });
  } else if (safeAddress) {
    // Clear all instances for a specific safe
    Object.keys(sdkInstances).forEach(key => {
      if (key.includes(`:${safeAddress}:`)) {
        delete sdkInstances[key];
        count++;
      }
    });
  } else {
    // Clear all instances
    count = Object.keys(sdkInstances).length;
    Object.keys(sdkInstances).forEach(key => {
      delete sdkInstances[key];
    });
  }
  
  return count;
}

/**
 * Convert transaction signatures to the format expected by the Safe SDK
 * 
 * @param {Object} signatures - Object mapping signer addresses to signatures
 * @returns {Object} Signatures in Safe SDK format
 */
function convertSignatures(signatures) {
  const result = {};
  
  for (const [signerAddress, signature] of Object.entries(signatures)) {
    // Make sure to use the lowercase address as key
    const address = signerAddress.toLowerCase();
    
    // Use only the signature data string, not the entire object
    if (signature && typeof signature === 'object') {
      if (signature.data) {
        result[address] = signature.data;
      }
    } else if (typeof signature === 'string') {
      result[address] = signature;
    }
  }
  
  return result;
}

module.exports = {
  initializeSafeSDK,
  clearSafeSDKInstances,
  convertSignatures
}; 