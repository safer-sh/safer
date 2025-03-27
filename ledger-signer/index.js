/**
 * Ledger Hardware Wallet Signer Implementation
 * 
 * This implements the SignerInterface from the core module
 * using Ledger hardware wallet with hw-transport-node-hid and hw-app-eth libraries.
 */
const { ethers } = require('ethers');
const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid').default;
const Eth = require('@ledgerhq/hw-app-eth').default;
const { SignerInterface } = require('@safer-sh/core').signers;

// Cache the connected transport instance to avoid redundant connections
let cachedTransport = null;

// Derivation path types
const DERIVATION_PATH_TYPES = {
  LIVE: 'live',     // Ledger Live path (BIP44 standard): m/44'/60'/x'/0/0
  LEGACY: 'legacy'  // Legacy Ledger path: m/44'/60'/0'/x
};

/**
 * Get default derivation path with proper account index
 * 
 * @param {number} accountIndex - Account index to use (0-based)
 * @param {string} pathType - Path type from DERIVATION_PATH_TYPES
 * @returns {string} Full derivation path
 */
function getDerivationPath(accountIndex, path = DERIVATION_PATH_TYPES.LIVE) {
  const index = accountIndex || 0;
  switch (path.toLowerCase()) {
    case DERIVATION_PATH_TYPES.LIVE:
      return `m/44'/60'/${index}'/0/0`;
    case DERIVATION_PATH_TYPES.LEGACY:
      return `m/44'/60'/${index}'/0`;
    default:
      return path; // Default to provided path
  }
}

/**
 * Open connection to Ledger device
 * 
 * @returns {Promise<{transport: Transport, eth: Eth}>} Ledger transport and Eth app instances
 */
async function openLedgerConnection() {
  try {
    // Try to use cached transport
    if (cachedTransport) {
      try {
        // Check if transport is still valid
        await cachedTransport.send(0, 0, 0, 0);
        return { 
          transport: cachedTransport, 
          eth: new Eth(cachedTransport)
        };
      } catch (err) {
        // Transport is no longer valid, need to reconnect
        try {
          await cachedTransport.close();
        } catch (e) {
          // Ignore close errors
        }
        cachedTransport = null;
      }
    }
    
    // Create a new transport
    const transport = await TransportNodeHid.create();
    cachedTransport = transport;
    
    // Initialize Ethereum app
    const eth = new Eth(transport);
    
    return { transport, eth };
  } catch (error) {
    throw new Error(`Ledger connection failed: ${error.message}`);
  }
}

/**
 * Close connection to Ledger device
 * @param {Transport} transport - The transport to close
 */
async function closeLedgerConnection(transport) {
  try {
    // Only close if it's not the cached transport
    if (transport && transport !== cachedTransport) {
      await transport.close();
    }
  } catch (e) {
    // Ignore close errors
    console.warn(`Warning: Failed to close Ledger connection: ${e.message}`);
  }
}

/**
 * LedgerSigner class implementing SignerInterface for Ledger hardware wallets
 * @extends SignerInterface
 */
class LedgerSigner extends SignerInterface {
  /**
   * Create a new LedgerSigner
   * @param {Object} provider - Ethers.js provider
   */
  constructor(provider) {
    super();
    this.provider = provider;
  }
  
  /**
   * Initialize the signer with specific options
   * @param {Object} options - Options for the signer
   * @param {string} [options.path] - Derivation path (complete or using templates/aliases)
   * @param {number} [options.account] - Account index (0-based) - Optional, for backward compatibility
   * @returns {Promise<LedgerSigner>} This signer instance
   */
  async init(options) {
    // Validate options
    if (!options) {
      throw new Error('Options are required for LedgerSigner initialization');
    }
    
    this.path = options.path;
    this.account = options.account;
    this.label = options.label || `Ledger`;
    
    this.derivationPath = getDerivationPath(this.account, this.path);
    
    return this;
  }
  
  /**
   * Get an ethers.js compatible signer
   * @param {Object} provider - Ethers.js provider
   * @returns {Promise<Object>} A signer object
   */
  async getSigner(provider) {
    let transport = null;
    
    try {
      // Connect to Ledger
      const { transport: t, eth } = await openLedgerConnection();
      transport = t;
      
      // Get address
      const { address } = await eth.getAddress(this.derivationPath);
      
      // Create custom signer with our address
      const customSigner = new ethers.VoidSigner(address, provider);
      
      // Override signMessage method
      customSigner.signMessage = async (message) => {
        // Need to reconnect for each operation
        const { transport: t, eth } = await openLedgerConnection();
        try {
          // Convert the message to hex
          const messageHex = ethers.utils.hexlify(
            typeof message === 'string'
              ? ethers.utils.toUtf8Bytes(message)
              : message
          ).substring(2);

          // Sign the message with the Ledger device
          const result = await eth.signPersonalMessage(this.derivationPath, messageHex);

          // Adjust the v value (Ledger returns v=0 or v=1)
          const v = parseInt(result.v, 16);
          const adjustedV = v < 27 ? v + 27 : v;

          // Construct signature
          const signature = ethers.utils.joinSignature({
            r: '0x' + result.r,
            s: '0x' + result.s,
            v: adjustedV
          });

          // Verify signature format
          if (signature.length !== 132) {
            throw new Error(`Generated signature has unusual length (${signature.length} chars, expected 132)`);
          }

          return signature;
        } finally {
          await closeLedgerConnection(t);
        }
      };
      
      // Override signTransaction method
      customSigner.signTransaction = async (transaction) => {
        // Need to reconnect for each operation
        const { transport: t, eth } = await openLedgerConnection();
        try {
          // Ledger Nano S has a transaction size limitation
          const serializedTx = ethers.utils.serializeTransaction(transaction);
          if (serializedTx.length > 1500) {
            throw new Error(`Transaction size (${serializedTx.length} bytes) may exceed Ledger Nano S capacity. Consider using Nano X or simplifying the transaction.`);
          }

          // Convert transaction to format needed by Ledger
          const ledgerTx = {
            ...transaction,
            gasPrice: transaction.gasPrice?._hex || transaction.gasPrice,
            value: transaction.value?._hex || transaction.value || "0x0",
            nonce: transaction.nonce != null ? ethers.utils.hexlify(transaction.nonce) : undefined,
            data: transaction.data || "0x",
          };

          // Sign transaction on Ledger
          const result = await eth.signTransaction(
            this.derivationPath, 
            ethers.utils.serializeTransaction(ledgerTx).substring(2),
            null
          );

          // Adjust v value (Ledger usually returns v=0 or v=1)
          const v = parseInt(result.v, 16);
          const adjustedV = v < 27 ? v + 27 : v;

          // Create signature object
          const signature = {
            r: '0x' + result.r,
            s: '0x' + result.s,
            v: adjustedV
          };

          // Create signed transaction with signature
          const signedTransaction = ethers.utils.serializeTransaction(transaction, signature);
          return signedTransaction;
        } catch (err) {
          // Check if it's a transaction size issue
          if (err.message && (
            err.message.includes('Buffer too small') ||
            err.message.includes('data too large') ||
            err.message.includes('output buffer too small')
          )) {
            throw new Error(
              `Transaction too large for Ledger Nano S. Try using a Ledger Nano X or S Plus.`
            );
          }
          throw err;
        } finally {
          await closeLedgerConnection(t);
        }
      };
      
      // Implement EIP-712 signing (typed data)
      customSigner._signTypedData = async (domain, types, value) => {
        // Need to reconnect for each operation as connection may be closed
        const { transport: t, eth } = await openLedgerConnection();
        try {
          // First check if the Ledger supports EIP-712
          // This requires Ethereum app version >= 1.6.0
          const appConfig = await eth.getAppConfiguration();
          
          // Parse version string like "1.9.10"
          const versionParts = (appConfig.version || "0.0.0").split('.').map(Number);
          const [major, minor] = versionParts;
          
          // Check if version supports EIP-712 (required >= 1.6.0)
          if (major < 1 || (major === 1 && minor < 6)) {
            throw new Error(
              `Your Ledger Ethereum app (v${appConfig.version}) does not support EIP-712 signing. ` +
              `Please update to at least version 1.6.0.`
            );
          }
          
          // Calculate hash in the same way as original code
          const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain);
          const hashStruct = ethers.utils._TypedDataEncoder.hashStruct(
            ethers.utils._TypedDataEncoder.getPrimaryType(types),
            types,
            value
          );
          
          // Calculate final signature digest
          const signingDigest = ethers.utils._TypedDataEncoder.hash(domain, types, value);
          
          // Remove 0x prefix from the hex string
          const signingDigestHex = signingDigest.substring(2);
          
          // Sign the hash on the Ledger
          const result = await eth.signEIP712HashedMessage(
            this.derivationPath,
            domainSeparator.substring(2),
            hashStruct.substring(2)
          );
          
          // Adjust v value (Ledger returns v=0 or v=1)
          const v = parseInt(result.v, 16);
          const adjustedV = v < 27 ? v + 27 : v;
          
          // Create signature
          const signature = ethers.utils.joinSignature({
            r: '0x' + result.r,
            s: '0x' + result.s,
            v: adjustedV
          });
          
          return signature;
        } finally {
          await closeLedgerConnection(t);
        }
      };
      
      return customSigner;
    } catch (error) {
      if (transport) {
        await closeLedgerConnection(transport);
      }
      throw error;
    }
  }
  
  /**
   * Sign a message
   * @param {string} message - The message to sign
   * @param {Object} provider - Ethers.js provider
   * @returns {Promise<string>} Signature
   */
  async signMessage(message, provider) {
    const signer = await this.getSigner(provider);
    return signer.signMessage(message);
  }
  
  /**
   * Sign a transaction
   * @param {Object} transaction - The transaction to sign
   * @param {Object} provider - Ethers.js provider
   * @returns {Promise<string>} Signed transaction
   */
  async signTransaction(transaction, provider) {
    const signer = await this.getSigner(provider);
    return signer.signTransaction(transaction);
  }
  
  /**
   * Get the signer's Ethereum address
   * @returns {Promise<string>} Ethereum address
   */
  async getAddress() {
    let transport = null;
    try {
      const connection = await openLedgerConnection();
      transport = connection.transport;
      const { address } = await connection.eth.getAddress(this.derivationPath);
      return address;
    } finally {
      if (transport) {
        await closeLedgerConnection(transport);
      }
    }
  }
  
  /**
   * Check if the Ledger device is available
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      const { transport } = await openLedgerConnection();
      await closeLedgerConnection(transport);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get the signer type
   * @returns {string} Always returns 'ledger'
   */
  getType() {
    return 'ledger';
  }
  
  /**
   * Get the label for this signer
   * @returns {string} The signer label
   */
  getLabel() {
    return this.label || `Ledger (${this.derivationPath})`;
  }
}

/**
 * Get address from Ledger device without creating a full signer instance
 * @param {string} pathTypeOrCustomPath - Path type ('live', 'legacy') or custom derivation path
 * @param {number} accountIndex - Account index
 * @returns {Promise<{address: string, fullPath: string}>} Address and derivation path
 */
async function getAddressFromLedger(pathTypeOrCustomPath, accountIndex) {
  // Create default provider
  const provider = ethers.getDefaultProvider();
  
  const ledgerSigner = new LedgerSigner(provider);
  try {
    // Connect to Ledger device
    const signer = await ledgerSigner.init({
      path: pathTypeOrCustomPath,
      account: accountIndex
    });
    
    // Get address from Ledger
    const address = await signer.getAddress();
    return {
      address: ethers.utils.getAddress(address),
      fullPath: signer.derivationPath
    };
  } catch (err) {
    throw new Error(`Failed to get address from Ledger: ${err.message}`);
  }
}

module.exports = {
  LedgerSigner,
  DERIVATION_PATH_TYPES,
  getAddressFromLedger
}; 