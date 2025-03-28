# @safer-sh/core

Core logic module for Safer - a minimal Ethereum Safe multi-signature wallet client.

> ---
> #### ⚠️ Disclaimer ⚠️
> This tool is NOT intended for production environments or for managing significant funds.
> ---

## Overview

The `@safer-sh/core` module provides the essential functionality for interacting with Safe multi-signature wallets on Ethereum networks. It's designed with minimal dependencies and a focus on supply chain attack risk mitigation.

This package implements the core logic needed to:
- Create and manage Safe wallets
- Generate and sign transactions
- Handle owner management operations
- Interact with Safe contracts

## Installation

```bash
npm install @safer-sh/core
```

## Usage

```javascript
const { services } = require('@safer-sh/core');
const { ethers } = require('ethers');

// Initialize services with provider
const provider = new ethers.providers.JsonRpcProvider('https://rpc-endpoint.example');

// Get Safe information
const safeInfo = await services.safeService.getSafeInfo({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://rpc-endpoint.example',
  chainId: 1  // Mainnet
});

// Create ETH transfer transaction
const txData = await services.transactionService.createEthTransferTx({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://rpc-endpoint.example',
  chainId: 1,
  receiverAddress: '0xRecipientAddress',
  amount: '1.5'  // ETH amount
});

// Sign a transaction
const signedTx = await services.signService.signTransaction({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://rpc-endpoint.example',
  chainId: 1,
  transaction: txData,
  signer: yourSigner  // Must implement ISaferSigner interface
});

// Execute a transaction
const receipt = await services.executeService.executeTransaction({
  safeAddress: '0xYourSafeAddress',
  rpcUrl: 'https://rpc-endpoint.example',
  chainId: 1,
  transaction: signedTx,
  signer: yourSigner
});
```

## Key Components

- **SafeService**: Get Safe information, owners, and balances
- **TransactionService**: Create various transaction types (ETH, ERC20, contract)
- **SignService**: Sign transactions with hardware wallets or private keys
- **ExecuteService**: Submit transactions to the blockchain

## Dependencies

This package is designed with minimal dependencies to reduce supply chain attack risks:
- `@safe-global` official packages
- `ethers.js` v5.x (as the only external dependency)

## Security Considerations

This module is part of the Safer project, which takes a security-first approach:

- Modular dependency management
- All dependencies are carefully vetted and version-locked
- Security patches are regularly applied

## License

MIT License

## Related Packages

- [@safer-sh/cli](https://www.npmjs.com/package/@safer-sh/cli) - Command line interface
- [@safer-sh/mcp](https://www.npmjs.com/package/@safer-sh/mcp) - AI agent integration
- [@safer-sh/common](https://www.npmjs.com/package/@safer-sh/common) - Shared utilities
- [@safer-sh/ledger-signer](https://www.npmjs.com/package/@safer-sh/ledger-signer) - Ledger hardware wallet integration 