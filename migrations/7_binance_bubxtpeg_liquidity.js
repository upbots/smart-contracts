/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const chalk = require("chalk");

const info = chalk.blue;
const warn = chalk.orange;
const log = chalk.green;

const BUbxTokenPegProxy = artifacts.require("BUbxTokenPegProxy");
const UbxTokenProxy = artifacts.require("OwnedUpgradeabilityProxy");
const UbxToken = artifacts.require("UbxToken");
const initWeb3 = require("./helpers/web3Provider");
const getAccounts = require("./helpers/getAccounts");

module.exports = async (_, network, accounts) => {
  if (!network.match(/bsc|develop/)) {
    console.log(info("Skipping: This migration is for Binance network only"));
    return;
  }

  const web3 = initWeb3(network);
  const {BN} = web3.utils;
  const {tokenHolder, holders, binanceTokenHolder} = getAccounts(accounts, web3.utils);

  if (holders.length > 0) {
    console.log(
      warn(
        "Warning: token holders are set; UBXT liquidity of the contract may be less than total supply",
      ),
    );
  }

  const pegProxy = await BUbxTokenPegProxy.deployed();
  const ubxtProxy = await UbxTokenProxy.deployed();
  const ubxt = await UbxToken.at(ubxtProxy.address);

  const holder = binanceTokenHolder || tokenHolder;

  if (!holder) {
    console.log(error("Holder account is empty!"));
    return;
  }

  const tokenAmount = new BN(
    await ubxt.balanceOf(holder, {
      from: holder,
    }),
  );

  if (tokenAmount.gt(new BN(0))) {
    console.log(info(`Transferring tokens to BUbxTokenPeg...`));
    console.log(`Token amount: ${log(tokenAmount)}`);
    console.log(`BUbxTokenPeg account: ${log(pegProxy.address)}`);
    console.log(`Token Holder account: ${log(holder)}`);

    ubxt.transfer(pegProxy.address, new BN(tokenAmount), {
      from: holder,
    });
  } else {
    console.log(error("Holder account has zero balance!"));
  }
};
