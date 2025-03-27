/**
 * Configuration module entry file
 * Export configuration provider implementation
 */

const FileConfigManager = require('./FileConfigManager');
const FileTransactionManager = require('./FileTransactionManager');
const IPFSTransactionManager = require('./IPFSTransactionManager');

// create default instances
const configManager = new FileConfigManager();
const transactionManager = new FileTransactionManager(configManager);
const ipfsManager = new IPFSTransactionManager({
  readConfig: () => configManager.readConfig(),
  transactionToFile: (tx) => transactionManager.transactionToFile(tx),
  transactionFromFile: (content) => transactionManager.transactionFromFile(content)
});

module.exports = {
  FileConfigManager,
  FileTransactionManager,
  IPFSTransactionManager,
  configManager,
  transactionManager,
  ipfsManager
}; 