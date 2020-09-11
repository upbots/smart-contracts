/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const UbxToken = artifacts.require("UbxToken");
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");
const initWeb3 = require("./helpers/web3Provider");
const getAccounts = require("./helpers/getAccounts");

module.exports = async (deployer, network, accounts) => {
  const web3 = initWeb3(network);
  const {BN} = web3.utils;
  const {tokenHolder, holders} = getAccounts(accounts, web3.utils);
  if (holders.length > 0) {
    const proxySCInstance = await OwnedUpgradeabilityProxy.deployed();
    const tokenSCProxied = await UbxToken.at(proxySCInstance.address);
    console.log(`Transferring tokens from token holder account:${tokenHolder}`);
    const tokenHolderAmount = new BN(
      await tokenSCProxied.balanceOf(tokenHolder, {
        from: tokenHolder,
      })
    );
    console.log(`--token Holder Amount      ${tokenHolderAmount}`);
    const totalAmountToTransfer = holders.reduce((res, h) => {
      return {
        value: res.value.add(h.value),
      };
    }).value;
    console.log(`--total Amount To Transfer ${totalAmountToTransfer}`);
    if (totalAmountToTransfer.gt(tokenHolderAmount)) {
      throw new Error(
        `total Amount To Transfer: ${totalAmountToTransfer} is greater than token Holder Amount:${tokenHolderAmount}`
      );
    }
    const tx = holders.map((h) => {
      console.log(`- Will transfer ${h.value} token in wei to ${h.address}`);
      return tokenSCProxied.transfer(h.address, new BN(h.value), {
        from: tokenHolder,
      });
    });
    await Promise.all(tx);

    const verifTransfers = holders.map((h) => {
      return tokenSCProxied.balanceOf(h.address, {
        from: tokenHolder,
      });
    });

    const receipt = await Promise.all(verifTransfers);
    const totalAmountTransfered = receipt
      .map((res) => new BN(res, 16))
      .reduce((res, val) => res.add(val));

    console.log(`--total Amount Transfered  ${totalAmountTransfered}`);

    if (!totalAmountToTransfer.eq(totalAmountTransfered)) {
      throw new Error(
        `total Amount To Transfer: ${totalAmountToTransfer} is not equal to  total Amount Transfered:${totalAmountTransfered}`
      );
    }
  }
};
