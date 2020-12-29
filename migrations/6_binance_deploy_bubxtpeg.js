/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const chalk = require("chalk");

const info = chalk.blue;
const log = chalk.yellow;

const BUbxTokenPeg = artifacts.require("BUbxTokenPeg");
const UbxToken = artifacts.require("UbxToken");
const UbxTokenProxy = artifacts.require("OwnedUpgradeabilityProxy");
const Proxy = artifacts.require("BUbxTokenPegProxy");
const initWeb3 = require("./helpers/web3Provider");
const getAccounts = require("./helpers/getAccounts");

module.exports = async (deployer, network, accounts) => {
  const web3 = initWeb3(network);

  if (!network.match(/bsc|develop/)) {
    console.log(
      chalk.blue("Skipping: This migration is for Binance network only"),
    );
    return;
  }

  /**
   * Constants
   */
  const {proxyAdmin, tokenOwner, validators} = getAccounts(accounts);

  console.log(info("Setting up UBXT token peg for Binance..."));
  console.log(`Owner: ${log(tokenOwner)}`);
  console.log(`Validators: ${log(validators)}`);

  console.log(`Deploying Proxy smart contract on network:${log(network)}`);

  const pegProxy = await Proxy.new();

  console.log(`Proxy Contract deployed at address ${log(pegProxy.address)}`);

  console.log("Deploying BUbxTokenPeg smart");

  await deployer.deploy(BUbxTokenPeg);

  console.log(`Peg Contract deployed at address ${log(BUbxTokenPeg.address)}`);

  // TODO: this token needs to be an argument passed to peg
  const ubxtProxy = await UbxTokenProxy.deployed();
  const ubxToken = await UbxToken.at(ubxtProxy.address);
  const peg = await BUbxTokenPeg.deployed();

  const initializeData = web3.eth.abi.encodeFunctionCall(
    {
      name: "initialize",
      type: "function",
      inputs: [
        {
          type: "address",
          internalType: "contract IERC20",
          name: "token",
        },
        {
          type: "address",
          name: "owner",
        },
        {
          type: "address[]",
          name: "validators",
        },
      ],
    },
    [ubxToken.address, tokenOwner, validators],
  );

  await pegProxy.initialize(peg.address, proxyAdmin, initializeData, {
    from: proxyAdmin,
  });
  console.log(`
  --Proxy for BUbxTokenPeg initialized with:
    ProxyAddress:${log(pegProxy.address)}
    Implementation:${log(BUbxTokenPeg.address)}
    proxyAdmin:${log(proxyAdmin)}
    owner:${log(tokenOwner)}
    validators:${log(JSON.stringify(validators))}`);
};
