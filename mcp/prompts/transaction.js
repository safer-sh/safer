/**
 * Transaction prompts
 * Provides templates for transaction-related interactions
 */
const { z } = require('zod');

/**
 * Register transaction-related prompts to the server
 * @param {Object} server MCP server instance
 */
function registerTransactionPrompts(server) {
  // Transaction import guide
  server.prompt(
    "transactionImportGuide",
    {
      source: z.string().min(1)
    },
    ({ source }) => {
      const isIpfs = source.startsWith('ipfs://') || source.includes('ipfs.io');
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me import a transaction from the following source: ${source}

This is a ${isIpfs ? "IPFS link" : "local file"}.

Please assist me with:
1. Importing the transaction from ${isIpfs ? "IPFS" : "the file"}
2. Verifying the transaction validity and completeness
3. Saving the transaction to my local transaction list
4. Displaying the imported transaction details and guiding me on next steps

After importing, I may need to:
- Add my signature
- View existing signatures
- Execute the transaction (if I am an eligible executor)
            `.trim()
          }
        }]
      };
    }
  );

  // Transaction export guide
  server.prompt(
    "transactionExportGuide",
    {
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      nonce: z.string().optional(),
      exportType: z.enum(["ipfs", "file"]).optional()
    },
    ({ txHash, nonce, exportType = "ipfs" }) => {
      const identifier = txHash || `nonce ${nonce}`;
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me export transaction with identifier: ${identifier}

I want to export it as an ${exportType === "ipfs" ? "IPFS link" : "local file"}

Please assist me with:
1. Checking if the transaction exists
2. Exporting the transaction to ${exportType === "ipfs" ? "IPFS and generating a shareable link" : "a local file"}
3. Providing guidance on how to share this transaction with others

Important notes:
${exportType === "ipfs" ? 
  "- IPFS export requires Pinata API keys to be configured\n- It will generate a permanent link after export" : 
  "- File export will generate a JSON file locally\n- You will need to manually share this file"}
            `.trim()
          }
        }]
      };
    }
  );

  // Transaction execution guide
  server.prompt(
    "transactionExecutionGuide",
    {
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      nonce: z.string().optional(),
      executorIdentifier: z.string().min(1).optional()
    },
    ({ txHash, nonce, executorIdentifier = "any available wallet" }) => {
      const identifier = txHash || `nonce ${nonce}`;
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me execute transaction with identifier: ${identifier}

I want to execute this transaction using: ${executorIdentifier}

Please assist me with:
1. Checking if the transaction has sufficient signatures (N-1 where N is the threshold)
2. If possible, use the "Sign & Execute" mode where the executor provides the final signature
3. Executing the transaction using the specified wallet
4. Confirming the transaction execution status

Preferred Execution Mode:
- "Sign & Execute" mode is highly recommended and should be used whenever possible
- In this mode, the executor wallet acts as both the final signer and the executor
- This saves gas fees by combining signing and execution into a single transaction

Important Notes:
1. For optimal execution, choose an executor wallet that has NOT yet signed the transaction
2. The executor's signature will be automatically counted during execution
3. If a transaction has threshold T:
   - Best: Use "Sign & Execute" with (T-1) existing signatures + executor as final signer
   - Alternative: If transaction already has T signatures, any owner can execute

Example of "Sign & Execute" mode:
- If threshold is 2, and we have 1 signature:
  ✓ Use an unsigned owner as executor (counts as 2nd signature + executes in same transaction)
  ✓ More gas efficient than signing first, then executing separately
  ✗ Don't use an owner that has already signed (they can only execute, not sign+execute)
            `.trim()
          }
        }]
      };
    }
  );

  // Transaction signing guide
  server.prompt(
    "transactionSigningGuide",
    {
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      nonce: z.string().optional(),
      signerIdentifier: z.string().min(1).optional()
    },
    ({ txHash, nonce, signerIdentifier = "any available wallet" }) => {
      const identifier = txHash || `nonce ${nonce}`;
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me sign transaction with identifier: ${identifier}

I want to sign this transaction using: ${signerIdentifier}

Please assist me with:
1. Checking the transaction details and verifying it's safe to sign
2. Signing the transaction with the specified wallet
3. Confirming the signature was added successfully
4. Checking if the transaction now has enough signatures to be executed

Important Notes:
1. Make sure the wallet I'm using is an owner of the Safe
2. Verify the wallet hasn't already signed this transaction
3. Check the transaction threshold to determine if more signatures are needed
            `.trim()
          }
        }]
      };
    }
  );
}

module.exports = { registerTransactionPrompts }; 