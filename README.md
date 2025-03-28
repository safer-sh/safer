# Safer - Minimal Safe Wallet Client with CLI and MCP Support

> ---
> #### ⚠️ Disclaimer ⚠️
> This tool is NOT intended for production environments or for managing significant funds.
> 
> - Private keys are stored in **plaintext** in your configuration files
> - Do not use this tool to manage large amounts of funds
> - The `--private-key` option exists for development convenience only. Private keys should ONLY be used for testing reasons, for any real assets, ALWAYS use a hardware wallet (Ledger) integration
> ---

Safer is a minimal implementation of an Ethereum Safe multi-signature wallet client, designed with a focus on minimal dependencies and supply chain attack risk mitigation. It provides essential Safe wallet functionality including ETH/ERC20 transfers, owner management, threshold settings, and transaction management.

## Security by Design

Safer's approach to security is built on two key principles:

1. **Minimalist Architecture**:
   - Modular dependency management: Each component only imports what it needs
   - Core module uses primarily `@safe-global` offical packages with `ethers.js` as the only external dependencies
   - CLI module adds only `commander` for terminal interaction
   - Common code shared across modules to prevent duplication
   - Version pinning and yarn resolutions to enforce secure dependency versions
   - Resolutions for `elliptic` is used to avoid critical vulnerability

2. **AI-Enhanced Usability**:
   - Built-in MCP protocol support makes complex operations accessible to everyone
   - AI agents guide users through safe wallet interactions, reducing human error
   - Common security pitfalls are automatically prevented by intelligent assistance
   - Same security level as CLI but with conversational interface

Unlike the official safe-cli which offers comprehensive features but with more dependencies and complexity, Safer focuses on the most commonly used operations with the smallest possible attack surface while making safe wallet management accessible to non-technical users through AI assistance.

## Project Structure

The project consists of several modular components:

- **core**: Core logic module with minimal dependencies, encapsulated data, and support for various user frontends and signers
- **cli**: Command-line interface module supporting basic functionality and Ledger hardware wallet signing
- **mcp**: AI Agent client module (for Cursor, Claude, Windsurf, etc.) with functionality matching the CLI
- **common**: Shared dependencies and utilities, including the essential SaferTransaction class
- **ledger-signer**: Ledger hardware wallet signer implementation

## Installation

### CLI Tool

```bash
# Install globally via npm
npm install -g @safer-sh/cli
```

### MCP (AI Agent) Integration

The MCP module is designed to be used with AI applications (like Cursor) via npx:

```bash
npx @safer-sh/mcp
```

### Development Setup

If you want to contribute or modify the codebase:

```bash
# Clone the repository
git clone https://github.com/safer-sh/safer.git
cd safer

# Install dependencies using yarn
yarn install

# Build all packages
yarn build
```

## Usage

### CLI Mode

```bash
# Configuration
safer config --set-rpc-url "https://your-rpc-endpoint"  # Set RPC URL
safer config --set-chain "sepolia"  # Set chain by name or ID
safer config --set-safe "0xYourSafeAddress"  # Set default Safe address
safer config  # View current configuration

# Adding wallet - Private key (for development only)
safer config --add-privkey-owner --private-key "0xYourPrivateKey" --name "Dev Wallet"

# Adding wallet - Ledger
safer config --add-ledger-owner --path "live" --account 0 --name "My Ledger"

# Safe information
safer info [--safe "0xYourSafeAddress"]  # Show Safe information (--safe is optional if default is set)
safer admin [--safe "0xYourSafeAddress"]  # Same as info command

# Transfer operations
# All --safe parameters are optional if a default Safe is configured
safer transfer --to "0xRecipientAddress" --amount 1.5 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"] # ETH transfer
safer transfer --to "0xRecipientAddress" --amount 100 --contract "0xTokenAddress" [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]  # ERC20 transfer

# Transaction management
safer txs  # List all transactions
safer txs --show "0xTransactionHash"  # Show transaction details
# --tx can be a transaction hash or nonce
# --sign-with can be a wallet address, name, address tail, or index
safer sign --tx "0xTransactionHash" --sign-with "WalletName"  # Sign transaction
safer execute --tx "0xTransactionHash" [--sign-with "WalletName"]  # Execute transaction

# Transaction import/export
safer txs --export "0xTransactionHash" --to "./exports"  # Export to local directory
safer txs --export "0xTransactionHash" --to "ipfs"  # Export to IPFS
safer txs --import "./exports/tx-123.json"  # Import from local file
safer txs --import "ipfs://Qm..."  # Import from IPFS URI
safer txs --open-dir  # Open transactions directory

# Safe management
safer admin --add-owner "0xNewOwnerAddress" --threshold 2 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"] # Add owner
safer admin --remove-owner "0xOwnerToRemove" --threshold 1 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]  # Remove owner
safer admin --threshold 2 [--safe "0xYourSafeAddress"] [--sign-with "WalletName"]  # Change threshold
```

### MCP (AI Agent) Mode

The MCP mode provides the same functionality as CLI but is designed for AI agent interaction. When used in AI applications (such as Cursor), the interaction typically looks like this:

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

The MCP tools are designed to seamlessly integrate with AI agents, handling complex interaction flows including transaction creation, signing, execution, and error handling. It's ideal for users who want to manage their Safe wallets through an AI interface.

## Features

- **Minimal Dependencies**: Carefully selected dependencies to minimize supply chain attack risks
- **Modular Design**: Each component is independent and follows clear interfaces
- **Multiple Signing Methods**: Support for both Ledger hardware wallets and private keys (development only)
- **Transaction Management**: Create, sign, execute, and track Safe transactions
- **Owner Management**: Add/remove owners and adjust signing thresholds
- **Import/Export**: Transaction import/export functionality with IPFS support

## Configuration

Configuration is managed through the config module, which supports:

- Local directory settings
- Default Safe address
- Chain information
- IPFS configuration
- Local wallet management

The config module supports both FileConfigProvider and IPFSConfigProvider for transaction storage and management.

## Development

```bash
# Install all workspace dependencies
yarn install

# Build all packages
yarn build

# Start in development mode
yarn start  # CLI mode
yarn start:mcp  # MCP mode
```

## Security Considerations

### Dependency Management

This project takes a minimal dependency approach to reduce supply chain attack risks:

1. Dependencies are installed only in modules that require them
2. All dependencies are carefully vetted and version-locked
3. Security patches are regularly applied through yarn resolutions

### Best Practices

1. **Local Usage**:
   - Use only on trusted, secure machines
   - Keep your system updated
   - Use strong passwords and disk encryption

2. **Transaction Safety**:
   - Always verify transaction details
   - Use hardware wallets when possible
   - Start with small test transactions

3. **Data Security**:
   - Never share private keys
   - Secure configuration files
   - Clean up sensitive data when done

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## Support

For questions and support, please [open an issue](https://github.com/safer-sh/safer/issues) on GitHub. 