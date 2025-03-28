# @safer-sh/cli

Command line interface for Safer - a minimal Ethereum Safe multi-signature wallet client.

> ---
> #### ⚠️ Disclaimer ⚠️
> This tool is NOT intended for production environments or for managing significant funds.
> 
> - Private keys are stored in **plaintext** in your configuration files
> - Do not use this tool to manage large amounts of funds
> - The `--private-key` option exists for development convenience only. Private keys should ONLY be used for testing reasons, for any real assets, ALWAYS use a hardware wallet (Ledger) integration
> ---

## Overview

The `@safer-sh/cli` package provides a command line interface for managing Ethereum Safe multi-signature wallets. It offers a streamlined way to create transactions, sign them, and execute them on the blockchain, all with minimal dependencies to reduce supply chain attack risks.

## Installation

```bash
# Install globally
npm install -g @safer-sh/cli
```

## Usage

### Configuration

```bash
# Set RPC URL
safer config --set-rpc-url "https://your-rpc-endpoint"

# Set chain by name or ID
safer config --set-chain "sepolia"

# Set default Safe address
safer config --set-safe "0xYourSafeAddress"

# View current configuration
safer config
```

### Wallet Management

```bash
# Add a private key wallet (FOR DEVELOPMENT ONLY)
safer config --add-privkey-owner --private-key "0xYourPrivateKey" --name "Dev Wallet"

# Add a Ledger hardware wallet
safer config --add-ledger-owner --path "live" --account 0 --name "My Ledger"
```

### Safe Operations

```bash
# Show Safe information (--safe is optional if default is set)
safer info [--safe "0xYourSafeAddress"]

# Transfer ETH
safer transfer --to "0xRecipientAddress" --amount 1.5 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]

# Transfer ERC20 tokens
safer transfer --to "0xRecipientAddress" --amount 100 --contract "0xTokenAddress" [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]
```

### Transaction Management

```bash
# List all transactions
safer txs

# Show transaction details
safer txs --show "0xTransactionHash"

# Sign a transaction
# --tx can be a transaction hash or nonce
# --sign-with can be a wallet address, name, address tail, or index
safer sign --tx "0xTransactionHash" --sign-with "WalletName"

# Execute a transaction
safer execute --tx "0xTransactionHash" [--sign-with "WalletName"]
```

### Transaction Import/Export

```bash
# Export to local directory
safer txs --export "0xTransactionHash" --to "./exports"

# Export to IPFS
safer txs --export "0xTransactionHash" --to "ipfs"

# Import from local file
safer txs --import "./exports/tx-123.json"

# Import from IPFS URI
safer txs --import "ipfs://Qm..."

# Open transactions directory
safer txs --open-dir
```

### Owner Management

```bash
# Add owner
safer admin --add-owner "0xNewOwnerAddress" --threshold 2 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]

# Remove owner
safer admin --remove-owner "0xOwnerToRemove" --threshold 1 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]

# Change threshold
safer admin --threshold 2 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]
```

## Features

- Simple and consistent command structure
- Supports ETH and ERC20 transfers
- Owner management and threshold settings
- Transaction signing with hardware wallets or private keys
- Transaction import/export with IPFS support
- Minimal dependencies to reduce supply chain attack risks

## Security Considerations

This CLI is designed with security in mind:

- Minimal third-party dependencies
- Direct interaction with the blockchain (no reliance on external services)
- Hardware wallet support for secure key management
- Clear warning messages for potentially unsafe operations

## License

MIT License

## Related Packages

- [@safer-sh/core](https://www.npmjs.com/package/@safer-sh/core) - Core functionality
- [@safer-sh/mcp](https://www.npmjs.com/package/@safer-sh/mcp) - AI agent integration
- [@safer-sh/common](https://www.npmjs.com/package/@safer-sh/common) - Shared utilities
- [@safer-sh/ledger-signer](https://www.npmjs.com/package/@safer-sh/ledger-signer) - Ledger hardware wallet integration 