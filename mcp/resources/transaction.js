/**
 * Transaction resources
 * Provides access to transaction information
 */
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { configManager } = require('@safer-sh/common/config');
const { transactionManager } = require('@safer-sh/common/config');

/**
 * Register transaction-related resources to the server
 * @param {Object} server MCP server instance
 */
function registerTransactionResources(server) {
  // Transaction details resource
  server.resource(
    "transaction-details",
    new ResourceTemplate("tx://{identifier}", { list: undefined }),
    async (uri, { identifier }) => {
      try {
        // Get chain info from config
        const { chainId } = await configManager.readConfig();
        
        // Get transaction details from config provider
        const transactionInfo = await transactionManager.loadTransaction(identifier);
        
        // If transaction data not found, this will throw an error that we'll catch
        
        // Get confirmations if available
        const confirmations = transactionInfo.confirmations || [];
        
        // Format signatures information
        const signaturesList = confirmations.map(confirmation => {
          return `- ${confirmation.owner || confirmation.signer} (${confirmation.signature || 'No signature'})`;
        }).join('\n') || 'No confirmations yet';
        
        // Format text response
        const textResponse = `
# Transaction Details

## General Information
- Transaction Hash: ${transactionInfo.hash}
- Safe Address: ${transactionInfo.safeAddress}
- Network: ${chainId}
- Status: ${transactionInfo.status || (transactionInfo.isExecuted ? 'Executed' : 'Pending')}
- Confirmations: ${confirmations.length}/${transactionInfo.threshold || '?'}
- Can Execute: ${transactionInfo.canExecute ? 'Yes' : 'No'}

## Transaction Data
- To: ${transactionInfo.to || (transactionInfo.metadata && transactionInfo.metadata.to) || '(not available)'}
- Value: ${transactionInfo.value || (transactionInfo.metadata && transactionInfo.metadata.amountFormatted) || '0'}
${transactionInfo.metadata && transactionInfo.metadata.tokenSymbol ? `- Token: ${transactionInfo.metadata.tokenSymbol}` : ''}
- Data: ${transactionInfo.data ? (transactionInfo.data.substring(0, 64) + '...') : '(not available)'}
- Type: ${transactionInfo.metadata && transactionInfo.metadata.type ? transactionInfo.metadata.type : '(unknown)'}

## Confirmations
${signaturesList}
        `.trim();
        
        return {
          contents: [{
            uri: uri.href,
            text: textResponse
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Error retrieving transaction information: ${error.message}`
          }]
        };
      }
    }
  );

  // Pending transactions resource
  server.resource(
    "pending-transactions",
    new ResourceTemplate("pending-tx://{safeAddress}", { list: undefined }),
    async (uri, { safeAddress }) => {
      try {
        // Get all transactions from config provider
        const transactions = await transactionManager.listTransactions();
        
        // Filter transactions for the safe address
        const safeTransactions = transactions.filter(tx => 
          (tx.metadata && tx.metadata.safeAddress === safeAddress) || 
          tx.safeAddress === safeAddress
        );
        
        // Filter pending transactions
        const pendingTransactions = safeTransactions.filter(tx => 
          tx.status !== 'executed' && !tx.isExecuted
        );
        
        if (pendingTransactions.length === 0) {
          return {
            contents: [{
              uri: uri.href,
              text: `No pending transactions found for Safe ${safeAddress}`
            }]
          };
        }
        
        // Format transaction list
        const txList = pendingTransactions.map(tx => {
          const metadata = tx.metadata || {};
          const confirmations = tx.confirmations || [];
          const hash = tx.hash || tx.safeTxHash;
          
          return `
## Transaction: ${hash || '(unknown)'}
- Type: ${metadata.type || '(unknown)'}
- To: ${metadata.to || tx.to || '(unknown)'}
- Value: ${metadata.amountFormatted || tx.value || '0'}
${metadata.tokenSymbol ? `- Token: ${metadata.tokenSymbol}` : ''}
- Confirmations: ${confirmations.length}/${tx.threshold || '?'}
- Can Execute: ${tx.canExecute ? 'Yes' : 'No'}
- Created: ${tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Unknown'}
          `.trim();
        }).join('\n\n');
        
        // Format text response
        const textResponse = `
# Pending Transactions for Safe ${safeAddress}

${txList}
        `.trim();
        
        return {
          contents: [{
            uri: uri.href,
            text: textResponse
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Error retrieving pending transactions: ${error.message}`
          }]
        };
      }
    }
  );
}

module.exports = { registerTransactionResources }; 