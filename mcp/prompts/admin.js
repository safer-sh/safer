/**
 * Admin prompts
 * Provides templates for admin-related interactions
 */
const { z } = require('zod');

/**
 * Register admin-related prompts to the server
 * @param {Object} server MCP server instance
 */
function registerAdminPrompts(server) {
  // Owner management guide prompt
  server.prompt(
    "ownerManagementGuide",
    {
      operation: z.enum(['add', 'remove']),
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    ({ operation, ownerAddress, safeAddress = "your Safe" }) => {
      const isAdd = operation === 'add';
      const action = isAdd ? 'add' : 'remove';
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please guide me through ${action}ing an owner ${isAdd ? 'to' : 'from'} my Safe wallet.

Safe address: ${safeAddress !== "your Safe" ? safeAddress : "Please help me select a Safe"}
${isAdd ? 'New owner' : 'Owner to remove'}: ${ownerAddress}

I need you to help me:
1. Check if this is a valid operation for my current Safe setup
2. Understand how this will affect my threshold requirements
3. Create the transaction
4. Sign it
5. Execute it when ready

Please explain the process and any security considerations.
            `.trim()
          }
        }]
      };
    }
  );
  
  // Threshold change guide prompt
  server.prompt(
    "thresholdGuide",
    {
      newThreshold: z.union([
        z.number().min(1),
        z.string().min(1).transform(val => parseInt(val, 10))
      ]),
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    ({ newThreshold, safeAddress = "your Safe" }) => {
      // Ensure newThreshold is a number for the template
      const threshold = typeof newThreshold === 'string' 
        ? parseInt(newThreshold, 10) 
        : newThreshold;
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please guide me through changing the signature threshold for my Safe wallet.

Safe address: ${safeAddress !== "your Safe" ? safeAddress : "Please help me select a Safe"}
New threshold: ${threshold} signatures required

I need you to help me:
1. Check if this is a valid threshold for my current Safe setup
2. Understand the security implications of this change
3. Create the transaction
4. Sign it
5. Execute it when ready

Please explain the process and any security considerations.
            `.trim()
          }
        }]
      };
    }
  );
  
  // Safe info guide prompt
  server.prompt(
    "safeInfoGuide",
    {
      safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    },
    ({ safeAddress = "your Safe" }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `
Please help me get information about my Safe wallet.

Safe address: ${safeAddress !== "your Safe" ? safeAddress : "Please help me select a Safe"}

I need to see:
1. The current owners of the Safe
2. The current threshold requirement
3. The Safe version and network details
4. Any other relevant configuration information

Please display the information in an easy-to-understand format.
            `.trim()
          }
        }]
      };
    }
  );
}

module.exports = { registerAdminPrompts }; 