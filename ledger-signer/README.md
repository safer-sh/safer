# @safer-sh/ledger-signer

Ledger hardware wallet signer module for Safer - a minimal Ethereum Safe multi-signature wallet client.

> ---
> #### ⚠️ Disclaimer ⚠️
> This tool is NOT intended for production environments or for managing significant funds.
> ---

## Overview

The `@safer-sh/ledger-signer` package provides Ledger hardware wallet integration for the Safer wallet ecosystem. It allows users to securely sign Safe transactions using a Ledger device without exposing private keys, all with minimal dependencies to reduce supply chain attack risks.

## Installation

```bash
npm install @safer-sh/ledger-signer
```

## Usage

```javascript
const { LedgerSigner } = require('@safer-sh/ledger-signer');
const { ethers } = require('ethers');

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider('https://your-rpc-endpoint');

// Create Ledger signer with default path (Ledger Live)
const ledgerSigner = await new LedgerSigner(provider).init({
  path: "m/44'/60'/0'/0/0"
});

// Or use path shortcuts
const ledgerLiveSigner = await new LedgerSigner(provider).init({
  path: "live",   // Equivalent to m/44'/60'/0'/0/0
  accountIndex: 0
});

const legacySigner = await new LedgerSigner(provider).init({
  path: "legacy",  // Equivalent to m/44'/60'/0'/0
  accountIndex: 0
});

// Get the Ethereum address
const address = await ledgerSigner.getAddress();
console.log(`Ledger address: ${address}`);

// Sign a message
const signature = await ledgerSigner.signMessage("Hello, Ethereum!");

// Sign a transaction
const signedTx = await ledgerSigner.signTransaction({
  to: "0xRecipientAddress",
  value: ethers.utils.parseEther("0.1"),
  gasLimit: 21000,
  gasPrice: ethers.utils.parseUnits("50", "gwei"),
  nonce: await provider.getTransactionCount(address)
});
```

## Integration with Safer

This package implements the `ISaferSigner` interface required by the Safer ecosystem, making it compatible with all Safer operations:

```javascript
const { services } = require('@safer-sh/core');
const { LedgerSigner } = require('@safer-sh/ledger-signer');
const { ethers } = require('ethers');

// Initialize
const provider = new ethers.providers.JsonRpcProvider('https://your-rpc-endpoint');
const ledgerSigner = await new LedgerSigner(provider).init({
  path: "m/44'/60'/0'/0/0"
});

// Create a transaction
const txData = await services.transactionService.createEthTransferTx({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://your-rpc-endpoint',
  chainId: 1,
  receiverAddress: '0xRecipientAddress',
  amount: '0.1'
});

// Sign the transaction with Ledger
const signedTx = await services.signService.signTransaction({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://your-rpc-endpoint',
  chainId: 1,
  transaction: txData,
  signer: ledgerSigner
});

// Execute the transaction with Ledger
const receipt = await services.executeService.executeTransaction({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://your-rpc-endpoint',
  chainId: 1,
  transaction: signedTx,
  signer: ledgerSigner
});
```

## Key Features

- **Hardware Security**: Private keys never leave your Ledger device
- **Multiple Derivation Paths**: Support for Ledger Live and Legacy paths
- **Ethereum Compatibility**: Works with standard Ethereum transactions
- **Safe Integration**: Fully compatible with Safer wallet operations
- **Minimal Dependencies**: Focused on security and reducing supply chain risks

## Hardware Requirements

- Ledger Nano S, Nano S Plus, or Nano X device
- Ethereum app installed and running on your Ledger
- Device connected via USB
- Appropriate permissions for USB access (especially on Linux)

## Security Best Practices

- Always verify transaction details on your Ledger device screen
- Keep your Ledger firmware and apps updated
- Use on secure, malware-free computers
- Start with small test transactions

## License

MIT License

## Related Packages

- [@safer-sh/core](https://www.npmjs.com/package/@safer-sh/core) - Core functionality
- [@safer-sh/cli](https://www.npmjs.com/package/@safer-sh/cli) - Command line interface
- [@safer-sh/mcp](https://www.npmjs.com/package/@safer-sh/mcp) - AI agent integration
- [@safer-sh/common](https://www.npmjs.com/package/@safer-sh/common) - Shared utilities 