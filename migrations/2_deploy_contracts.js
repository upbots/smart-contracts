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

  /**
   * Constants
   */

  const tokenName = "UpBots";
  const tokenSymbol = "UBXT";
  const tokenDecimal = 18;
  const initialSupply = new BN("500000000000000000000000000");
  const {proxyAdmin, tokenHolder, tokenOwner, pausers} = getAccounts(accounts);

  console.log(
    `Note that addresses proxyAdmin:${proxyAdmin} tokenHolder:${tokenHolder} and tokenOwner:${tokenOwner} will need enough ETH to deploy `
  );
  console.log(`Deploying Proxy smart contract on network:${network}`);
  await deployer.deploy(OwnedUpgradeabilityProxy);
  console.log(
    `Proxy Contract deployed at address ${OwnedUpgradeabilityProxy.address}`
  );
  const proxySCInstance = await OwnedUpgradeabilityProxy.deployed();

  console.log(`Deploying Token smart contract on network:${network}`);
  await deployer.deploy(UbxToken);
  const tokenSCInstance = await UbxToken.deployed();
  console.log(`Token Contract deployed at address ${UbxToken.address}`);
  const initializeData = web3.eth.abi.encodeFunctionCall(
    {
      name: "initialize",
      type: "function",
      inputs: [
        {
          type: "string",
          name: "name",
        },
        {
          type: "string",
          name: "symbol",
        },
        {
          type: "uint8",
          name: "decimals",
        },
        {
          type: "uint256",
          name: "initialsupply",
        },
        {
          type: "address",
          name: "initialHolder",
        },
        {
          type: "address",
          name: "owner",
        },
        {
          type: "address[]",
          name: "pausers",
        },
      ],
    },
    [
      tokenName,
      tokenSymbol,
      tokenDecimal,
      web3.utils.toHex(initialSupply),
      tokenHolder,
      tokenOwner,
      pausers,
    ]
  );

  // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
  await proxySCInstance.initialize(
    tokenSCInstance.address,
    proxyAdmin,
    initializeData,
    {from: proxyAdmin}
  );
  console.log(`
  --Proxy initialized with:
    ProxyAddress:${proxySCInstance.address}
    Implementation:${UbxToken.address}
    proxyAdmin:${proxyAdmin}
    Name:${tokenName}
    Symbol:${tokenSymbol}
    Decimal:${tokenDecimal}
    InitialSupply:${UbxToken.address}
    tokenHolder:${tokenHolder}
    tokenOwner:${tokenOwner}
    pausers:${JSON.stringify(pausers)}`);

  const tokenSCProxied = await UbxToken.at(proxySCInstance.address, {
    from: proxyAdmin,
  });
  const symbol = await tokenSCProxied.symbol({from: tokenHolder});
  console.log(`     ----verification token symbol through proxy:${symbol}`);
};
