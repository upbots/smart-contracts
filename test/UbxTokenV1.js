/* eslint-disable no-undef */
const ubxToken = artifacts.require("UbxToken");
const ubxTokenV1 = artifacts.require("UbxTokenV1");
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const encodeCall = require("./helpers/encodeCall");
const shouldBehaveLikeTokenV0 = require("./behaviors/tokenV0");

const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");

contract(
  "Token_V1",
  ([
    // eslint-disable-next-line no-unused-vars
    _,
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

      const implV1 = await ubxTokenV1.new();
      await proxy.upgradeTo(implV1.address, {from: tmpProxyOwner});

      return ubxTokenV1.at(proxy.address);
    };

    shouldBehaveLikeTokenV0(
      proxyOwner,
      tokenHolder,
      tokenOwner,
      tokenPauser1,
      tokenPauser2,
      recipient,
      anotherAccount,
      deployToken
    );

    describe("V2 functionnalities", () => {
      beforeEach(async () => {
        this.token = await deployToken(
          proxyOwner,
          tokenHolder,
          tokenOwner,
          tokenPauser1,
          tokenPauser2
        );
      });

      describe("BurnDouble", () => {
        const owner = anotherAccount;

        beforeEach(async () => {
          await this.token.mint(owner, 100, {from: tokenOwner});
        });

        describe("when the given amount is not greater than balance of the sender", () => {
          const halfAmount = 50;
          it("burns the requested amount", async () => {
            await this.token.burnDouble(halfAmount, {from: owner});

            const balance = await this.token.balanceOf(owner);
            assert.equal(balance, 0);
          });

          it("emits a BurnDouble event", async () => {
            const receipt = await this.token.burnDouble(halfAmount, {
              from: owner,
            });

            expectEvent(receipt, "BurnDouble", {
              burner: owner,
              value: new BN(halfAmount * 2),
            });
          });
        });

        describe("when the given amount is greater than the balance of the sender", () => {
          const amount = 51;

          it("reverts", async () => {
            await expectRevert(
              this.token.burnDouble(amount, {from: owner}),
              "balance too low to burn"
            );
          });
        });
      });
      describe("mint", () => {
        describe("by token Owner", () => {
          it("should emit event and increase totalSupply ", async () => {
            const initTotalSupply = await this.token.totalSupply();
            const receipt = await this.token.mint(anotherAccount, 100, {
              from: tokenOwner,
            });
            const totalSupply = await this.token.totalSupply();
            expectEvent(receipt, "Transfer", {
              from: constants.ZERO_ADDRESS,
              to: anotherAccount,
              value: new BN(100),
            });
            assert(totalSupply.eq(initTotalSupply.add(new BN(100))));
          });
          describe("not token Owner", () => {
            it("reverts  ", async () => {
              await expectRevert(
                this.token.mint(anotherAccount, 100, {from: tokenPauser1}),
                "Ownable: caller is not the owner"
              );
            });
          });
        });
      });
      describe("can reclaim", () => {
        it("ether", async () => {
          await web3.eth.getBalance(tokenPauser2);

          const balTokenSCinit = await web3.eth.getBalance(this.token.address);
          assert.equal(balTokenSCinit, 0);
          const gasPrice = new BN(await web3.eth.getGasPrice());
          const transferAmount = web3.utils.toWei("0.42", "ether");
          await this.token.depositEther({
            value: transferAmount,
            from: tokenPauser2,
          });

          const balTokenSC = new BN(
            await web3.eth.getBalance(this.token.address)
          );

          const TransAmountBN = new BN(transferAmount);
          assert(balTokenSC.eq(TransAmountBN));

          const balTokenOwner = new BN(await web3.eth.getBalance(tokenOwner));

          const {receipt} = await this.token.reclaimEther({
            from: tokenOwner,
          });

          const balTokenSCAfterReclaim = await web3.eth.getBalance(
            this.token.address
          );
          assert.equal(balTokenSCAfterReclaim, 0);

          const feeReclaimEther = gasPrice.mul(
            new BN(receipt.cumulativeGasUsed)
          );
          const balTokenOwnerAfterReclaim = new BN(
            await web3.eth.getBalance(tokenOwner)
          );
          const sendEth = TransAmountBN.sub(feeReclaimEther);

          assert(balTokenOwnerAfterReclaim.eq(balTokenOwner.add(sendEth)));
        });
        it("ether but revert if not owner", async () => {
          await web3.eth.getBalance(tokenPauser2);

          const balTokenSCinit = await web3.eth.getBalance(this.token.address);
          assert.equal(balTokenSCinit, 0);

          const transferAmount = web3.utils.toWei("0.42", "ether");
          await this.token.depositEther({
            value: transferAmount,
            from: tokenPauser2,
          });

          const balTokenSC = new BN(
            await web3.eth.getBalance(this.token.address)
          );

          const TransAmountBN = new BN(transferAmount);
          assert(balTokenSC.eq(TransAmountBN));

          await expectRevert(
            this.token.reclaimEther({
              from: tokenPauser2,
            }),
            "Ownable: caller is not the owner"
          );
        });
      });
    });
  }
);
