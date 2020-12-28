/* eslint-disable no-undef */
const ubxToken = artifacts.require("UbxToken");
const {
  BN, // Big Number support
} = require("@openzeppelin/test-helpers");
const encodeCall = require("./helpers/encodeCall");
const shouldBehaveLikeTokenV0 = require("./behaviors/tokenV0");

const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");

contract(
  "Token_V0",
  ([
    proxyOwner,
    tokenHolder,
    tokenOwner,
    tokenPauser1,
    tokenPauser2,
    recipient,
    anotherAccount,
  ]) => {
    const deployToken = async (
      tmpProxyOwner,
      tmpTokenHolder,
      tmpTokenOwner,
      tmpTokenPauser1,
      tmpTokenPauser2
    ) => {
      const implV0 = await ubxToken.new();
      const proxy = await OwnedUpgradeabilityProxy.new({from: tmpProxyOwner});
      const initialSupply = new BN("500000000000000000000000000");
      const initializeData = encodeCall(
        "initialize",
        [
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
        [
          "UpBots",
          "UBXT",
          18,
          web3.utils.toHex(initialSupply),
          tmpTokenHolder,
          tmpTokenOwner,
          [tmpTokenPauser1, tmpTokenPauser2],
        ]
      );

      // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
      await proxy.initialize(implV0.address, tmpProxyOwner, initializeData, {
        from: tmpProxyOwner,
      });

      return ubxToken.at(proxy.address);
    };

    shouldBehaveLikeTokenV0(
      proxyOwner,
      tokenOwner,
      tokenHolder,
      tokenPauser1,
      tokenPauser2,
      recipient,
      anotherAccount,
      deployToken
    );
  }
);
