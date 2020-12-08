/* eslint-disable import/no-extraneous-dependencies */
const HDWalletProvider = require("@truffle/hdwallet-provider");

const fs = require("fs");

const mnemonic = fs.readFileSync(".secret").toString().trim();
const PROJECT_ID = fs.readFileSync(".secret.infura").toString().trim();
module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 7545,
      network_id: "*", // Any network (default: none)
    },
    production: {
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          `wss://mainnet.infura.io/ws/v3/${PROJECT_ID}`
        ),
      network_id: 1, // mainnet's id
      gas: 8000000,
      gasPrice: 200000000000, // 200 gwei (in wei)
      websockets: true, // (default: false)
      confirmations: 2, // (default: 0)
      timeoutBlocks: 50,
    },
    goerli: {
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          `wss://goerli.infura.io/ws/v3/${PROJECT_ID}`
        ),
      websockets: true, // (default: false)
      confirmations: 1, // (default: 0)
      network_id: 5, // goerli's id
      networkCheckTimeout: 1000000000,
      gas: 8000000,
      gasPrice: 50000000000, // 50 gwei (in wei)
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          `wss://ropsten.infura.io/ws/v3/${PROJECT_ID}`
        ),
      websockets: true, // (default: false)
      confirmations: 2, // (default: 0)
      network_id: 3, // ropsten's id
      networkCheckTimeout: 1000000000,
      gas: "3000000",
      gasPrice: "200000000000", // 200 gwei (in wei)
      timeoutBlocks: 50,
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          `wss://rinkeby.infura.io/ws/v3/${PROJECT_ID}`
        ),
      websockets: true, // (default: false)
      network_id: 4,
      gas: 4500000,
      gasPrice: 10000000000,
      timeoutBlocks: 50,
    },
    bsc_development: {
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          `https://data-seed-prebsc-1-s1.binance.org:8545`
        ),
      network_id: 97,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 3000000,
      gasPrice: "200000000000", // 200 gwei (in wei)
    },
    bsc_production: {
      provider: () =>
        new HDWalletProvider(mnemonic, `https://bsc-dataseed1.binance.org`),
      network_id: 56,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  plugins: ["solidity-coverage"],
  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "^0.7.0", // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
        },
        //  evmVersion: "byzantium"
      },
    },
  },
};
