/**
 * IPFS-based transaction manager implementation (using Pinata API)
 * Provides import/export operations for transactions using IPFS
 */
const https = require('https');
const { TransactionNotFoundError } = require('@safer-sh/core').exceptions;
const { SaferTransaction } = require('@safer-sh/core');

class IPFSTransactionManager {
  constructor(configProvider, options = {}) {
    this.options = options;
    this.configProvider = configProvider;
    
    // IPFS gateways for retrieving content (in fallback order)
    this.ipfsGateways = [
      'https://ipfs.io/ipfs',
      'https://gateway.pinata.cloud/ipfs', 
      'https://cloudflare-ipfs.com/ipfs',
      'https://ipfs.infura.io/ipfs'
    ];
    
    // Use custom gateway if provided
    if (this.options.gateway) {
      // Add custom gateway as the first option
      this.ipfsGateways.unshift(this.options.gateway);
    }
    
    // Set the default gateway (first in the list)
    this.ipfsGatewayUrl = this.ipfsGateways[0];
    
    // Flag to check if valid credentials are provided - we'll check in the save method
    this.hasCredentials = false;
  }

  /**
   * Make an HTTPS request
   * 
   * @private
   * @param {Object|string} options - Request options or URL string
   * @param {Buffer|string} [data] - Request body
   * @returns {Promise<Object>} Response data (parsed JSON)
   */
  _makeRequest(options, data) {
    return new Promise((resolve, reject) => {
      // Handle URL string
      let requestOptions = options;
      if (typeof options === 'string' || options.url) {
        const url = typeof options === 'string' ? options : options.url;
        const parsedUrl = new URL(url);
        
        requestOptions = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: options.method || 'GET',
          headers: options.headers || {},
          // 设置超时
          timeout: 10000
        };
      }
      
      const req = https.request(requestOptions, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          
          try {
            const parsedData = JSON.parse(body);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`Request failed with status ${res.statusCode}: ${parsedData.message || body}`));
            }
          } catch (error) {
            // If JSON parsing fails, return the raw body
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(body);
            } else {
              reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
            }
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (data) {
        req.write(data);
      }
      
      req.end();
    });
  }

  /**
   * Generate a boundary for multipart/form-data
   * 
   * @private
   * @returns {string} Random boundary string
   */
  _generateBoundary() {
    return `------------------------${Math.random().toString(36).slice(2)}`;
  }

  /**
   * @private
   * @param {SaferTransaction} transaction - Transaction to upload
   * @param {string} boundary - Form boundary
   * @returns {Buffer} Multipart form data
   */
  _createMultipartFormData(transaction, boundary) {
    const fileData = this.configProvider.transactionToFile(transaction);
    const fileName = fileData.filename;
    
    // Create multipart form-data payload
    const payload = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: application/json',
      '',
      fileData.content,
      `--${boundary}--`,
      ''
    ].join('\r\n');
    
    return Buffer.from(payload);
  }

  /**
   * Save transaction to IPFS using Pinata API
   * 
   * @param {SaferTransaction} transaction - Transaction to save
   * @returns {Promise<SaferTransaction>} Transaction with updated IPFS metadata
   */
  async saveTransactionToIPFS(transaction) {
    // Validate input
    if (!(transaction instanceof SaferTransaction)) {
      throw new Error('Transaction must be a SaferTransaction instance');
    }

    // Get Pinata credentials from config
    const config = await this.configProvider.readConfig();
    
    const pinataApiKey = config.pinataApiKey;
    const pinataSecretApiKey = config.pinataSecretApiKey;
    
    this.hasCredentials = pinataApiKey && pinataSecretApiKey && 
                         pinataApiKey !== 'YOUR_PINATA_API_KEY' && 
                         pinataSecretApiKey !== 'YOUR_PINATA_SECRET_API_KEY';
    
    if (!this.hasCredentials) {
      throw new Error('Pinata API credentials not configured. Use "safer config --set-pinata-api-key <key> --set-pinata-secret <secret>"');
    }
    
    // Create multipart form-data
    const boundary = this._generateBoundary();
    const formData = this._createMultipartFormData(transaction, boundary);
    
    // Prepare request options
    const options = {
      hostname: 'api.pinata.cloud',
      path: '/pinning/pinFileToIPFS',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length,
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretApiKey
      }
    };
    
    try {
      // Upload to Pinata
      const response = await this._makeRequest(options, formData);
      const cid = response.IpfsHash;
      
      // Update transaction metadata with IPFS CID
      // Instead of using clone, create a new instance with the same data
      const updatedTransaction = new SaferTransaction({
        ...transaction,
        metadata: {
          ...transaction.metadata,
          ipfs: {
            cid,
            url: `ipfs://${cid}`,
            gateway: this.getGatewayUrl(cid) // Use the primary gateway URL
          }
        }
      });
      
      return updatedTransaction;
    } catch (error) {
      throw new Error(`Failed to save transaction to IPFS: ${error.message}`);
    }
  }

  /**
   * Load transaction from IPFS
   * 
   * @param {string} cid - IPFS CID
   * @returns {Promise<SaferTransaction>} Loaded transaction
   */
  async loadTransactionFromIPFS(cid) {
    // Validate that CID is provided
    if (!cid) {
      throw new Error('Missing CID parameter');
    }
    
    // Try each gateway in sequence until one works
    let lastError = null;
    
    for (const gateway of this.ipfsGateways) {
      try {
        // Get IPFS content
        const options = {
          method: 'GET',
          url: `${gateway}/${cid}`
        };
        
        const response = await this._makeRequest(options);
        
        // Check if the response is already in the expected format
        // or if it needs to be converted
        let fileContent;
        
        if (typeof response === 'string') {
          // Already a string, use as is
          fileContent = response;
        } else if (typeof response === 'object') {
          // Check if it's already in the expected format with version, type, and data
          if (response.version && response.type === 'SaferTransaction' && response.data) {
            fileContent = JSON.stringify(response);
          } else {
            // It might be the transaction data directly, wrap it in the expected format
            fileContent = JSON.stringify({
              version: '0.1.0',
              type: 'SaferTransaction',
              data: response
            });
          }
        } else {
          throw new Error('Invalid response format from IPFS');
        }
        
        // Create SaferTransaction from file content
        return this.configProvider.transactionFromFile(fileContent);
      } catch (error) {
        lastError = error;
        // Continue to the next gateway
      }
    }
    
    // If we reach here, all gateways failed
    throw new TransactionNotFoundError(cid, `Failed to load transaction from IPFS: ${lastError?.message || 'All gateways failed'}`);
  }

  /**
   * Get IPFS gateway URL for a CID
   * 
   * @param {string} cid - IPFS CID
   * @param {number} [gatewayIndex=0] - Index of gateway to use (defaults to primary gateway)
   * @returns {string} Gateway URL
   */
  getGatewayUrl(cid, gatewayIndex = 0) {
    // Ensure index is valid
    const index = gatewayIndex >= 0 && gatewayIndex < this.ipfsGateways.length 
      ? gatewayIndex 
      : 0;
    
    return `${this.ipfsGateways[index]}/${cid}`;
  }

  /**
   * Parse IPFS URI and extract CID
   * 
   * @param {string} uri - IPFS URI (ipfs://CID or https://ipfs.io/ipfs/CID)
   * @returns {string} CID
   */
  parseCidFromUri(uri) {
    if (uri.startsWith('ipfs://')) {
      return uri.replace('ipfs://', '');
    } else if (uri.includes('/ipfs/')) {
      const matches = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
    
    throw new Error('Invalid IPFS URI format');
  }
  
  /**
   * Close connection (no-op for HTTP implementation)
   */
  async close() {
    // Nothing to close for HTTP implementation
    return;
  }
}

module.exports = IPFSTransactionManager; 