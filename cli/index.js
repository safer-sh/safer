#!/usr/bin/env node
/**
 * Safer CLI
 * Command line interface for Safer wallet
 */

const { Command } = require('commander');
const program = new Command();
const { COLORS } = require('@safer-sh/common/constants');
const { header } = require('./logger');

// Import command handlers
const handleTransfer = require('./commands/transfer');
const { signTransaction } = require('./commands/sign');
const handleExecute = require('./commands/execute');
const { handleConfig } = require('./commands/config');
const handleAdmin = require('./commands/admin');
const handleTransactions = require('./commands/transactions');
const handleInfo = require('./commands/info');

// Version information
program.version('0.1.0');

// Add description with dev warning
const devWarning = `
${COLORS.RED}${COLORS.BOLD}⚠️  FOR DEVELOPMENT USE ONLY - NOT FOR PRODUCTION USE ⚠️${COLORS.RESET}
${COLORS.GRAY}This tool is intended for developers and testers. Do not use with real funds.${COLORS.RESET}
`;
program.description(devWarning);

// Global options
program
  .option('--chain <network-or-id>', 'Specify chain by name or ID (e.g., sepolia, mainnet, 11155111)')
  .option('--rpc-url <url>', 'RPC URL to use (overrides configuration)')
  .option('--verbose', 'Enable verbose output');

// Transfer command
program
  .command('transfer')
  .description('Create a transfer transaction')
  .option('--safe <address>', 'Safe address (overrides configured address)')
  .option('--to <address>', 'Recipient address')
  .option('--amount <amount>', 'Amount to transfer (in ETH or tokens)')
  .option('--contract <address>', 'ERC20 token contract address for token transfers')
  .option('--sign-with <identifier>', 'Owner identifier (address, name, address tail, or index)')
  .option('--execute', 'Execute transaction after signing (requires threshold signatures)')
  .action(async (options) => {
    console.log(header('SAFER WALLET - TRANSFER'));
    const result = await handleTransfer(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Sign command
program
  .command('sign')
  .description('Sign a transaction')
  .option('--tx <hash_or_nonce>', 'Transaction hash or nonce to sign')
  .option('--sign-with <identifier>', 'Owner identifier (address, name, address tail, or index)')
  .action(async (options) => {
    console.log(header('SAFER WALLET - SIGN TRANSACTION'));
    const result = await signTransaction(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Execute command
program
  .command('execute')
  .description('Execute a transaction (by default uses execution as confirmation when possible)')
  .option('--tx <hash_or_nonce>', 'Transaction hash or nonce to execute')
  .option('--sign-with <identifier>', 'Owner identifier (address, name, address tail, or index)')
  .option('--gas-limit <limit>', 'Custom gas limit')
  .option('--gas-price <gwei>', 'Custom gas price in gwei')
  .option('--gas-boost <percentage>', 'Percentage to boost current gas price')
  .action(async (options) => {
    console.log(header('SAFER WALLET - EXECUTE TRANSACTION'));
    const result = await handleExecute(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Config command
program
  .command('config')
  .description('View or update configuration')
  .option('--set-safe <address>', 'Set default Safe address')
  .option('--set-chain <chain>', 'Set default chain (name or ID)')
  .option('--set-rpc-url <url>', 'Set default RPC URL')
  .option('--set-pinata-api-key <key>', 'Set Pinata API key for IPFS')
  .option('--set-pinata-secret <secret>', 'Set Pinata Secret API key for IPFS')
  .option('--add-privkey-owner', 'Add a new private key owner')
  .option('--private-key <key>', 'Private key for the new owner')
  .option('--add-ledger-owner', 'Add a new Ledger owner')
  .option('--path <type>', 'Ledger derivation path type <live|legacy> or custom full derivation path')
  .option('--account <index>', 'Account index for Ledger (default: 0)')
  .option('--name <n>', 'Name for the owner (optional)')
  .option('--remove-owner <address>', 'Remove an owner by address')
  .action(async (options) => {
    console.log(header('SAFER WALLET - CONFIGURATION'));
    const result = await handleConfig(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Admin command
program
  .command('admin')
  .description('View Safe info or manage owners/threshold')
  .option('--safe <address>', 'Safe address (overrides configured address)')
  .option('--add-owner <address>', 'Add a new owner')
  .option('--remove-owner <address>', 'Remove an owner')
  .option('--threshold <number>', 'Change confirmation threshold')
  .option('--sign-with <identifier>', 'Owner identifier (address, name, address tail, or index)')
  .option('--execute', 'Execute immediately after signing')
  .action(async (options) => {
    console.log(header('SAFER WALLET - ADMIN'));
    const result = await handleAdmin(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Transactions command
program
  .command('txs')
  .description('List, view, import or export transaction details')
  .option('--show <hash_or_nonce>', 'Show details of a specific transaction by hash or nonce')
  .option('--import <filepath-or-ipfs>', 'Import transaction from file or IPFS URI')
  .option('--export <hash_or_nonce>', 'Export transaction by hash or nonce')
  .option('--to <directory-or-ipfs>', 'Destination for export (local directory path or "ipfs")')
  .option('--open-dir', 'Open the transactions directory')
  .option('--verbose', 'Show verbose output')
  .action(async (options) => {
    console.log(header('SAFER WALLET - TRANSACTIONS'));
    const result = await handleTransactions(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Info command (alias for admin --info)
program
  .command('info')
  .description('Show information about a Safe')
  .option('--safe <address>', 'Safe address (overrides configured address)')
  .action(async (options) => {
    console.log(header('SAFER WALLET - SAFE INFO'));
    const result = await handleInfo(program.opts(), options);
    process.exit(result ? 0 : 1);
  });

// Parse command line arguments
program.parse(process.argv);

// If no command is specified, show help
if (!program.args.length) {
  program.help();
} 