/**
 * Truffle configuration for ChainShield smart contract deployment
 */

const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    // Local development with Ganache
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 6721975,
      gasPrice: 20000000000
    },

    // Sepolia testnet (free)
    sepolia: {
      provider: () => {
        // Option 1: Use Infura (free tier)
        if (process.env.INFURA_API_KEY) {
          return new HDWalletProvider(
            process.env.MNEMONIC || process.env.PRIVATE_KEY,
            `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
          );
        }
        
        // Option 2: Use Alchemy (free tier)
        if (process.env.ALCHEMY_API_KEY) {
          return new HDWalletProvider(
            process.env.MNEMONIC || process.env.PRIVATE_KEY,
            `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
          );
        }
        
        // Option 3: Public RPC (no key needed)
        return new HDWalletProvider(
          process.env.MNEMONIC || process.env.PRIVATE_KEY,
          "https://rpc.sepolia.org"
        );
      },
      network_id: 11155111, // Sepolia network ID
      gas: 6721975,
      gasPrice: 20000000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    }
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  mocha: {
    timeout: 100000
  }
};
