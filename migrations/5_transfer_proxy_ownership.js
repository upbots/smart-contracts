/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");
const getAccounts = require("./helpers/getAccounts");

module.exports = async (deployer, network, accounts) => {
  const {proxyAdmin, newProxyAdmin} = getAccounts(accounts);

  if (newProxyAdmin !== "") {
    const proxySCInstance = await OwnedUpgradeabilityProxy.deployed();

    const verifyProxyAdmin = await proxySCInstance.admin.call({
      from: proxyAdmin,
    });

    if (verifyProxyAdmin !== proxyAdmin || verifyProxyAdmin === newProxyAdmin) {
      throw new Error(
        `Actual proxy Admin: ${verifyProxyAdmin} either doesn't correspond to the proxyAdmin:${proxyAdmin} or is the same as the new proxy admin:${newProxyAdmin}`
      );
    }

    console.log(
      `Proxy admin will change  from ${proxyAdmin} to ${newProxyAdmin}....`
    );

    const receipt = await proxySCInstance.changeAdmin(newProxyAdmin, {
      from: proxyAdmin,
    });
    if (receipt.receipt.status === true) {
      console.log(
        `Succes  : Proxy admin changed  from ${proxyAdmin} to ${newProxyAdmin}`
      );
    } else {
      console.log(
        `////// ****** Failed ! : Proxy admin NOT changed from ${proxyAdmin} to ${newProxyAdmin}
        ////// Details: ${JSON.stringify(receipt)}`
      );
    }
  }
};
