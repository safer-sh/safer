/**
 * Common constants for the Safer wallet application
 */

/**
 * ANSI color codes for terminal output
 * These are used to format terminal output without external dependencies
 */
const COLORS = {
  // Text colors
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  GRAY: '\x1b[90m',
  
  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',
  
  // Text formatting
  RESET: '\x1b[0m',  // Reset all formatting
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m'
};

/**
 * Network configuration by chain ID
 */
const NETWORKS = {
  '1': { 
    name: 'mainnet', 
    label: 'Ethereum Mainnet', 
    url: 'https://mainnet.infura.io/v3/',
    explorer: 'https://etherscan.io'
  },
  '5': { 
    name: 'goerli', 
    label: 'Goerli Testnet', 
    url: 'https://goerli.infura.io/v3/',
    explorer: 'https://goerli.etherscan.io'
  },
  '11155111': { 
    name: 'sepolia', 
    label: 'Sepolia Testnet', 
    url: 'https://sepolia.infura.io/v3/',
    explorer: 'https://sepolia.etherscan.io'
  },
  '137': { 
    name: 'polygon', 
    label: 'Polygon Mainnet', 
    url: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com'
  },
  '10': { 
    name: 'optimism', 
    label: 'Optimism Mainnet', 
    url: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io'
  },
  '42161': { 
    name: 'arbitrum', 
    label: 'Arbitrum One', 
    url: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io'
  },
  '8453': { 
    name: 'base', 
    label: 'Base Mainnet', 
    url: 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  }
};

/**
 * Default configuration values
 */
const DEFAULTS = {
  CHAIN_ID: '11155111',
  CHAIN_NAME: 'sepolia',
  LEDGER_PATH: "m/44'/60'/0'/0/0"
};

/**
 * Application paths
 */
const PATHS = {
  CONFIG_DIR: '.safer',
  CONFIG_FILE: '.safer/config.json',
  TX_DIR: '.safer/transactions'
};

module.exports = {
  COLORS,
  NETWORKS,
  DEFAULTS,
  PATHS
}; 