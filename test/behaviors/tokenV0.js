/* eslint-disable no-undef */
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");

function shouldBehaveLikeTokenV0(
  proxyOwner,
  tokenOwner,
  tokenHolder,
  tokenPauser1,
  tokenPauser2,
  recipient,
  anotherAccount,
  deployToken
) {
  beforeEach(async () => {
    this.token = await deployToken(
      proxyOwner,
      tokenHolder,
      tokenOwner,
      tokenPauser1,
      tokenPauser2
    );
  });

  describe("initialize", () => {
    it("can not be initialized twice", async () => {
      await expectRevert.unspecified(
        this.token.initialize(
          "chameauCoin",
          "DTC",
          18,
          1223334444,
          anotherAccount,
          anotherAccount,
          [anotherAccount]
        )
      );
    });
  });

  describe("owner", () => {
    it("has an owner", async () => {
      const owner = await this.token.owner({from: anotherAccount});

      assert.equal(owner, tokenOwner);
    });
  });

  describe("transfer ownership", () => {
    describe("when the new proposed owner is not the zero address", () => {
      const newOwner = anotherAccount;

      describe("when the sender is the token owner", () => {
        const from = tokenOwner;

        it("transfers the ownership", async () => {
          await this.token.transferOwnership(newOwner, {from});

          const owner = await this.token.owner({
            from: anotherAccount,
          });
          assert.equal(owner, anotherAccount);
        });

        it("emits an event", async () => {
          const {logs} = await this.token.transferOwnership(newOwner, {
            from,
          });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, "OwnershipTransferred");
          assert.equal(logs[0].args.previousOwner, tokenOwner);
          assert.equal(logs[0].args.newOwner, newOwner);
        });
      });

      describe("when the sender is the proxy owner", () => {
        it("reverts", async () => {
          await expectRevert(
            this.token.transferOwnership(newOwner, {from: proxyOwner}),
            "Cannot call fallback function from the proxy admin"
          );
        });
      });

      describe("when the sender is not the owner", () => {
        it("reverts", async () => {
          await expectRevert(
            this.token.transferOwnership(newOwner, {from: anotherAccount}),
            "Ownable: caller is not the owner"
          );
        });
      });
    });

    describe("when the new proposed owner is the zero address", () => {
      it("reverts", async () => {
        await expectRevert(
          this.token.transferOwnership(constants.ZERO_ADDRESS, {
            from: tokenOwner,
          }),
          "Ownable: new owner is the zero address"
        );
      });
    });
  });

  describe("pause", () => {
    describe("when the sender is the token owner or another account", () => {
      it("reverts", async () => {
        await expectRevert(
          this.token.pause({from: tokenOwner}),
          "PauserRole: caller does not have the Pauser role"
        );
        await expectRevert(
          this.token.pause({from: anotherAccount}),
          "PauserRole: caller does not have the Pauser role"
        );
      });
    });
    describe("when the sender is the pauser", () => {
      it("pauser2 should pause", async () => {
        const receipt = await this.token.pause({from: tokenPauser2});
        expectEvent(receipt, "Paused", {
          account: tokenPauser2,
        });

        const paused = await this.token.paused({from: anotherAccount});
        assert(paused === true);
      });
      it("pauser1 should pause", async () => {
        const receipt = await this.token.pause({from: tokenPauser1});

        expectEvent(receipt, "Paused", {
          account: tokenPauser1,
        });

        const paused = await this.token.paused({from: anotherAccount});
        assert(paused === true);
      });
    });
    describe("when the sender is a pauser and contract is already pause", () => {
      it("reverts", async () => {
        const receipt = await this.token.pause({from: tokenPauser1});

        expectEvent(receipt, "Paused", {
          account: tokenPauser1,
        });
        await expectRevert(
          this.token.pause({from: tokenPauser2}),
          "Pausable: paused"
        );
      });
      it("should unpause", async () => {
        const receipt = await this.token.pause({from: tokenPauser1});

        expectEvent(receipt, "Paused", {
          account: tokenPauser1,
        });
        const paused = await this.token.paused({from: anotherAccount});
        assert(paused === true);
        const receipt2 = await this.token.unpause({from: tokenPauser2});
        expectEvent(receipt2, "Unpaused", {
          account: tokenPauser2,
        });
        const paused2 = await this.token.paused({from: anotherAccount});
        assert(paused2 === false);
      });
    });
    describe("when contract is paused", () => {
      it("can't transfer", async () => {
        await this.token.pause({from: tokenPauser1});

        await expectRevert(
          this.token.transfer(anotherAccount, 20, {from: tokenHolder}),
          "ERC20Pausable: token transfer while paused"
        );
      });
      it("can't burn", async () => {
        await this.token.pause({from: tokenPauser1});
        await expectRevert(
          this.token.burn(20, {from: tokenHolder}),
          "ERC20Pausable: token transfer while paused"
        );
      });
    });
    describe("when the sender is a pauser ", () => {
      it("can add a pauser", async () => {
        let receipt = await this.token.pause({from: tokenPauser1});

        expectEvent(receipt, "Paused", {
          account: tokenPauser1,
        });
        receipt = await this.token.addPauser(anotherAccount, {
          from: tokenPauser1,
        });

        expectEvent(receipt, "PauserAdded", {
          account: anotherAccount,
        });
        receipt = await this.token.unpause({from: anotherAccount});
        expectEvent(receipt, "Unpaused", {
          account: anotherAccount,
        });
      });
      it("can renounce to be a pauser", async () => {
        const receipt = await this.token.renouncePauser({
          from: tokenPauser1,
        });

        expectEvent(receipt, "PauserRemoved", {
          account: tokenPauser1,
        });

        await expectRevert(
          this.token.pause({from: tokenPauser1}),
          "PauserRole: caller does not have the Pauser role"
        );
      });
      it("should unpause", async () => {
        const receipt = await this.token.pause({from: tokenPauser1});

        expectEvent(receipt, "Paused", {
          account: tokenPauser1,
        });
        const paused = await this.token.paused({from: anotherAccount});
        assert(paused === true);
        const receipt2 = await this.token.unpause({from: tokenPauser2});
        expectEvent(receipt2, "Unpaused", {
          account: tokenPauser2,
        });
        const paused2 = await this.token.paused({from: anotherAccount});
        assert(paused2 === false);
      });
    });
  });

  describe("total supply", () => {
    describe("when there are no tokens", () => {
      it("returns zero", async () => {
        let totalSupply = await this.token.totalSupply({
          from: anotherAccount,
        });
        await this.token.burn(totalSupply, {from: tokenHolder});
        totalSupply = await this.token.totalSupply({
          from: anotherAccount,
        });
        assert(totalSupply.eq(new BN(0)));
      });
    });

    describe("when there are some tokens", () => {
      beforeEach(async () => {
        await this.token.transfer(anotherAccount, 100, {from: tokenHolder});
      });

      it("returns the total amount of tokens", async () => {
        let totalSupply = await this.token.totalSupply({
          from: anotherAccount,
        });
        await this.token.burn(totalSupply.sub(new BN(100)), {
          from: tokenHolder,
        });
        totalSupply = await this.token.totalSupply({
          from: anotherAccount,
        });
        assert(totalSupply.eq(new BN(100)));
      });
    });
  });

  describe("balanceOf", () => {
    describe("when the requested account has no tokens", () => {
      it("returns zero", async () => {
        const balance = await this.token.balanceOf(anotherAccount, {
          from: anotherAccount,
        });
        assert(new BN(balance).eq(new BN(0)));
        // assert(balance.eq(new BN(0)));
      });
    });

    describe("when the requested account has some tokens", () => {
      beforeEach(async () => {
        await this.token.transfer(anotherAccount, 100, {from: tokenHolder});
      });

      it("returns the total amount of tokens", async () => {
        const balance = await this.token.balanceOf(anotherAccount, {
          from: anotherAccount,
        });
        assert(new BN(balance).eq(new BN(100)));
        // assert(balance.eq(new BN(100)));
      });
    });
  });

  describe("transfer", () => {
    const amount = 100;

    describe("when the recipient is not the zero address", () => {
      const to = recipient;

      describe("when the sender does not have enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount - 1, {
            from: tokenHolder,
          });
        });

        it("reverts", async () => {
          await expectRevert(
            this.token.transfer(to, amount, {from: anotherAccount}),
            "ERC20: transfer amount exceeds balance"
          );
        });
      });

      describe("when the sender has enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount, {
            from: tokenHolder,
          });
        });

        it("transfer the requested amount", async () => {
          await this.token.transfer(to, amount, {from: anotherAccount});

          const senderBalance = await this.token.balanceOf(anotherAccount, {
            from: anotherAccount,
          });
          assert(new BN(senderBalance).eq(new BN(0)));
          // assert.equal(senderBalance, 0);

          const recipientBalance = await this.token.balanceOf(to, {
            from: anotherAccount,
          });
          assert(new BN(recipientBalance).eq(new BN(amount)));
          // assert.equal(recipientBalance, amount);
        });

        it("emits a transfer event", async () => {
          const receipt = await this.token.transfer(to, amount, {
            from: anotherAccount,
          });
          expectEvent(receipt, "Transfer", {
            from: anotherAccount,
            to,
            value: new BN(amount),
          });
        });
      });
    });

    describe("when the recipient is the zero address", () => {
      const to = constants.ZERO_ADDRESS;

      it("reverts", async () => {
        await expectRevert(
          this.token.transfer(to, 100, {from: tokenHolder}),
          "ERC20: transfer to the zero address"
        );
      });
    });
  });

  describe("approve", () => {
    const amount = 100;

    describe("when the spender is not the zero address", () => {
      const spender = recipient;

      describe("when the sender has enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount, {
            from: tokenHolder,
          });
        });

        it("emits an approval event", async () => {
          const receipt = await this.token.approve(spender, amount, {
            from: anotherAccount,
          });
          expectEvent(receipt, "Approval", {
            owner: anotherAccount,
            spender,
            value: new BN(amount),
          });
        });

        describe("when there was no approved amount before", () => {
          it("approves the requested amount", async () => {
            await this.token.approve(spender, amount, {from: anotherAccount});

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount)));
            // assert.equal(allowance, amount);
          });
        });

        describe("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await this.token.approve(spender, 1, {from: tokenHolder});
          });

          it("approves the requested amount and replaces the previous one", async () => {
            await this.token.approve(spender, amount, {from: tokenHolder});

            const allowance = await this.token.allowance(tokenHolder, spender, {
              from: anotherAccount,
            });
            assert(new BN(allowance).eq(new BN(amount)));
            // assert.equal(allowance, amount);
          });
        });
      });

      describe("when the sender does not have enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount - 1, {
            from: tokenHolder,
          });
        });

        it("emits an approval event", async () => {
          const receipt = await this.token.approve(spender, amount, {
            from: anotherAccount,
          });
          expectEvent(receipt, "Approval", {
            owner: anotherAccount,
            spender,
            value: new BN(amount),
          });
        });

        describe("when there was no approved amount before", () => {
          it("approves the requested amount", async () => {
            await this.token.approve(spender, amount, {from: anotherAccount});

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount)));
          });
        });

        describe("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await this.token.approve(spender, 1, {from: anotherAccount});
          });

          it("approves the requested amount and replaces the previous one", async () => {
            await this.token.approve(spender, amount, {from: anotherAccount});

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount)));
            // assert.equal(allowance, amount);
          });
        });
      });
    });

    describe("when the spender is the zero address", () => {
      const spender = constants.ZERO_ADDRESS;

      beforeEach(async () => {
        await this.token.transfer(anotherAccount, amount, {
          from: tokenHolder,
        });
      });

      it("approves the requested amount", async () => {
        await expectRevert(
          this.token.approve(spender, amount, {from: tokenHolder}),
          "ERC20: approve to the zero address"
        );

        /*  await this.token.approve(spender, amount, { from: owner });

        const allowance = await this.token.allowance(owner, spender);
        assert(new BN(allowance).eq(new BN(amount))); */
        // assert.equal(allowance, amount);
      });

      /*  it("emits an approval event", async () => {
        const { logs } = await this.token.approve(spender, amount, {
          from: owner,
        });

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, "Approval");
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(new BN(logs[0].args.value).eq(new BN(amount)));
        //assert(logs[0].args.value.eq(amount));
      }); */
    });
  });

  describe("transfer from", () => {
    const amount = 100;
    const spender = recipient;

    describe("when the recipient is not the zero address", () => {
      describe("when the spender has enough approved balance", () => {
        beforeEach(async () => {
          await this.token.approve(spender, amount, {from: anotherAccount});
        });

        describe("when the owner has enough balance", () => {
          beforeEach(async () => {
            await this.token.transfer(anotherAccount, amount, {
              from: tokenHolder,
            });
          });

          it("transfer the requested amount", async () => {
            const to = spender;
            await this.token.transferFrom(anotherAccount, to, amount, {
              from: spender,
            });

            const senderBalance = await this.token.balanceOf(anotherAccount, {
              from: anotherAccount,
            });
            assert(new BN(senderBalance).eq(new BN(0)));

            const recipientBalance = await this.token.balanceOf(to, {
              from: anotherAccount,
            });
            assert(new BN(recipientBalance).eq(new BN(amount)));
          });

          it("decreases the spender allowance", async () => {
            const to = spender;
            await this.token.transferFrom(anotherAccount, to, amount, {
              from: spender,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(0)));
            // assert(allowance.eq(0));
          });

          it("emits a transfer event", async () => {
            const to = spender;
            const receipt = await this.token.transferFrom(
              anotherAccount,
              to,
              amount,
              {
                from: spender,
              }
            );
            expectEvent(receipt, "Transfer", {
              from: anotherAccount,
              to,
              value: new BN(amount),
            });
          });
        });

        describe("when the owner does not have enough balance", () => {
          beforeEach(async () => {
            await this.token.transfer(anotherAccount, amount - 1, {
              from: tokenHolder,
            });
          });

          it("reverts", async () => {
            const to = spender;
            await expectRevert(
              this.token.transferFrom(anotherAccount, to, amount, {
                from: spender,
              }),
              "ERC20: transfer amount exceeds balance"
            );
          });
        });
      });

      describe("when the spender does not have enough approved balance", () => {
        beforeEach(async () => {
          await this.token.approve(spender, amount - 1, {
            from: anotherAccount,
          });
        });

        describe("when the owner has enough balance", () => {
          beforeEach(async () => {
            await this.token.transfer(anotherAccount, amount, {
              from: tokenHolder,
            });
          });

          it("reverts", async () => {
            const to = spender;
            await expectRevert(
              this.token.transferFrom(anotherAccount, to, amount, {
                from: spender,
              }),
              "ERC20: transfer amount exceeds allowance"
            );
          });
        });

        describe("when the owner does not have enough balance", () => {
          beforeEach(async () => {
            await this.token.transfer(anotherAccount, amount - 1, {
              from: tokenHolder,
            });
          });

          it("reverts", async () => {
            const to = spender;
            await expectRevert(
              this.token.transferFrom(anotherAccount, to, amount, {
                from: spender,
              }),
              "ERC20: transfer amount exceeds balance"
            );
          });
        });
      });
    });

    describe("when the recipient is the zero address", () => {
      const to = constants.ZERO_ADDRESS;

      beforeEach(async () => {
        await this.token.transfer(anotherAccount, amount, {
          from: tokenHolder,
        });
        await this.token.approve(spender, amount, {from: anotherAccount});
      });

      it("reverts", async () => {
        await expectRevert(
          this.token.transferFrom(anotherAccount, to, amount, {
            from: spender,
          }),
          "ERC20: transfer to the zero address"
        );
      });
    });
  });

  describe("decrease approval", () => {
    const amount = 100;

    describe("when the spender is not the zero address", () => {
      const spender = recipient;

      describe("when the sender has enough balance and allowance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount, {
            from: tokenHolder,
          });
          await this.token.increaseAllowance(spender, amount, {
            from: anotherAccount,
          });
        });

        it("emits an approval event", async () => {
          const allow = await this.token.allowance(anotherAccount, spender, {
            from: anotherAccount,
          });
          const balance = await this.token.balanceOf(anotherAccount, {
            from: anotherAccount,
          });
          assert(new BN(allow).eq(new BN(balance)));

          const receipt = await this.token.decreaseAllowance(spender, amount, {
            from: anotherAccount,
          });
          expectEvent(receipt, "Approval", {
            owner: anotherAccount,
            spender,
            value: new BN(0),
          });
        });

        describe("when there was no approved amount before", () => {
          it("keeps the allowance to zero", async () => {
            await this.token.decreaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(0)));
            // assert.equal(allowance, 0);
          });
        });

        describe("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await this.token.approve(spender, amount + 1, {
              from: anotherAccount,
            });
          });

          it("decreases the spender allowance subtracting the requested amount", async () => {
            await this.token.decreaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(1)));
            // assert.equal(allowance, 1);
          });
        });
      });

      describe("when the sender does not have enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount - 1, {
            from: tokenHolder,
          });
        });

        it("revert decrease approval", async () => {
          await expectRevert(
            this.token.decreaseAllowance(spender, amount, {
              from: anotherAccount,
            }),
            "ERC20: decreased allowance below zero"
          );
        });

        describe("when there was no approved amount before", () => {
          it("revert ", async () => {
            await expectRevert(
              this.token.decreaseAllowance(spender, amount, {
                from: anotherAccount,
              }),
              "ERC20: decreased allowance below zero"
            );
          });
        });

        describe("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await this.token.approve(spender, amount + 1, {
              from: anotherAccount,
            });
          });

          it("decreases the spender allowance subtracting the requested amount", async () => {
            await this.token.decreaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(1)));
            // assert.equal(allowance, 1);
          });
        });
      });
    });

    describe("when the spender is the zero address", () => {
      const spender = constants.ZERO_ADDRESS;

      beforeEach(async () => {
        await this.token.transfer(anotherAccount, amount, {
          from: tokenHolder,
        });
      });

      it("revert decreases the requested amount", async () => {
        await expectRevert(
          this.token.decreaseAllowance(spender, amount, {
            from: anotherAccount,
          }),
          "ERC20: decreased allowance below zero"
        );
      });
    });
  });

  describe("increase approval", () => {
    const amount = 100;

    describe("when the spender is not the zero address", () => {
      const spender = recipient;

      describe("when the sender has enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount, {
            from: tokenHolder,
          });
        });

        it("emits an approval event", async () => {
          const receipt = await this.token.increaseAllowance(spender, amount, {
            from: anotherAccount,
          });
          expectEvent(receipt, "Approval", {
            owner: anotherAccount,
            spender,
            value: new BN(amount),
          });
        });

        describe("when there was no approved amount before", () => {
          it("approves the requested amount", async () => {
            await this.token.increaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount)));
          });
        });

        describe("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await this.token.approve(spender, 1, {from: anotherAccount});
          });

          it("increases the spender allowance adding the requested amount", async () => {
            await this.token.increaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount + 1)));
          });
        });
      });

      describe("when the sender does not have enough balance", () => {
        beforeEach(async () => {
          await this.token.transfer(anotherAccount, amount - 1, {
            from: tokenHolder,
          });
        });

        it("emits an approval event", async () => {
          const receipt = await this.token.increaseAllowance(spender, amount, {
            from: anotherAccount,
          });
          expectEvent(receipt, "Approval", {
            owner: anotherAccount,
            spender,
            value: new BN(amount),
          });
        });

        describe("when there was no approved amount before", () => {
          it("approves the requested amount", async () => {
            await this.token.increaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount)));
          });
        });

        describe("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await this.token.approve(spender, 1, {from: anotherAccount});
          });

          it("increases the spender allowance adding the requested amount", async () => {
            await this.token.increaseAllowance(spender, amount, {
              from: anotherAccount,
            });

            const allowance = await this.token.allowance(
              anotherAccount,
              spender,
              {
                from: anotherAccount,
              }
            );
            assert(new BN(allowance).eq(new BN(amount + 1)));
          });
        });
      });
    });

    describe("when the spender is the zero address", () => {
      const spender = constants.ZERO_ADDRESS;

      beforeEach(async () => {
        await this.token.transfer(anotherAccount, amount, {
          from: tokenHolder,
        });
      });

      it("revert increase allowance", async () => {
        await expectRevert(
          this.token.increaseAllowance(spender, amount, {
            from: anotherAccount,
          }),
          "ERC20: approve to the zero address."
        );
      });
    });
  });

  describe("burn", () => {
    beforeEach(async () => {
      await this.token.transfer(anotherAccount, 100, {from: tokenHolder});
    });

    describe("when the given amount is not greater than balance of the sender", () => {
      const amount = 100;

      it("burns the requested amount", async () => {
        await this.token.burn(amount, {from: anotherAccount});

        const balance = await this.token.balanceOf(anotherAccount, {
          from: anotherAccount,
        });
        assert.equal(balance, 0);
      });

      it("emits a burn event", async () => {
        const receipt = await this.token.burn(amount, {from: anotherAccount});
        expectEvent(receipt, "Transfer", {
          from: anotherAccount,
          to: constants.ZERO_ADDRESS,
          value: new BN(amount),
        });
      });
    });

    describe("when the given amount is greater than the balance of the sender", () => {
      const amount = 101;

      it("reverts", async () => {
        await expectRevert(
          this.token.burn(amount, {from: anotherAccount}),
          "ERC20: burn amount exceeds balance"
        );
      });
    });
  });

  describe("can reclaim", () => {
    it("token", async () => {
      let receipt = await this.token.transfer(this.token.address, 100, {
        from: tokenHolder,
      });

      expectEvent(receipt, "Transfer", {
        from: tokenHolder,
        to: this.token.address,
        value: new BN(100),
      });

      let balance = await this.token.balanceOf(this.token.address, {
        from: anotherAccount,
      });
      assert.equal(balance, 100);
      receipt = await this.token.reclaimToken(this.token.address, {
        from: tokenOwner,
      });
      expectEvent(receipt, "Transfer", {
        from: this.token.address,
        to: tokenOwner,
        value: new BN(100),
      });
      balance = await this.token.balanceOf(this.token.address, {
        from: anotherAccount,
      });
      assert.equal(balance, 0);
      balance = await this.token.balanceOf(tokenOwner, {
        from: anotherAccount,
      });
      assert.equal(balance, 100);
    });
    it("token but revert if it is not by the owner", async () => {
      const receipt = await this.token.transfer(this.token.address, 100, {
        from: tokenHolder,
      });

      expectEvent(receipt, "Transfer", {
        from: tokenHolder,
        to: this.token.address,
        value: new BN(100),
      });

      const balance = await this.token.balanceOf(this.token.address, {
        from: anotherAccount,
      });
      assert.equal(balance, 100);
      await expectRevert(
        this.token.reclaimToken(this.token.address, {
          from: tokenHolder,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });
}
module.exports = shouldBehaveLikeTokenV0;
