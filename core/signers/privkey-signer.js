/**
 * Private Key Signer Implementation
 * 
 * This implements the SignerInterface using a private key stored in memory.
 */
const { ethers } = require('ethers');
const { SignerInterface } = require('./interface');

/**
 * PrivateKeySigner class for signing with a private key
 * @extends SignerInterface
 */
class PrivateKeySigner extends SignerInterface {
  /**
   * Create a new PrivateKeySigner
   * @param {Object} options - Configuration options
   * @param {string} options.privateKey - The private key
   * @param {string} [options.label] - Optional label for this signer
   */
  constructor(options) {
    super();
    
    if (!options || !options.privateKey) {
      throw new Error('Private key is required for PrivateKeySigner');
    }
    
    this.privateKey = options.privateKey;
    this.label = options.label || 'Private Key Signer';
    this._wallet = new ethers.Wallet(this.privateKey);
  }
  
  /**
   * Get the signer's Ethereum address
   * @returns {Promise<string>} The Ethereum address
   */
  async getAddress() {
    return this._wallet.address;
  }
  
  /**
   * Sign a message
   * @param {string} message - The message to sign
   * @param {Object} [provider] - Optional ethers.js provider
   * @returns {Promise<string>} The signature
   */
  async signMessage(message, provider) {
    const signer = provider ? this._wallet.connect(provider) : this._wallet;
    return signer.signMessage(message);
  }
  
  /**
   * Sign a transaction
   * @param {Object} transaction - The transaction to sign
   * @param {Object} [provider] - Optional ethers.js provider
   * @returns {Promise<string>} The signed transaction
   */
  async signTransaction(transaction, provider) {
    const signer = provider ? this._wallet.connect(provider) : this._wallet;
    return signer.signTransaction(transaction);
  }
  
  /**
   * Check if the signer is available
   * @returns {Promise<boolean>} Always returns true for private key signer
   */
  async isAvailable() {
    return true; // Private key signer is always available
  }
  
  /**
   * Get the signer type
   * @returns {string} The string 'privkey'
   */
  getType() {
    return 'privkey';
  }
  
  /**
   * Get the label for this signer
   * @returns {string} The signer label
   */
  getLabel() {
    return this.label;
  }
  
  /**
   * Get an ethers.js compatible signer
   * @param {Object} [provider] - Optional ethers.js provider
   * @returns {Promise<Object>} An ethers.js wallet
   */
  async getSigner(provider) {
    return provider ? this._wallet.connect(provider) : this._wallet;
  }
}

module.exports = {
  PrivateKeySigner
}; 