/**
 * Signer index file
 * Export the signer interface and core implementations
 * 
 * Note: External signer implementations (like Ledger) should be imported
 * directly from their respective packages at the CLI/application level.
 */

// Import the interface
const { SignerInterface } = require('./interface');

// Import core implementations
const { PrivateKeySigner } = require('./privkey-signer');

// Export everything
module.exports = {
  // Interface
  SignerInterface,
  
  // Core implementations
  PrivateKeySigner
}; 