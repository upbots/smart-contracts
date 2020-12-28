/* eslint-disable no-undef */
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");

const sign = require('./helpers/sign');

const UbxToken = artifacts.require("UbxToken");
const BUbxTokenPeg = artifacts.require("BUbxTokenPeg");
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");

contract("BUbxTokenPeg_V0", async (accounts) => {
  const [proxyAdmin, owner, validator1, validator2, binanceAccount, someAccount, otherAccount] = accounts;

  beforeEach(async () => {
    const validators = [validator1, validator2];
    const proxy = await OwnedUpgradeabilityProxy.new({ from: proxyAdmin });
    const peg = await BUbxTokenPeg.new();
    const ubxt = await UbxToken.deployed();

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
      [ubxt.address, owner, validators]
    );

    await proxy.initialize(peg.address, proxyAdmin, initializeData, {
      from: proxyAdmin,
    });

    this.instance = await BUbxTokenPeg.at(proxy.address);
  });

  describe("initialize", () => {
    it("has liquidity to operate");
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
        this.instance.addValidator(someAccount, { from: someAccount }),
        "Ownable: caller is not the owner"
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
      await this.instance.removeValidator(validator1, { from: owner });
      await expectRevert(
        this.instance.removeValidator(validator1, { from: owner }),
        "There is no such validator"
      );
    });

    it("prevents validator removal when not owner", async () => {
      await expectRevert(
        this.instance.removeValidator(validator2, { from: someAccount }),
        "Ownable: caller is not the owner"
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
        { from: someAccount }
      );

      expectEvent(receipt, "ClaimApproved", {
        binanceAddr: binanceAccount,
        amount,
      });
    });

    it("rejects already approved claim", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);
      await this.instance.claim(
        binanceAccount,
        amount,
        nonce,
        signature,
        { from: someAccount }
      );

      await expectRevert(
        this.instance.claim(
          binanceAccount,
          amount,
          nonce,
          signature,
          { from: someAccount }
        ),
        "Claim already approved"
      );
    });

    it("rejects invalid claim with wrong amount", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(
          binanceAccount,
          new BN(666),
          nonce,
          signature,
          { from: someAccount }
        ),
        "Claim is not valid"
      );
    });

    it("rejects invalid claim with wrong nonce", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(
          binanceAccount,
          amount,
          new BN(1337),
          signature,
          { from: someAccount }
        ),
        "Claim is not valid"
      );
    });

    it("rejects invalid claim with wrong binance address", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(
          otherAccount,
          amount,
          nonce,
          signature,
          { from: someAccount }
        ),
        "Claim is not valid"
      );
    });

    it("rejects invalid claim with unauthorized signature", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, otherAccount);

      await expectRevert(
        this.instance.claim(
          binanceAccount,
          amount,
          nonce,
          signature,
          { from: someAccount }
        ),
        "Claim is not valid"
      );
    });

    it("transfers tokens for valid claim");
    it("rejects claim when liquidity too low");
  });
});
