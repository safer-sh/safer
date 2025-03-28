# @safer-sh/mcp

AI Agent integration module for Safer - a minimal Ethereum Safe multi-signature wallet client.


> #### ⚠️ Disclaimer ⚠️
> This tool is NOT intended for production environments or for managing significant funds.
> 
> - Private keys are stored in **plaintext** in your configuration files
> - Do not use this tool to manage large amounts of funds
> - The private key option exists for development convenience only. Private keys should ONLY be used for testing reasons, for any real assets, ALWAYS use a hardware wallet (Ledger) integration
> ---

## Overview

The `@safer-sh/mcp` package provides Model Context Protocol (MCP) integration for the Safer wallet ecosystem, enabling AI agents (like in Cursor, Claude, or Windsurf) to manage Ethereum Safe multi-signature wallets through natural language conversations. It offers the same functionality as the CLI but with an intuitive, AI-guided interface.

## Installation

```bash
# For direct use via npx
npx @safer-sh/mcp

# Or install globally
npm install -g @safer-sh/mcp
```

## How it Works

This package implements the Model Context Protocol, which allows AI assistants to directly interact with your Safe wallet. Instead of typing complex commands, you can simply tell the AI what you want to do in natural language, and it will perform the necessary operations.

Example conversation:

```
User: I want to check my Safe wallet information

AI: I can help you check your Safe wallet information. Please provide your Safe address.

User: 0x123...abc

AI: [Calling mcp_safer_safer_admin tool to get information]
Here's the information for your Safe wallet 0x123...abc:
- Owners: 3
- Threshold: 2
- Balance: 0.5 ETH
- ...

User: I want to transfer 0.1 ETH to 0xdef...789

AI: [Calling mcp_safer_safer_transaction to create transaction]
ETH transfer transaction created successfully!
- From: 0x123...abc
- To: 0xdef...789
- Amount: 0.1 ETH
- Transaction hash: 0x456...

You need to sign this transaction. Which wallet would you like to use for signing?

User: Use my Ledger

AI: [Calling mcp_safer_safer_transaction to sign transaction]
Transaction signed successfully! Now we need to execute the transaction. Would you like to execute it now?

User: Yes

AI: [Calling mcp_safer_safer_transaction to execute transaction]
Transaction successfully submitted to the blockchain!
- Transaction hash: 0x456...
- Block number: 12345678
- Gas used: 210,000
```

## MCP Tools Reference

The package exports the following MCP tools for AI agents:

### Configuration

```javascript
mcp_safer_safer_config({
  action: "get"  // Get current configuration
})

mcp_safer_safer_config({
  action: "set",
  rpcUrl: "https://your-rpc-endpoint",
  chain: "sepolia",
  defaultSafe: "0xYourSafeAddress"
})
```

### Wallet Management

```javascript
mcp_safer_safer_wallet({
  action: "add",
  type: "privkey",
  name: "Dev Wallet",
  privateKey: "0xYourPrivateKey"
})

mcp_safer_safer_wallet({
  action: "add",
  type: "ledger",
  name: "My Ledger",
  derivationPath: "live",
  accountIndex: 0
})

mcp_safer_safer_wallet({
  action: "list"  // List all wallets
})
```

### Safe Management

```javascript
mcp_safer_safer_admin({
  action: "getInfo",
  safeAddress: "0xYourSafeAddress"
})

mcp_safer_safer_admin({
  action: "addOwner",
  safeAddress: "0xYourSafeAddress",
  newOwnerAddress: "0xNewOwnerAddress",
  threshold: 2
})
```

### Transaction Operations

```javascript
mcp_safer_safer_transaction({
  action: "createEthTransfer",
  safeAddress: "0xYourSafeAddress",
  recipient: "0xRecipientAddress",
  amount: "1.5"
})

mcp_safer_safer_transaction({
  action: "sign",
  txHash: "0xTransactionHash",
  signerIdentifier: "WalletName"
})

mcp_safer_safer_transaction({
  action: "execute",
  txHash: "0xTransactionHash"
})
```

## Benefits of AI-Enhanced Interaction

- **Accessible for Non-Technical Users**: No need to remember complex commands or parameters
- **Guided Experience**: AI helps users through the workflow with explanations and suggestions
- **Error Prevention**: AI can identify potential issues before they occur
- **Natural Communication**: Describe what you want to do in your own words
- **Contextual Understanding**: AI remembers the conversation context for a smoother experience

## Security Considerations

The MCP module inherits the same security principles as the rest of the Safer ecosystem:
- Minimal dependencies to reduce supply chain attack risks
- Direct blockchain interaction without relying on external services
- Clear security warnings for potentially unsafe operations
- Support for hardware wallet integration

## License

MIT License

## Related Packages

- [@safer-sh/core](https://www.npmjs.com/package/@safer-sh/core) - Core functionality
- [@safer-sh/cli](https://www.npmjs.com/package/@safer-sh/cli) - Command line interface
- [@safer-sh/common](https://www.npmjs.com/package/@safer-sh/common) - Shared utilities
- [@safer-sh/ledger-signer](https://www.npmjs.com/package/@safer-sh/ledger-signer) - Ledger hardware wallet integration 