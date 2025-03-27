/**
 * Signer Interface
 * Defines the contract that all signer implementations must follow
 */

/**
 * SignerInterface
 * Base class for all signer implementations
 */
class SignerInterface {
  /**
   * Returns the signer's Ethereum address
   * @returns {Promise<string>} The Ethereum address
   */
  async getAddress() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Signs a message with the signer's private key
   * @param {string} message - The message to sign
   * @returns {Promise<string>} The signature
   */
  async signMessage(message) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Signs a transaction
   * @param {Object} transaction - The transaction object to sign
   * @returns {Promise<string>} The signed transaction
   */
  async signTransaction(transaction) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Checks if the signer is available/connected
   * @returns {Promise<boolean>} True if available, false otherwise
   */
  async isAvailable() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Returns the signer type identifier
   * @returns {string} The signer type ('privkey', 'ledger', etc)
   */
  getType() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Returns a label for this signer (for display purposes)
   * @returns {string} The signer label
   */
  getLabel() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Returns an ethers.js compatible signer
   * @param {Object} provider - An ethers.js provider
   * @returns {Promise<Object>} An ethers.js signer
   */
  async getSigner(provider) {
    throw new Error('Method not implemented');
  }
}

module.exports = {
  SignerInterface
}; 