/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const UbxToken = artifacts.require("UbxToken");
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");
const getAccounts = require("./helpers/getAccounts");

module.exports = async (deployer, network, accounts) => {
  const {tokenOwner, newTokenOwner} = getAccounts(accounts);

  if (newTokenOwner !== "") {
    const proxySCInstance = await OwnedUpgradeabilityProxy.deployed();
    const tokenSCProxied = await UbxToken.at(proxySCInstance.address);

    const verifyTokenOwner = await tokenSCProxied.owner({
      from: tokenOwner,
    });
    if (verifyTokenOwner !== tokenOwner || verifyTokenOwner === newTokenOwner) {
      throw new Error(
        `Actual token owner: ${verifyTokenOwner} either doesn't correspond to the tokenOwner:${tokenOwner} or is the same as the new token owner:${newTokenOwner}`
      );
    }

    console.log(
      `Transferring ownership of the token from ${tokenOwner} to ${newTokenOwner}`
    );
    const receipt = await tokenSCProxied.transferOwnership(newTokenOwner, {
      from: tokenOwner,
    });
    if (receipt.receipt.status === true) {
      console.log(
        `Succes  : Ownership transfered  from ${tokenOwner} to ${newTokenOwner}`
      );
    } else {
      console.log(
        `////// ****** Failed ! : Ownership NOT transfered from ${tokenOwner} to ${newTokenOwner}
        ////// Details: ${JSON.stringify(receipt)}`
      );
    }
  }
};
