/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const HDWalletProvider = require("@truffle/hdwallet-provider");

const fs = require("fs");

const {exit} = require("process");

const mnemonic = fs.readFileSync(".secret").toString().trim();

// node redeem.js 0x17Ab56648020786afa7bD4119E70A57f427391a1 3600 14400
// will begin now + 1 hour during 4 hours

const PROJECT_ID = fs.readFileSync(".secret.infura").toString().trim();
const beneficiaryAddress = process.argv.slice(2)[0];
const blockDuration = process.argv.slice(2)[1];
const duration = process.argv.slice(2)[2];
let start = process.argv.slice(2)[3];

const nodeURL = `https://kovan.infura.io/v3/${PROJECT_ID}`;
console.log("-----------NodeRL:", nodeURL);
const prov = new HDWalletProvider(mnemonic, nodeURL);

const Web3 = require("web3");

const web3 = new Web3(prov);

const getBalances = async (address) => {
  return web3.eth.getBalance(address);
};

const Contract = require("web3-eth-contract");
const jsonInterface = require("../../build/contracts/TokenRedeem.json");
// set provider for all later instances to use
Contract.setProvider(prov);

/**
 * CONSTANT
 *
 *  */
const gasPrice = web3.utils.toWei("100", "gwei");
const proxyAdmin = prov.addresses[0];
const now = Math.round(new Date().getTime() / 1000);
console.log(`-----------DATE NOW: ${now}   `);
if (!start) {
  start = now;
}
const redeemContract = new web3.eth.Contract(jsonInterface.abi);
const payload = {
  data: jsonInterface.bytecode,
  arguments: [beneficiaryAddress, start, blockDuration, duration, true],
};
const parameter = {
  from: proxyAdmin,
  gas: web3.utils.toHex(8000000),
  gasPrice,
};

// Function Call
redeemContract
  .deploy(payload)
  .send(parameter, (err, transactionHash) => {
    console.log("Transaction Hash :", transactionHash);
  })
  .on("confirmation", () => {})
  .then((newContractInstance) => {
    console.log(
      `Deployed Contract Address :${newContractInstance.options.address}
        for beneficiary:${beneficiaryAddress}
        start:${start}
        blockDuration:${blockDuration}
        duration:${duration}
        `
    );
    exit(0);
  });
