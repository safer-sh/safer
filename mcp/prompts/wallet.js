/**
 * Wallet prompts
 * Provides templates for wallet-related interactions
 */
const { z } = require("zod");

/**
 * Register wallet-related prompts to the server
 * @param {Object} server MCP server instance
 */
function registerWalletPrompts(server) {
  // Wallet setup guide
  server.prompt("walletSetupGuide", {}, () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `
Please help me add a wallet to use with my Safe.

SECURITY RECOMMENDATIONS:
- For real assets and production use, ALWAYS use a hardware wallet (Ledger)
- Private key wallets store keys in plaintext and should ONLY be used for testing on testnets
- NEVER import private keys that control real assets

Options for adding wallets:

1. RECOMMENDED: Add a Ledger hardware wallet:
   safer_wallet add --name "My Ledger" --type ledger --derivation-path "live" --account-index 0

2. FOR TESTING ONLY: Add a private key wallet:
   safer_wallet add --name "Test Wallet" --type privkey --private-key <private-key>

I'd like you to guide me through adding a wallet safely, prioritizing the most secure options.
            `.trim(),
          },
        },
      ],
    };
  });

  // Wallet overview guide
  server.prompt("walletSecurityGuide", {}, () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `
Please help me manage my Safe wallet owners.

I'd like to:
1. View my current wallets/owners
2. Add or remove wallets
3. Understand wallet security best practices

SECURITY WARNINGS:
- For real assets and production use, ALWAYS use a hardware wallet (Ledger)
- Private key wallets store keys in plaintext and should ONLY be used for testing
- NEVER import private keys that control real assets

Please show me my current wallets and guide me through any necessary changes.
            `.trim(),
          },
        },
      ],
    };
  });

  // Ledger setup guide
  server.prompt("ledgerSetupGuide", {}, () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `
  I want to set up a Ledger hardware wallet with Safer. Please guide me through the complete process.

  Before we start, please ensure:
  1. Your Ledger device is connected to your computer via USB
  2. Your Ledger is unlocked (PIN entered)
  3. The Ethereum app is open on your Ledger

  I need your help with:
  - Choosing an appropriate derivation path
  - Setting the correct account index
  - Ensuring my Ledger is properly recognized

  Common derivation paths:
  - "live" - Ledger Live standard path (m/44'/60'/x'/0/0) - RECOMMENDED
  - "legacy" - Legacy path (m/44'/60'/0'/x)
  - Custom path (e.g., "m/44'/60'/0'/0/0")

  Please ask me which path I want to use, which account index (usually 0 for first account), and confirm my Ledger is ready before proceeding with any command.
              `.trim(),
          },
        },
      ],
    };
  });

  // Private key setup warning guide
  server.prompt("privkeyWarningGuide", {}, () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `
  ⚠️ IMPORTANT SECURITY WARNING ⚠️

  You've indicated you want to set up a private key wallet. Please be aware of the following risks:

  1. Private keys are stored in PLAINTEXT in your configuration files
  2. Anyone with access to your computer could potentially access these keys
  3. Private key wallets should ONLY be used for:
    - Testing on testnets
    - Development environments
    - Small amounts you're willing to risk

  For any real assets or production use, ALWAYS use a hardware wallet instead.

  If you still want to proceed with a private key wallet for testing purposes only, please confirm and provide the private key. Otherwise, I can help you set up a more secure hardware wallet option.
              `.trim(),
          },
        },
      ],
    };
  });
}

module.exports = { registerWalletPrompts };
