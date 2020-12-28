/* eslint-disable no-undef */
const {
  BN, // Big Number support
  constants,
} = require("@openzeppelin/test-helpers");
const encodeCall = require("./helpers/encodeCall");

const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");
const TokenV0 = artifacts.require("UbxToken");

contract(
  "OwnedUpgradeabilityProxy",
  ([proxyAdmin, tokenOwner, tokenHolder, pauser]) => {
    let proxy;
    let implV0; // token_v0 without constructor
    let implV0PROXIED; // token_v0 initialized and proxied

    const initialSupply = web3.utils.toBN("500000000000000000000000000");
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
        tokenHolder,
        tokenOwner,
        [pauser],
      ]
    );

    it("should store implementation in specified location", async () => {
      proxy = await OwnedUpgradeabilityProxy.new({from: proxyAdmin});
      // deploying the token contract mus be without constructor
      implV0 = await TokenV0.new();
      let name = await implV0.name();
      let symbol = await implV0.symbol();
      let supply = await implV0.totalSupply();
      let owner = await implV0.owner();
      assert.deepEqual(name, "");
      assert.deepEqual(symbol, "");
      assert(supply.eq(new BN(0)));
      assert.deepEqual(owner, constants.ZERO_ADDRESS);

      // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
      await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
        from: proxyAdmin,
      });

      // now we can use the abi of tokenV0 and call at the proxy address

      implV0PROXIED = await TokenV0.at(proxy.address);
      name = await implV0PROXIED.name({from: tokenOwner});
      symbol = await implV0PROXIED.symbol({from: tokenOwner});
      supply = await implV0PROXIED.totalSupply({from: tokenOwner});
      owner = await implV0PROXIED.owner({from: tokenOwner});
      assert.deepEqual(name, "UpBots");
      assert.deepEqual(symbol, "UBXT");
      assert(supply.eq(initialSupply));
      assert.deepEqual(owner.toUpperCase(), tokenOwner.toUpperCase());

      const addrImpl = await proxy.implementation.call({from: proxyAdmin});

      assert.equal(addrImpl.toLowerCase(), implV0.address.toLowerCase());
    });
  }
);
