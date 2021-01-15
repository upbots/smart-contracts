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
    this.Action = {Claim: new BN(0), Waive: new BN(1)};
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
      const receipt = await this.instance.claim(binanceAccount, amount, nonce, signature, {
        from: binanceAccount,
      });

      expectEvent(receipt, "ActionApproved", {
        account: binanceAccount,
        validator: validator1,
        amount,
        action: this.Action.Claim,
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
        "Action already approved",
      );
    });

    it("rejects invalid claim with wrong amount", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, new BN(666), nonce, signature, {
          from: binanceAccount,
        }),
        "Action is not valid",
      );
    });

    it("rejects invalid claim with wrong nonce", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, amount, new BN(1337), signature, {
          from: binanceAccount,
        }),
        "Action is not valid",
      );
    });

    it("rejects invalid claim with wrong binance address", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await expectRevert(
        this.instance.claim(binanceAccount, amount, nonce, signature, {
          from: otherAccount,
        }),
        "Account and sender mismatch",
      );
    });

    it("rejects invalid claim with unauthorized signature", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, otherAccount);

      await expectRevert(
        this.instance.claim(binanceAccount, amount, nonce, signature, {
          from: binanceAccount,
        }),
        "Action is not valid",
      );
    });

    it("transfers tokens for valid claim", async () => {
      const message = await web3.utils.soliditySha3(...params);
      const signature = await sign(message, validator1);

      await this.instance.claim(binanceAccount, amount, nonce, signature, {
        from: binanceAccount,
      });

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

  describe("waive", () => {
    const action = async (action, params, nonce, validator) => {
      const [account, amount] = params.map((p) => p.value);
      const message = await web3.utils.soliditySha3(...params, nonce);
      const signature = await sign(message, validator);

      return await this.instance[action](account, amount, nonce, signature, {
        from: account,
      });
    };

    it("waives amount given", async () => {
      const amountWaived = new BN(100);
      const params = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: amountWaived,
        },
      ];

      await action("claim", params, new BN(123), validator1);

      let initialBalance = await this.token.balanceOf(this.instance.address, {
        from: someAccount,
      });

      assert(initialBalance.eq(this.supply.sub(amountWaived)));

      await this.token.approve(this.instance.address, amountWaived, {from: binanceAccount});
      const receipt = await action("waive", params, new BN(124), validator1);

      expectEvent(receipt, "ActionApproved", {
        account: binanceAccount,
        validator: validator1,
        amount: amountWaived,
        action: this.Action.Waive,
      });

      initialBalance = await this.token.balanceOf(this.instance.address, {
        from: someAccount,
      });
      assert(initialBalance.eq(this.supply));
    });

    it("waves amount not exceeding balance", async () => {
      const claimParams = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: new BN(100),
        },
      ];
      const waiveParams = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: new BN(120), //amount waived > claimed
        },
      ];
      const allowance = new BN(999); //allowance > waived

      await action("claim", claimParams, new BN(123), validator1);
      await this.token.approve(this.instance.address, allowance, {from: binanceAccount});
      await expectRevert(
        action("waive", waiveParams, new BN(124), validator1),
        "ERC20: transfer amount exceeds balance",
      );
    });

    it("fails when waived twice with used nonce", async () => {
      const params = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: new BN(60),
        },
      ];
      const allowance = new BN(120);

      await action("claim", params, new BN(123), validator1);
      await action("claim", params, new BN(124), validator1);
      await this.token.approve(this.instance.address, allowance, {from: binanceAccount});

      await action("waive", params, new BN(125), validator1);

      await expectRevert(
        action("waive", params, new BN(123), validator1),
        "Action already approved",
      );
      await expectRevert(
        action("waive", params, new BN(125), validator1),
        "Action already approved",
      );
    });

    it("fails when sender is not the waiver", async () => {
      const params = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: new BN(100),
        },
      ];
      const allowance = new BN(100);
      const message = await web3.utils.soliditySha3(...params, new BN(123));
      const signature = await sign(message, validator1);

      await action("claim", params, new BN(123), validator1);
      await this.token.approve(this.instance.address, allowance, {from: binanceAccount});

      await expectRevert(
        this.instance.waive(binanceAccount, allowance, new BN(124), signature, {
          from: someAccount,
        }),
        "Account and sender mismatch",
      );
    });

    it("fails with fake signature", async () => {
      const params = [
        {
          type: "address",
          value: binanceAccount,
        },
        {
          type: "uint256",
          value: new BN(100),
        },
      ];
      const allowance = new BN(100);
      const message = await web3.utils.soliditySha3(...params, new BN(123));
      const fakeSignature = await sign(message, someAccount);

      await action("claim", params, new BN(123), validator1);
      await this.token.approve(this.instance.address, allowance, {from: binanceAccount});

      await expectRevert(
        this.instance.waive(binanceAccount, allowance, new BN(124), fakeSignature, {
          from: binanceAccount,
        }),
        "Action is not valid",
      );
    });
  });
});
