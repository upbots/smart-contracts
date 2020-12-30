/* eslint-disable no-undef */
const {BN, expectEvent, expectRevert} = require("@openzeppelin/test-helpers");

const sign = require("./helpers/sign");
const encodeCall = require("./helpers/encodeCall");

const UbxToken = artifacts.require("UbxToken");
const BUbxTokenPeg = artifacts.require("BUbxTokenPeg");
const BUbxTokenPegProxy = artifacts.require("BUbxTokenPegProxy");
const UbxTokenProxy = artifacts.require("OwnedUpgradeabilityProxy");

contract("BUbxTokenPeg_V0", async (accounts) => {
  const [
    proxyAdmin,
    owner,
    validator1,
    validator2,
    binanceAccount,
    someAccount,
    otherAccount,
    ubxtHolder,
  ] = accounts;

  beforeEach(async () => {
    const ubxt = await UbxToken.new();
    const ubxtProxy = await UbxTokenProxy.new({from: proxyAdmin});
    const initialSupply = new BN("500000000000000000000000000");
    const initializeUbxt = encodeCall(
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
        ubxtHolder,
        owner,
        [validator1, validator2],
      ],
    );

    await ubxtProxy.initialize(ubxt.address, proxyAdmin, initializeUbxt, {
      from: proxyAdmin,
    });
    const tokenInstance = await UbxToken.at(ubxtProxy.address);

    const peg = await BUbxTokenPeg.new();
    const pegProxy = await BUbxTokenPegProxy.new({from: proxyAdmin});
    const validators = [validator1, validator2];
    const initializePeg = encodeCall(
      "initialize",
      [
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
      [tokenInstance.address, owner, validators],
    );

    await pegProxy.initialize(peg.address, proxyAdmin, initializePeg, {
      from: proxyAdmin,
    });

    const pegInstance = await BUbxTokenPeg.at(pegProxy.address);

    // add liquidity to fresh peg contract
    await tokenInstance.transfer(pegInstance.address, initialSupply, {
      from: ubxtHolder,
    });

    // expose deployed instances and variables to tests
    this.instance = pegInstance;
    this.token = tokenInstance;
    this.supply = initialSupply;
  });

  describe("initialize", () => {
    it("has liquidity to operate", async () => {
      const balance = await this.token.balanceOf(this.instance.address, {
        from: someAccount,
      });

      assert(balance.eq(this.supply));
    });
  });

  describe("validators", () => {
    it("can add validator as owner", async () => {
      const receipt = await this.instance.addValidator(someAccount, {
        from: owner,
      });

      expectEvent(receipt, "ValidatorAdded", {
        validator: someAccount,
      });
    });

    it("prevents validator adding when not owner", async () => {
      await expectRevert(
        this.instance.addValidator(someAccount, {from: someAccount}),
        "Ownable: caller is not the owner",
      );
    });

    it("can remove validator as owner", async () => {
      const receipt = await this.instance.removeValidator(validator1, {
        from: owner,
      });

      expectEvent(receipt, "ValidatorRemoved", {
        validator: validator1,
      });
    });

    it("reverts when validator removed twice", async () => {
      await this.instance.removeValidator(validator1, {from: owner});
      await expectRevert(
        this.instance.removeValidator(validator1, {from: owner}),
        "There is no such validator",
      );
    });

    it("prevents validator removal when not owner", async () => {
      await expectRevert(
        this.instance.removeValidator(validator2, {from: someAccount}),
        "Ownable: caller is not the owner",
      );
    });
  });

  describe("claim", () => {
    const amount = new BN(80);
    const nonce = new BN(123);
    const params = [
      {
        type: "address",
        value: binanceAccount,
      },
      {
        type: "uint256",
        value: amount,
      },
      {
        type: "uint256",
        value: nonce,
      },
    ];

    it("approves valid claim", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);
      const receipt = await this.instance.claim(
        binanceAccount,
        amount,
        nonce,
        signature,
        {from: binanceAccount},
      );

      expectEvent(receipt, "ClaimApproved", {
        binanceAddr: binanceAccount,
        amount,
      });
    });

    it("rejects already approved claim", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);
      await this.instance.claim(binanceAccount, amount, nonce, signature, {
        from: binanceAccount,
      });

      await expectRevert(
        this.instance.claim(binanceAccount, amount, nonce, signature, {
          from: binanceAccount,
        }),
        "Claim already approved",
      );
    });

    it("rejects invalid claim with wrong amount", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, new BN(666), nonce, signature, {
          from: binanceAccount,
        }),
        "Claim is not valid",
      );
    });

    it("rejects invalid claim with wrong nonce", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, amount, new BN(1337), signature, {
          from: binanceAccount,
        }),
        "Claim is not valid",
      );
    });

    it("rejects invalid claim with wrong binance address", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, amount, nonce, signature, {
          from: otherAccount,
        }),
        "Claimer and sender mismatch",
      );
    });

    it("rejects invalid claim with unauthorized signature", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, otherAccount);

      await expectRevert(
        this.instance.claim(binanceAccount, amount, nonce, signature, {
          from: binanceAccount,
        }),
        "Claim is not valid",
      );
    });

    it("transfers tokens for valid claim", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      const receipt = await this.instance.claim(
        binanceAccount,
        amount,
        nonce,
        signature,
        {from: binanceAccount},
      );

      const balance = await this.token.balanceOf(binanceAccount, {
        from: someAccount,
      });

      assert(balance.eq(new BN(80)));
    });

    it("rejects claim when liquidity too low", async () => {
      const tooMuch = this.supply.add(new BN(1));
      const params = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: tooMuch,
        },
        {
          type: "uint256",
          value: nonce,
        },
      ];
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, tooMuch, nonce, signature, {
          from: binanceAccount,
        }),
        "Claim exceeds liquidity",
      );
    });
  });
});
