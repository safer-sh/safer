/**
 * Transfer prompts
 * Provides templates for transfer-related interactions
 */
const { z } = require('zod');

/**
 * Register transfer-related prompts to the server
 * @param {Object} server MCP server instance
 */
function registerTransferPrompts(server) {
  // Transfer guide prompt
  server.prompt(
    "transferGuide",
    {
      to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      amount: z.string().min(1),
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    ({ to, amount, tokenAddress, safeAddress = "your Safe" }) => {
      const isToken = !!tokenAddress;
      const transferType = isToken ? "token" : "ETH";
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please guide me through creating a ${transferType} transfer with the following details:

Safe: ${safeAddress !== "your Safe" ? safeAddress : "Please help me select a Safe"}
Recipient: ${to}
Amount: ${amount} ${isToken ? 'tokens' : 'ETH'}
${isToken ? `Token Contract: ${tokenAddress}` : ''}

I need you to help me:
1. Check if this looks like a valid transaction
2. Create the transaction
3. Sign it with required owners
4. Execute it when ready (using a specified owner wallet)

Please explain the process and safety checks I should perform.
            `.trim()
          }
        }]
      };
    }
  );

  // Wallet management guide prompt
  server.prompt(
    "walletManagementGuide",
    {
      operation: z.enum(['add', 'list', 'remove']),
      walletType: z.enum(['privkey', 'ledger']).optional(),
      walletName: z.string().optional(),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    ({ operation, walletType = 'privkey', walletName = 'new wallet', walletAddress = '' }) => {
      const actionMap = {
        add: "add a new",
        list: "list all",
        remove: "remove an existing"
      };
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me ${actionMap[operation]} wallet.

${operation === 'add' ? `I want to add a wallet of type: ${walletType}\nName for this wallet: ${walletName}` : ''}
${operation === 'remove' ? `I want to remove wallet with address: ${walletAddress}` : ''}

I need you to:
${operation === 'add' ? '1. Guide me through adding a new wallet\n2. Secure the private key properly\n3. Verify the wallet is properly added' : ''}
${operation === 'list' ? '1. List all my available wallets\n2. Show their addresses and types\n3. Explain how I can use them' : ''}
${operation === 'remove' ? '1. Verify the wallet address exists\n2. Remove the wallet safely\n3. Confirm it was successfully removed' : ''}

Please provide clear step-by-step instructions.
            `.trim()
          }
        }]
      };
    }
  );
}

module.exports = { registerTransferPrompts }; 